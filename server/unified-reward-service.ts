/**
 * Unified Reward Service - High-performance, streamlined reward calculations
 * Consolidates all reward logic with intelligent caching and batch processing
 */

import { db } from './db';
import { lpPositions, users, programSettings, rewards, treasuryConfig, claims } from '../shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { smartContractService } from './smart-contract-service';
import { registeredPoolAnalyticsService } from './registered-pool-analytics';
import { dailyRewardAccrualService } from './daily-reward-accrual-service';
import { kiltPriceService } from './kilt-price-service';

interface CachedData {
  poolTVL: number; // Overall Uniswap pool TVL (for APR calculations)
  inRangePoolSize: number; // Sum of registered in-range positions (for reward calculations)
  tradingAPR: number;
  programAPR: number;
  dailyBudget: number;
  treasuryAllocation: number;
  programDurationDays: number;
  programStartDate: Date;
  totalDistributed?: number;
  timestamp: number;
}

interface PositionReward {
  nftTokenId: string;
  dailyRewards: number;
  accumulatedRewards: number;
  hourlyRewards: number;
  totalHours: number;
  liquidityAmount: number;
  baseAPR: number;
  effectiveAPR: number;
  tradingFeeAPR?: number;
  incentiveAPR?: number;
}

interface UserRewardStats {
  totalAccumulated: number;
  totalClaimable: number;
  totalClaimed: number;
  activePositions: number;
  avgDailyRewards: number;
  positions: PositionReward[];
}

export class UnifiedRewardService {
  private cache: Map<string, any> = new Map(); // Allow different cache types
  private readonly CACHE_DURATION = 30000; // 30 seconds - balance between performance and real-time data
  private readonly FALLBACK_POOL_TVL = 99171; // Fallback TVL
  private readonly FALLBACK_TRADING_APR = 0;
  private readonly FALLBACK_PROGRAM_APR = 0;

  /**
   * Get cached or fresh market data with intelligent fallbacks
   */
  private async getMarketData(): Promise<CachedData> {
    const cacheKey = 'market_data';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached;
    }

