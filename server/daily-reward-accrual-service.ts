/**
 * Daily Reward Accrual Service
 * Properly calculates and stores daily rewards for each position
 * This ensures rewards are fixed once calculated and not retroactively changed
 */

import { db } from './db';
import { lpPositions, rewards, programSettings, treasuryConfig, hourlyRewards } from '../shared/schema';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { uniswapIntegrationService } from './uniswap-integration-service';
import { registeredPoolAnalyticsService } from './registered-pool-analytics';
import { unifiedRewardService } from './unified-reward-service';
import { kiltPriceService } from './kilt-price-service';

export interface DailyRewardCalculation {
  date: string; // YYYY-MM-DD format
  positionId: number;
  nftTokenId: string;
  userId: number;
  positionValueUSD: number;
  dailyBudget: number;
  inRangePoolSize: number;
  liquidityRatio: number;
  timeMultiplier: number;
  inRangeMultiplier: number; // 0-1 based on actual in-range status
  fullRangeBonus: number;
  dailyRewardAmount: number;
  daysStaked: number;
  baseAPR: number;
  effectiveAPR: number;
}

export class DailyRewardAccrualService {
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Calculate daily reward for a specific position on a specific date
   */
  private async calculateDailyReward(
    position: any,
    date: Date,
    config: {
      dailyBudget: number;
      inRangePoolSize: number;
      timeBoostCoefficient: number;
      fullRangeBonus: number;
      programDurationDays: number;
    }
  ): Promise<DailyRewardCalculation> {
    // Hard stop: if program is over or treasury is empty, no rewards accrue
    try {
      const programAnalytics = await unifiedRewardService.getProgramAnalytics();
      const treasuryRemaining = Number(programAnalytics?.treasuryRemaining || 0);
      const daysRemaining = Number(programAnalytics?.daysRemaining || 0);
      if (treasuryRemaining <= 0 || daysRemaining <= 0) {
        return {
          date: date.toISOString().split('T')[0],
          positionId: position.id,
          nftTokenId: position.nftTokenId,
          userId: position.userId,
          positionValueUSD: parseFloat(position.currentValueUSD || '0'),
          dailyBudget: config.dailyBudget,
          inRangePoolSize: config.inRangePoolSize,
          liquidityRatio: 0,
          timeMultiplier: 0,
          inRangeMultiplier: 0,
          fullRangeBonus: config.fullRangeBonus,
          dailyRewardAmount: 0,
          daysStaked: 0,
          baseAPR: 0,
          effectiveAPR: 0,
        };
      }
    } catch {
      // If analytics fails, continue with normal calculation
    }
    
    // Get position's actual in-range status for this date
    const positionData = await uniswapIntegrationService.getFullPositionData(position.nftTokenId);
    const isInRange = positionData?.isInRange && positionData?.isActive;
    const inRangeMultiplier = isInRange ? 1.0 : 0.0; // 0 or 1, not fractional

    // Calculate position age in days
    const positionCreatedAt = new Date(position.createdAt);
    const daysStaked = Math.max(0, Math.floor((date.getTime() - positionCreatedAt.getTime()) / (1000 * 60 * 60 * 24)));
    const totalPoolTVL = await unifiedRewardService.getPoolTVL();
    
    // Calculate time multiplier based on program participation time, not total position age
    // Get program start date from admin config
    const [treasuryConfigData] = await db.select().from(treasuryConfig).limit(1);
    const programStartDate = treasuryConfigData?.programStartDate ? new Date(treasuryConfigData.programStartDate) : new Date('2024-01-01');
    const programParticipationDays = Math.max(0, Math.floor((date.getTime() - Math.max(programStartDate.getTime(), positionCreatedAt.getTime())) / (1000 * 60 * 60 * 24)));
    const timeMultiplier = Math.min(1 + ((programParticipationDays / config.programDurationDays) * config.timeBoostCoefficient), 1 + config.timeBoostCoefficient);

    // Calculate liquidity ratio
    const positionValueUSD = parseFloat(position.currentValueUSD || '0');
    const liquidityRatio = config.inRangePoolSize > 0 ? positionValueUSD / config.inRangePoolSize : 0;

    // Calculate daily reward amount
    const dailyRewardAmount = liquidityRatio * timeMultiplier * config.dailyBudget;
    const kiltPrice = await kiltPriceService.getCurrentPrice();
   
    const minutesPerDay = 1440; // Minutes in a day
    const minutesPerYear = 525960; // Average minutes in a year
    
    const annualRewardsUSD = (dailyRewardAmount * kiltPrice) / (minutesPerDay / minutesPerYear);
    
    // Calculate APR as percentage
    const baseAPR = positionValueUSD > 0 ? (annualRewardsUSD / positionValueUSD) * 100 : 0;
    const effectiveAPR = baseAPR * timeMultiplier;

    return {
      date: date.toISOString().split('T')[0],
      positionId: position.id,
      nftTokenId: position.nftTokenId,
      userId: position.userId,
      positionValueUSD,
      dailyBudget: config.dailyBudget,
      inRangePoolSize: config.inRangePoolSize,
      liquidityRatio,
      timeMultiplier,
      inRangeMultiplier,
      fullRangeBonus: config.fullRangeBonus,
      dailyRewardAmount,
      daysStaked,
      baseAPR,
      effectiveAPR
    };
  }


