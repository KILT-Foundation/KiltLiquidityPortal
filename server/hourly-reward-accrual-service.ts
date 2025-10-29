/**
 * Hourly Reward Accrual Service (randomized snapshot within each hour)
 * Implements NRC for first-snap positions and time-weighted budget allocation.
 */

import { db } from './db';
import {
  lpPositions,
  rewards,
  programSettings,
  treasuryConfig,
  hourlySnapshots,
  hourlyRewards,
  positionHourlyState,
} from '../shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import { registeredPoolAnalyticsService } from './registered-pool-analytics';
import { uniswapIntegrationService } from './uniswap-integration-service';
import { dailyRewardAccrualService } from './daily-reward-accrual-service';
import { kiltPriceService } from './kilt-price-service';

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((a.getTime() - b.getTime()) / (1000 * 60)));
}

export class HourlyRewardAccrualService {
  /**
   * Process one hourly snapshot at current time.
   * - Randomization is handled by scheduler; this method just uses now.
   */
  async processHourlySnapshot(now: Date = new Date()): Promise<{
    success: boolean;
    message: string;
    snapshotId?: number;
    processedPositions?: number;
    totalRewardsAccrued?: number;
    errors?: string[];
  }> {
    const dayStr = now.toISOString().split('T')[0];

    try {
      // Load configs
      const [programConfig] = await db.select().from(programSettings).limit(1);
      const [treasury] = await db.select().from(treasuryConfig).limit(1);
      if (!programConfig || !treasury) {
        throw new Error('Program/treasury configuration not found');
      }

      // Find last snapshot (today or earlier)
      const [lastSnap] = await db
        .select()
        .from(hourlySnapshots)
        .orderBy(desc(hourlySnapshots.executedAt))
        .limit(1);

      const lastSnapAt = lastSnap?.executedAt ? new Date(lastSnap.executedAt as unknown as string) : new Date(now.getTime() - 60 * 60 * 1000);
      const hMins = Math.max(1, minutesBetween(now, lastSnapAt));

      // Determine snap number (1-24 per day)
      const [latestToday] = await db
        .select()
        .from(hourlySnapshots)
        .where(eq(hourlySnapshots.date, dayStr as unknown as any))
        .orderBy(desc(hourlySnapshots.snapNumber))
        .limit(1);
      const snapNumber = (latestToday?.snapNumber || 0) + 1;

      // Time-weighted allocation from daily cap
      const dailyCap = parseFloat(treasury.dailyRewardsCap || '25000');
      const allocatedBudgetKilt = dailyCap * (hMins / 1440);

      // Get market context and active positions
      const inRangePoolSize = await registeredPoolAnalyticsService.getInRangePoolSize();
      const activePositions = await db
        .select()
        .from(lpPositions)
        .where(and(eq(lpPositions.rewardEligible, true), eq(lpPositions.isActive, true)));

      // Create snapshot row first
      const [snapshot] = await db
        .insert(hourlySnapshots)
        .values({
          date: dayStr as unknown as any,
          snapNumber,
          executedAt: now,
          minutesSinceLast: hMins,
          allocatedBudgetKilt: allocatedBudgetKilt.toString(),
        })
        .returning();

      let processedPositions = 0;
      let totalRewardsAccrued = 0;
      const errors: string[] = [];

      const positionCalculations: Array<{
        position: any;
        calc: any;
        rawHourly: number;
        nrcFactor: number;
        rawAmount: number;
        state: any;
      }> = [];

      for (const position of activePositions) {
        try {
          // Reuse daily calculation for consistency, then derive per-hour
          const calc = await (dailyRewardAccrualService as any).calculateDailyReward(position, now, {
            dailyBudget: parseFloat(treasury.dailyRewardsCap || '25000'),
            inRangePoolSize,
            timeBoostCoefficient: parseFloat(programConfig.timeBoostCoefficient?.toString() || '0.6'),
            fullRangeBonus: parseFloat(programConfig.fullRangeBonus?.toString() || '1.2'),
            programDurationDays: parseFloat(treasury.programDurationDays?.toString() || '365'),
          });

          const baseHourly = calc.dailyRewardAmount / 24;
          // Time-weight current "hour" length
          const timeWeightedHourly = baseHourly * (hMins / 60);

          // NRC for first-time snapped positions
          const [state] = await db
            .select()
            .from(positionHourlyState)
            .where(eq(positionHourlyState.positionId, position.id))
            .limit(1);

          let nrcFactor = 1;
          if (!state || !state.hasBeenSnapped) {
            const pMins = minutesBetween(now, position.createdAt);
            nrcFactor = Math.max(0, Math.min(1, hMins > 0 ? pMins / hMins : 0));
          }

          const rawAmount = timeWeightedHourly * nrcFactor;

          positionCalculations.push({
            position,
            calc,
            rawHourly: timeWeightedHourly,
            nrcFactor,
            rawAmount,
            state
          });

        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Position ${position.nftTokenId}: ${msg}`);
        }
      }

      // Calculate total raw rewards and normalize
      const totalRawRewards = positionCalculations.reduce((sum, calc) => sum + calc.rawAmount, 0);
      const normalizationFactor = totalRawRewards > 0 ? allocatedBudgetKilt / totalRawRewards : 0;

      console.log(`🔧 NORMALIZATION - Total Raw: ${totalRawRewards.toFixed(6)} KILT, Allocated: ${allocatedBudgetKilt.toFixed(6)} KILT, Factor: ${normalizationFactor.toFixed(6)}`);

      // Process each position with normalized rewards
      for (const { position, calc, rawAmount, nrcFactor, state } of positionCalculations) {
        try {
          // Apply normalization to ensure we don't exceed the allocated budget
          const finalAmount = rawAmount * normalizationFactor;
          
          // Recalculate daily reward amount and APRs based on normalized amount
          const normalizedDailyReward = (finalAmount * 24) / (hMins / 60); // Convert back to daily rate
          
          const kiltPrice = await kiltPriceService.getCurrentPrice();
          const epochLengthMinutes = hMins;
          const minutesPerYear = 525960;
          
          // Calculate anticipated real $ rewards per year
          const annualRewardsUSD = (finalAmount * kiltPrice) / (epochLengthMinutes / minutesPerYear);
          
          // Calculate APR as percentage
          const normalizedBaseAPR = calc.positionValueUSD > 0 ? (annualRewardsUSD / calc.positionValueUSD) * 100 : 0;
          const normalizedEffectiveAPR = normalizedBaseAPR * calc.timeMultiplier;
          
          console.log(`🔧 Position ${position.nftTokenId} - Raw: ${rawAmount.toFixed(6)} KILT, Normalized: ${finalAmount.toFixed(6)} KILT`);
          console.log(`🔧 Position ${position.nftTokenId} - Raw Daily: ${calc.dailyRewardAmount.toFixed(2)} KILT, Normalized Daily: ${normalizedDailyReward.toFixed(2)} KILT`);
          console.log(`🔧 Position ${position.nftTokenId} - Raw APR: ${calc.baseAPR.toFixed(2)}%, Normalized APR: ${normalizedBaseAPR.toFixed(2)}%`);

          // Get or create reward record first to get rewardId
          let rewardRecord;
          const [existingReward] = await db
            .select()
            .from(rewards)
            .where(eq(rewards.positionId, position.id))
            .limit(1);

          if (existingReward) {
            const newAccum = (parseFloat(existingReward.accumulatedAmount) || 0) + finalAmount;
            const [updatedReward] = await db
              .update(rewards)
              .set({
                accumulatedAmount: newAccum.toString(),
                dailyRewardAmount: normalizedDailyReward.toString(),
                baseAPR: normalizedBaseAPR.toString(),
                effectiveAPR: normalizedEffectiveAPR.toString(),
                lastRewardCalculation: now,
                isEligibleForClaim: newAccum > 0,
              })
              .where(eq(rewards.id, existingReward.id))
              .returning();
            rewardRecord = updatedReward;
            
            console.log(`📊 Updated APR for position ${position.nftTokenId}: Base ${normalizedBaseAPR.toFixed(4)}%, Effective ${normalizedEffectiveAPR.toFixed(4)}%`);
          } else {
            const [newReward] = await db.insert(rewards).values({
              userId: position.userId,
              positionId: position.id,
              nftTokenId: position.nftTokenId,
              amount: finalAmount.toString(),
              positionValueUSD: calc.positionValueUSD.toString(),
              dailyRewardAmount: normalizedDailyReward.toString(),
              accumulatedAmount: finalAmount.toString(),
              baseAPR: normalizedBaseAPR.toString(),
              effectiveAPR: normalizedEffectiveAPR.toString(),
              claimedAmount: '0',
              liquidityAddedAt: new Date(position.createdAt),
              stakingStartDate: new Date(position.createdAt),
              lastRewardCalculation: now,
              isEligibleForClaim: finalAmount > 0,
              lockPeriodDays: 7,
            }).returning();
            rewardRecord = newReward;
            
            console.log(`📊 Created new reward record for position ${position.nftTokenId}: Base ${normalizedBaseAPR.toFixed(4)}%, Effective ${normalizedEffectiveAPR.toFixed(4)}%`);
          }

          await db.insert(hourlyRewards).values({
            rewardId: rewardRecord.id,
            snapshotId: snapshot.id,
            userId: position.userId || 0,
            positionId: position.id,
            nftTokenId: position.nftTokenId,
            rewardAmount: finalAmount.toString(),
            nrcFactor: nrcFactor.toString(),
            liquidityRatio: calc.liquidityRatio.toString(),
            timeMultiplier: calc.timeMultiplier.toString(),
            inRangeMultiplier: calc.inRangeMultiplier.toString(),
            fullRangeBonus: calc.fullRangeBonus.toString(),
            executedAt: now,
          });

          // Upsert position state
          if (state) {
            await db
              .update(positionHourlyState)
              .set({ hasBeenSnapped: true, lastSnapAt: now, updatedAt: now })
              .where(eq(positionHourlyState.positionId, position.id));
          } else {
            await db.insert(positionHourlyState).values({
              positionId: position.id,
              hasBeenSnapped: true,
              lastSnapAt: now,
            });
          }


          processedPositions += 1;
          totalRewardsAccrued += finalAmount;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Position ${position.nftTokenId}: ${msg}`);
        }
      }

      return {
        success: errors.length === 0,
        message: `Processed ${processedPositions} positions, ${totalRewardsAccrued.toFixed(6)} KILT accrued`,
        snapshotId: snapshot.id,
        processedPositions,
        totalRewardsAccrued,
        errors,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: msg, errors: [msg] };
    }
  }
}

export const hourlyRewardAccrualService = new HourlyRewardAccrualService();