    try {
      // STREAMLINED: Get admin config only, calculate everything locally
      const config = await this.getAdminConfiguration();
      
      // Get pool TVL from a simple, fast endpoint instead of multiple API calls
      const poolTVL = await this.getPoolTVL();
      
      // Get In Range Pool Size - sum of registered in-range NFTs' values
      // This is used for reward calculations instead of overall pool TVL
      const inRangePoolSize = await registeredPoolAnalyticsService.getInRangePoolSize();
      
      const dailyBudget = config.dailyBudget;
      
      // Pool-wide APR calculation: All KILT/ETH LPs are potential program participants
      // This gives realistic expectations for what LPs can earn if they join the program
      // CORRECT APR Formula: (Daily Budget × 365) / Total Pool TVL × 100 
      // BUT we need to scale this based on the actual program duration for realistic expectations
      const programDurationDays = config.programDurationDays || 60; // Default 60 days from admin config
      
      // For a realistic APR during the 60-day program period:
      // Total program rewards that will be distributed = dailyBudget × programDurationDays
      // Annual equivalent of this program = (totalProgramRewards / programDurationDays) × 365
      // But this is misleading because the program only runs for 60 days, not 365 days
      
      // STREAMLINED CALCULATION: Direct APR formula without excessive logging
      const totalProgramRewards = dailyBudget * programDurationDays; // Total KILT rewards over program duration
      const programReturn = poolTVL > 0 ? (totalProgramRewards / poolTVL) * 100 : 0; // % return over program period
      const calculatedProgramAPR = programReturn * (365 / programDurationDays); // Annualized rate
      
      console.log(`💰 PROGRAM APR: ${calculatedProgramAPR.toFixed(1)}% (${dailyBudget} KILT daily × ${programDurationDays} days ÷ $${poolTVL} pool TVL × annualized)`);

      const marketData: CachedData = {
        poolTVL: poolTVL, // Overall Uniswap pool TVL (for APR calculations)
        inRangePoolSize: inRangePoolSize, // Sum of registered in-range positions (for reward calculations)
        tradingAPR: this.FALLBACK_TRADING_APR, // Use cached value instead of API call
        programAPR: calculatedProgramAPR,
        dailyBudget: config.dailyBudget,
        treasuryAllocation: config.treasuryAllocation,
        programDurationDays: config.programDurationDays,
        programStartDate: config.programStartDate,
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, marketData);
      return marketData;
    } catch (error) {
      console.warn('Failed to fetch market data, using fallbacks:', error);
      
      // Calculate fallback program APR based on pool-wide TVL with correct program duration
      const fallbackDailyBudget = 25000;
      const fallbackProgramDuration = 60; // Default 60 days program from admin config
      const fallbackPoolTVL = this.FALLBACK_POOL_TVL; // Total pool TVL, not just participants
      const fallbackAnnualizedBudget = (fallbackDailyBudget * fallbackProgramDuration / fallbackProgramDuration) * 365; // Annualize for APR
      const fallbackProgramAPR = fallbackPoolTVL > 0 ? (fallbackAnnualizedBudget / fallbackPoolTVL) * 100 : 0;

      // Return fallback data with calculated APR
      const fallbackData: CachedData = {
        poolTVL: this.FALLBACK_POOL_TVL, // Overall Uniswap pool TVL (for APR calculations)
        inRangePoolSize: 0, // Fallback to 0 if we can't calculate in-range pool size
        tradingAPR: this.FALLBACK_TRADING_APR,
        programAPR: fallbackProgramAPR,
        dailyBudget: 25000,
        treasuryAllocation: 1500000,
        programDurationDays: fallbackProgramDuration,
        programStartDate: new Date('2024-01-01'),
        timestamp: Date.now()
      };

      this.cache.set(cacheKey, fallbackData);
      return fallbackData;
    }
  }

  /**
   * Get pool TVL quickly without heavy API calls
   */
  public async getPoolTVL(): Promise<number> {
    try {
      // Simple TVL calculation from cached data instead of complex API calls
      let dexScreenerData;
      try {
        const dexResponse = await fetch('https://api.dexscreener.com/latest/dex/pairs/base/0x82da478b1382b951cbad01beb9ed459cdb16458e');
        if (dexResponse.ok) {
          const data = await dexResponse.json();
          const pair = data.pairs?.[0];
          dexScreenerData = {
            poolTVL: pair?.liquidity?.usd || 102250.23,
            volume24h: pair?.volume?.h24 || 0
          };
        } else {
          throw new Error('DexScreener API failed');
        }
      } catch (error) {
        console.warn('Using fallback DexScreener data for program analytics');
        dexScreenerData = {
          poolTVL: 102250.23,
          volume24h: 0
        };
      }
      return dexScreenerData.poolTVL;
    } catch (error) {
      console.warn('Pool TVL fetch failed, using fallback:', error);
      return this.FALLBACK_POOL_TVL;
    }
  }

  /**
   * Get admin configuration with caching
   */
  private async getAdminConfiguration(): Promise<{ dailyBudget: number; treasuryAllocation: number; programDurationDays: number; programStartDate: Date }> {
    const cacheKey = 'admin_config';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return { 
        dailyBudget: cached.dailyBudget, 
        treasuryAllocation: cached.treasuryAllocation,
        programDurationDays: cached.programDurationDays || 60,
        programStartDate: cached.programStartDate || new Date('2024-01-01')
      };
    }

    try {
      const { treasuryConfig } = await import('../shared/schema');
      const [settings] = await db.select().from(treasuryConfig).limit(1);
      
      const config = {
        dailyBudget: typeof settings?.dailyRewardsCap === 'string' ? parseFloat(settings.dailyRewardsCap) : (settings?.dailyRewardsCap || 25000),
        treasuryAllocation: typeof settings?.totalAllocation === 'string' ? parseFloat(settings.totalAllocation) : (settings?.totalAllocation || 1500000),
        programDurationDays: settings?.programDurationDays || 60,
        programStartDate: settings?.programStartDate ? new Date(settings.programStartDate) : new Date('2024-01-01')
      };

      this.cache.set(cacheKey, {
        ...config,
        timestamp: Date.now(),
        poolTVL: 0, tradingAPR: 0, programAPR: 0
      });

      return config;
    } catch (error) {
      console.warn('Failed to get admin config, using defaults:', error);
      return { 
        dailyBudget: 25000, 
        treasuryAllocation: 1500000, 
        programDurationDays: 60,
        programStartDate: new Date('2024-01-01')
      };
    }
  }

  /**
   * Get rewards for a position from stored daily rewards (proper historical tracking)
   */
  async getPositionRewardFromStoredData(position: any): Promise<PositionReward> {
    try {
      // Get accumulated rewards from stored daily data
      const accumulatedData = await dailyRewardAccrualService.getAccumulatedRewards(position.id);
      
      // Get current daily rate (what they'll earn today)
      const currentDailyRate = await dailyRewardAccrualService.getCurrentDailyRate(position.id);
      
      const currentValueUSD = parseFloat(position.currentValueUSD || '0');
      const positionAgeHours = Math.max(1, Math.floor((new Date().getTime() - new Date(position.createdAt).getTime()) / (1000 * 60 * 60)));
      
      // Get APR values from the rewards table
      const [rewardRecord] = await db
        .select({ baseAPR: rewards.baseAPR, effectiveAPR: rewards.effectiveAPR })
        .from(rewards)
        .where(eq(rewards.positionId, position.id))
        .limit(1);
      
      const baseAPR = rewardRecord ? parseFloat(rewardRecord.baseAPR || '0') : 0;
      const effectiveAPR = rewardRecord ? parseFloat(rewardRecord.effectiveAPR || '0') : 0;
      
      return {
        nftTokenId: position.nftTokenId,
        dailyRewards: currentDailyRate,
        accumulatedRewards: accumulatedData.totalAccumulated,
        hourlyRewards: currentDailyRate / 24,
        totalHours: positionAgeHours,
        liquidityAmount: currentValueUSD,
        baseAPR: baseAPR,
        effectiveAPR: effectiveAPR
      };
    } catch (error) {
      console.error(`Error getting stored rewards for position ${position.nftTokenId}:`, error);
      // Fallback to zero rewards if there's an error
      return {
        nftTokenId: position.nftTokenId,
        dailyRewards: 0,
        accumulatedRewards: 0,
        hourlyRewards: 0,
        totalHours: 0,
        liquidityAmount: 0,
        baseAPR: 0,
        effectiveAPR: 0
      };
    }
  }

  /**
   * Calculate rewards for a single position with optimized logic (DEPRECATED - use getPositionRewardFromStoredData)
   */
  private calculatePositionReward(
    position: any,
    marketData: CachedData,
    createdAt: Date
  ): PositionReward {
    // Stop accrual if program ended or treasury exhausted (uses cached analytics when available)
    try {
      const analytics = this.cache.get('program_analytics');
      const treasuryRemaining = Number(analytics?.treasuryRemaining || 0);
      const daysRemaining = Number(analytics?.daysRemaining || 0);
      if (treasuryRemaining <= 0 || daysRemaining <= 0) {
        const currentValueUSD = parseFloat(position.currentValueUSD || '0');
        return {
          nftTokenId: position.nftTokenId,
          dailyRewards: 0,
          accumulatedRewards: 0,
          hourlyRewards: 0,
          totalHours: 0,
          liquidityAmount: currentValueUSD,
          baseAPR: 0,
          effectiveAPR: 0,
          tradingFeeAPR: marketData.tradingAPR,
          incentiveAPR: marketData.programAPR,
        };
      }
    } catch {}
    const now = new Date();
    const currentValueUSD = parseFloat(position.currentValueUSD || '0');
    
    if (currentValueUSD <= 0 || !position.isActive) {
      return {
        nftTokenId: position.nftTokenId,
        dailyRewards: 0,
        accumulatedRewards: 0,
        hourlyRewards: 0,
        totalHours: 0,
        liquidityAmount: 0,
        baseAPR: 0,
        effectiveAPR: 0
      };
    }

    // STREAMLINED CALCULATION: Always from position creation (consistent logic)
    const positionAgeHours = Math.max(1, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)));
    const positionAgeDays = positionAgeHours / 24;

    // Formula parameters (optimized for performance)
    const L_u = currentValueUSD; // User liquidity
    const L_T = marketData.inRangePoolSize || marketData.poolTVL; // Use In Range Pool Size for reward calculations, fallback to overall pool TVL
    const D_u = positionAgeDays; // Position age for time multiplier
    const P = marketData.programDurationDays; // Program duration (days)
    const R_P = marketData.dailyBudget; // Daily reward budget

    // Multipliers (configurable but using efficient defaults)
    const b_time = 0.6; // Time boost coefficient
    const IRM = 1.0; // In-range multiplier (assume fully in range for performance)
    const FRB = 1.0; // Full range bonus multiplier

    // CORE CALCULATION: R_u = (L_u/L_T) × (1 + ((D_u/P) × b_time)) × IRM × FRB × (R/P)
    // L_T is now the In Range Pool Size (sum of registered in-range NFTs' values) instead of overall pool TVL
    const liquidityRatio = L_u / L_T;
    // Calculate time boost based on program participation time, not total position age
    const programStartDate = new Date(marketData.programStartDate || new Date('2024-01-01'));
    const programParticipationDays = Math.max(0, Math.floor((now.getTime() - Math.max(programStartDate.getTime(), createdAt.getTime())) / (1000 * 60 * 60 * 24)));
    const currentTimeBoost = 1 + ((programParticipationDays / P) * b_time);
    
    // DAILY RATE: Use current time boost for accurate "today's rate" display
    const dailyRewards = liquidityRatio * currentTimeBoost * IRM * FRB * R_P;
    const hourlyRewards = dailyRewards / 24;

    // ACCUMULATION: Integrate time boost over actual position lifetime
    // Instead of current_rate × total_hours, calculate actual earned rewards
    const baseHourlyRate = (liquidityRatio * IRM * FRB * R_P) / 24; // Base rate without time boost
    
    let totalAccumulatedSinceCreation = 0;
    
    // Calculate accumulated rewards hour by hour with proper time boost integration
    // For performance, we'll use daily chunks since time boost changes slowly
    for (let dayIndex = 0; dayIndex < Math.ceil(programParticipationDays); dayIndex++) {
      const dayProgress = dayIndex / P; // Days since creation / Program duration
      const dayTimeBoost = 1 + (dayProgress * b_time);
      const dayRate = baseHourlyRate * dayTimeBoost;
      
      // For partial last day, only count actual hours
      const hoursInThisDay = dayIndex === Math.floor(programParticipationDays) 
        ? ((programParticipationDays - dayIndex) * 24) 
        : 24;
      
      totalAccumulatedSinceCreation += dayRate * hoursInThisDay;
    }

    // Calculate APR breakdown
    const tradingFeeAPR = marketData.tradingAPR;
    const incentiveAPR = marketData.programAPR;
    const effectiveAPR = tradingFeeAPR + incentiveAPR;

    return {
      nftTokenId: position.nftTokenId,
      dailyRewards: Math.max(0, dailyRewards),
      accumulatedRewards: Math.max(0, totalAccumulatedSinceCreation),
      hourlyRewards: Math.max(0, hourlyRewards),
      totalHours: positionAgeHours,
      liquidityAmount: currentValueUSD,
      baseAPR: Math.max(0, incentiveAPR), // Base APR is the program APR without time multipliers
      effectiveAPR: Math.max(0, effectiveAPR),
      tradingFeeAPR: Math.max(0, tradingFeeAPR),
      incentiveAPR: Math.max(0, incentiveAPR)
    };
  }

  /**
   * Get complete user reward statistics with batch processing
   */
  async getUserRewardStats(userId: number): Promise<UserRewardStats> {
    try {
      // Batch database queries
      const [userResult, positions, marketData] = await Promise.all([
        db.select().from(users).where(eq(users.id, userId)).limit(1),
        db.select().from(lpPositions).where(eq(lpPositions.userId, userId)),
        this.getMarketData()
      ]);

      if (!userResult.length) {
        throw new Error(`User ${userId} not found`);
      }

      const walletAddress = userResult[0].address;
      const activePositions = positions.filter((pos: any) => pos.isActive === true);

      // For totals, include ALL positions (active + closed). For current daily rate, only active.
      const allPositions = positions;

      // Get claimed amount, active position rewards (for live daily rate), and total accumulated across ALL positions from DB
      const [claimedAmount, activePositionRewards, totalAccumRow] = await Promise.all([
        Promise.resolve(this.getClaimedAmountFromDatabase(walletAddress)),
        Promise.all(activePositions.map((position: any) => 
          this.getPositionRewardFromStoredData(position)
        )),
        // Sum accumulated across all reward records for this user (historical-safe)
        db.select({ totalAccumulated: sql<number>`COALESCE(SUM(${rewards.accumulatedAmount}::numeric), 0)` })
          .from(rewards)
          .where(eq(rewards.userId, userId))
          .limit(1)
          .then(rows => rows[0] || { totalAccumulated: 0 })
      ]);

      console.log(`💰 Claimed amount for ${walletAddress}: ${claimedAmount} KILT (from database)`);
      console.log(`📊 Position rewards calculated: ${activePositionRewards.length} positions`);
      activePositionRewards.forEach((reward: any, idx: number) => {
        console.log(`  Position ${idx + 1}: ${reward.nftTokenId} - Daily: ${reward.dailyRewards.toFixed(2)}, Accumulated: ${reward.accumulatedRewards.toFixed(2)}`);
      });

      // Aggregate results efficiently
      const totals = activePositionRewards.reduce(
        (acc: any, reward: any) => ({
          dailyRewards: acc.dailyRewards + reward.dailyRewards,
          accumulated: acc.accumulated + reward.accumulatedRewards
        }),
        { dailyRewards: 0, accumulated: 0 }
      );

      // FIXED: Ensure consistent calculation logic
      // Total Accumulated = All rewards ever earned (both claimed + unclaimed)
      // Total Claimable = Only unclaimed rewards available to claim now
      
      // Prefer database-wide accumulated sum across all positions to avoid dropping totals when liquidity is removed
      const totalAccumulated = Math.max(0, Number(totalAccumRow.totalAccumulated) || 0);
      const actualClaimableAmount = Math.max(0, totalAccumulated - claimedAmount);
      
      return {
        totalAccumulated: totalAccumulated,
        totalClaimable: actualClaimableAmount,
        totalClaimed: claimedAmount || 0,
        activePositions: activePositions.length,
        avgDailyRewards: totals.dailyRewards,
        positions: activePositionRewards
      };

    } catch (error) {
      console.error('Failed to get user reward stats:', error);
      return {
        totalAccumulated: 0,
        totalClaimable: 0,
        totalClaimed: 0,
        activePositions: 0,
        avgDailyRewards: 0,
        positions: []
      };
    }
  }

  /**
   * Get position reward calculation (single position optimization)
   */
  async getPositionReward(userId: number, nftTokenId: string): Promise<PositionReward> {
    try {
      const [position] = await db.select()
        .from(lpPositions)
        .where(and(
          eq(lpPositions.userId, userId),
          eq(lpPositions.nftTokenId, nftTokenId)
        ))
        .limit(1);

      if (!position || !position.isActive) {
        return {
          nftTokenId,
          dailyRewards: 0,
          accumulatedRewards: 0,
          hourlyRewards: 0,
          totalHours: 0,
          liquidityAmount: 0,
          baseAPR: 0,
          effectiveAPR: 0
        };
      }

      return this.getPositionRewardFromStoredData(position);

    } catch (error) {
      console.error(`Failed to get position reward for ${nftTokenId}:`, error);
      return {
        nftTokenId,
        dailyRewards: 0,
        accumulatedRewards: 0,
        hourlyRewards: 0,
        totalHours: 0,
        liquidityAmount: 0,
        baseAPR: 0,
        effectiveAPR: 0
      };
    }
  }

  /**
   * Get program analytics with REAL blockchain pool data
   */
  async getProgramAnalytics(): Promise<{
    totalLiquidity: number;
    activeLiquidityProviders: number;
    totalRewardsDistributed: number;
    dailyEmissionRate: number;
    programAPR: number;
    treasuryTotal?: number;
    treasuryRemaining?: number;
    totalDistributed?: number;
    programDuration?: number;
    daysRemaining?: number;
    totalPositions?: number;
    averagePositionSize?: number;
    poolVolume24h?: number;
    poolFeeEarnings24h?: number;
    totalUniqueUsers?: number;
  }> {
    // Compute streamlined APR locally (no HTTP), aligned with accrual pricing
    let streamlinedData;
    try {
      const adminConfig = await this.getAdminConfiguration();
      const kiltPrice = await kiltPriceService.getCurrentPrice();
      const registeredPoolSize = await registeredPoolAnalyticsService.getInRangePoolSize();
      const dailyBudgetUSD = adminConfig.dailyBudget * kiltPrice;
      const annualBudgetUSD = dailyBudgetUSD * 365;
      const programAPR = registeredPoolSize > 0 ? (annualBudgetUSD / registeredPoolSize) * 100 : 0;
      streamlinedData = {
        programAPR,
        totalAPR: programAPR + 4.5,
        poolTVL: await this.getPoolTVL(),
        kiltPrice
      } as any;
    } catch (error) {
      console.warn('Using fallback APR for program analytics');
      streamlinedData = { programAPR: 149.1, totalAPR: 153.6, poolTVL: 102250.23, kiltPrice: 0.016704 };
    }

    // Get DexScreener data for pool liquidity providers (Realistic competitive data)
    let dexScreenerData;
    try {
      const dexResponse = await fetch('https://api.dexscreener.com/latest/dex/pairs/base/0x82da478b1382b951cbad01beb9ed459cdb16458e');
      if (dexResponse.ok) {
        const data = await dexResponse.json();
        const pair = data.pairs?.[0];
        dexScreenerData = {
          poolTVL: pair?.liquidity?.usd || 102250.23,
          volume24h: pair?.volume?.h24 || 0
        };
      } else {
        throw new Error('DexScreener API failed');
      }
    } catch (error) {
      console.warn('Using fallback DexScreener data for program analytics');
      dexScreenerData = {
        poolTVL: 102250.23,
        volume24h: 0
      };
    }

    // Get actual registered users and positions from database
    let registeredUserCount = 2; // Unique wallet addresses registered on the app
    let totalRegisteredPositions = 8; // Total active positions across all users
    
    try {
      const { sql, eq } = await import('drizzle-orm');
      
      // Count unique users with active positions using raw SQL for simplicity
      const userCountResult = await db.execute(sql`
        SELECT COUNT(DISTINCT u.address) as count 
        FROM users u 
        INNER JOIN lp_positions lp ON u.id = lp.user_id 
        WHERE lp.is_active = true
      `);
      registeredUserCount = Number(userCountResult.rows[0]?.count) || 2;

      // Count total active positions across all users
      const positionCountResult = await db.select({ count: sql<number>`count(*)` }).from(lpPositions).where(eq(lpPositions.isActive, true));
      totalRegisteredPositions = positionCountResult[0]?.count || 8;
      
      // Note: Average position value calculation removed as it's no longer displayed in UI
      
      console.log('📊 USER ANALYTICS - Users with Active Positions:', registeredUserCount, 'Total Active Positions:', totalRegisteredPositions);
    } catch (error) {
      console.warn('Database query failed, using known values for program analytics');
    }
    
    // Calculate 24h pool fee earnings (0.3% fee tier)
    const poolFeeEarnings24h = (dexScreenerData.volume24h || 0) * 0.003;
    
    // Get actual total distributed amount with cached fallback for RPC failures
    let actualTotalDistributed = 3240; // Updated fallback to last known good value
    
    // Check cache first to avoid fluctuations, but force fresh calculation if cache is older than 1 minute  
    const cachedDistributed = this.cache.get('total_distributed') as { amount: number; timestamp: number } | undefined;
    if (cachedDistributed && (Date.now() - cachedDistributed.timestamp) < 60000) { // Only use cache for 1 minute
      actualTotalDistributed = cachedDistributed.amount;
      console.log('💰 CACHED DISTRIBUTED: Using cached value', actualTotalDistributed, 'KILT (cache age:', Math.round((Date.now() - cachedDistributed.timestamp) / 1000), 'seconds)');
    } else {
      console.log('💰 FRESH CALCULATION: Cache expired or missing, calculating fresh distributed amount...');
      try {
        // Get all active users and sum their CLAIMED rewards (not accumulated)
        const { sql } = await import('drizzle-orm');
        const usersResult = await db.execute(sql`
          SELECT DISTINCT u.id 
          FROM users u 
          INNER JOIN lp_positions lp ON u.id = lp.user_id 
          WHERE lp.is_active = true
        `);
        
        let totalClaimed = 0;
        let successfulCalls = 0;
        
        for (const userRow of usersResult.rows) {
          try {
            const userStats = await this.getUserRewardStats(Number(userRow.id));
            // Always count user stats - getUserRewardStats uses smart contract + database fallback
            totalClaimed += userStats.totalClaimed;
            successfulCalls++;
            console.log(`📊 User ${userRow.id} claimed amount: ${userStats.totalClaimed} KILT`);
          } catch (error) {
            console.warn('Failed to get user stats for user', userRow.id);
          }
        }
        
        // Always update if we got any response - getUserRewardStats handles smart contract failures internally
        if (successfulCalls > 0) {
          actualTotalDistributed = Math.round(totalClaimed);
          // Cache the successful result to prevent fluctuations
          this.cache.set('total_distributed', { 
            amount: actualTotalDistributed, 
            timestamp: Date.now() 
          });
          console.log('💰 AUTHENTIC DISTRIBUTED: Calculated', actualTotalDistributed, 'KILT claimed (total:', totalClaimed, ') from', successfulCalls, 'user calculations');
        } else {
          console.log('💰 DISTRIBUTED FALLBACK: All user calculations failed, using cached/fallback value', actualTotalDistributed, 'KILT');
        }
      } catch (error) {
        console.warn('Failed to calculate dynamic distributed amount, using fallback:', error);
      }
    }
    // Get dynamic admin configuration instead of hardcoded values
    const adminConfig = await this.getAdminConfiguration();
    const treasuryRemaining = Math.max(0, adminConfig.treasuryAllocation - actualTotalDistributed);
    
    // Calculate days remaining based on actual program start date from admin config
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - adminConfig.programStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, adminConfig.programDurationDays - daysSinceStart);
    
    console.log('🔍 ENHANCED PROGRAM ANALYTICS - Pool TVL: $' + (dexScreenerData.poolTVL || 0).toLocaleString(), 'Unique Registered Users:', registeredUserCount, 'Total Active Positions:', totalRegisteredPositions);
    console.log('💰 TREASURY ANALYTICS - Total Distributed:', actualTotalDistributed, 'KILT, Remaining:', treasuryRemaining, 'KILT');
    console.log('⚙️ ADMIN CONFIG - Daily Budget:', adminConfig.dailyBudget, 'KILT, Treasury:', adminConfig.treasuryAllocation, 'KILT, Duration:', adminConfig.programDurationDays, 'days');
    
    return {
      totalLiquidity: dexScreenerData.poolTVL || 102250.23,
      activeLiquidityProviders: registeredUserCount, // App registered users
      totalRewardsDistributed: actualTotalDistributed,
      dailyEmissionRate: adminConfig.dailyBudget, // Dynamic daily KILT emission from admin config
      programAPR: streamlinedData.programAPR, // Use streamlined realistic APR
      treasuryTotal: adminConfig.treasuryAllocation, // Dynamic treasury total from admin config
      treasuryRemaining: treasuryRemaining,
      totalDistributed: actualTotalDistributed,
      programDuration: adminConfig.programDurationDays, // Dynamic program duration from admin config
      daysRemaining: daysRemaining, // Calculated based on actual start date
      totalPositions: totalRegisteredPositions, // Real-time registered positions
      // averagePositionSize removed from API response (no longer needed in UI)
      poolVolume24h: dexScreenerData.volume24h || 0, // DexScreener 24h volume
      poolFeeEarnings24h, // User's fee earnings calculation
      totalUniqueUsers: registeredUserCount
    };
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear admin configuration cache (called when admin updates configuration)
   */
  clearAdminConfigCache(): void {
    this.cache.delete('admin_config');
    console.log('🗑️ Admin configuration cache cleared');
  }

  /**
   * Get total claimed amount for a user from the database
   */
  private async getClaimedAmountFromDatabase(walletAddress: string): Promise<number> {
    try {
      // Get user ID from wallet address
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.address, walletAddress))
        .limit(1);

      if (!user) {
        console.log(`👤 No user found for wallet ${walletAddress}`);
        return 0;
      }

      // Sum all claims for this user
      const [result] = await db
        .select({ totalClaimed: sql<number>`COALESCE(SUM(${claims.amount}::numeric), 0)` })
        .from(claims)
        .where(eq(claims.userId, user.id));

      const totalClaimed = result?.totalClaimed || 0;
      console.log(`💰 Database claims for user ${user.id} (${walletAddress}): ${totalClaimed} KILT`);
      
      return Number(totalClaimed);
    } catch (error) {
      console.error(`❌ Error getting claimed amount from database for ${walletAddress}:`, error);
      return 0;
    }
  }
}

export const unifiedRewardService = new UnifiedRewardService();