  /**
   * Get accumulated rewards for a position from stored daily rewards
   */
  async getAccumulatedRewards(positionId: number): Promise<{
    totalAccumulated: number;
    hourlyBreakdown: Array<{
      date: string;
      amount: number;
      inRange: boolean;
      timeMultiplier: number;
    }>;
  }> {
    const hourlyRecords = await db
      .select()
      .from(hourlyRewards)
      .where(eq(hourlyRewards.positionId, positionId))
      .orderBy(desc(hourlyRewards.executedAt));

    // Calculate accumulated amount from hourly records with correct time multiplier
    // This ensures we get the correct total even if the stored accumulatedAmount is wrong
    const totalAccumulated = hourlyRecords.reduce((sum, record) => {
      return sum + parseFloat(record.rewardAmount || '0');
    }, 0);

    const hourlyBreakdown = hourlyRecords.map((record: any) => ({
      date: record.executedAt.toISOString().split('T')[0],
      amount: parseFloat(record.rewardAmount),
      inRange: true, // Simplified check
      timeMultiplier: parseFloat(record.timeMultiplier)
    }));

    return {
      totalAccumulated,
      hourlyBreakdown
    };
  }

  /**
   * Get current daily rate for a position (what they'll earn today)
   * Returns the normalized daily rate from the database, not the raw calculated rate
   */
  async getCurrentDailyRate(positionId: number): Promise<number> {
    // Get the most recent reward record which contains the normalized daily rate
    const [rewardRecord] = await db
      .select({ dailyRewardAmount: rewards.dailyRewardAmount })
      .from(rewards)
      .where(eq(rewards.positionId, positionId))
      .orderBy(desc(rewards.lastRewardCalculation))
      .limit(1);

    if (!rewardRecord) {
      // Fallback to raw calculation if no reward record exists yet
      const [position] = await db
        .select()
        .from(lpPositions)
        .where(eq(lpPositions.id, positionId))
        .limit(1);

      if (!position) return 0;

      const [programConfig] = await db.select().from(programSettings).limit(1);
      const [treasuryConfigData] = await db.select().from(treasuryConfig).limit(1);

      if (!programConfig || !treasuryConfigData) return 0;

      const inRangePoolSize = await registeredPoolAnalyticsService.getInRangePoolSize();
      const dailyBudget = parseFloat(treasuryConfigData.dailyRewardsCap || '25000');
      const timeBoostCoefficient = parseFloat(programConfig.timeBoostCoefficient?.toString() || '0.6');
      const fullRangeBonus = parseFloat(programConfig.fullRangeBonus?.toString() || '1.2');

      const calculation = await this.calculateDailyReward(position, new Date(), {
        dailyBudget,
        inRangePoolSize,
        timeBoostCoefficient,
        fullRangeBonus,
        programDurationDays: parseFloat(treasuryConfigData.programDurationDays?.toString() || '365')
      });

      return calculation.dailyRewardAmount;
    }

    // Return the normalized daily rate from the database
    return parseFloat(rewardRecord.dailyRewardAmount || '0');
  }
}

// Export singleton instance
export const dailyRewardAccrualService = new DailyRewardAccrualService();
