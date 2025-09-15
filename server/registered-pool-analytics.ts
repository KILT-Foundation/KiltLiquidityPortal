/**
 * Registered Pool Analytics Service
 * Calculates the "In Range Pool Size" - sum of registered in-range NFTs' values
 * This is used for reward calculations instead of the overall Uniswap pool size
 */

import { db } from './db';
import { lpPositions } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { uniswapIntegrationService } from './uniswap-integration-service';

export interface RegisteredPoolAnalytics {
  totalRegisteredPoolSize: number;
  inRangePoolSize: number;
  totalRegisteredPositions: number;
  inRangePositions: number;
  outOfRangePositions: number;
  lastUpdated: Date;
}

export class RegisteredPoolAnalyticsService {
  private cache: Map<string, any> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Get the In Range Pool Size - sum of registered in-range NFTs' values
   * This is the key metric for reward calculations
   */
  async getInRangePoolSize(): Promise<number> {
    const analytics = await this.getRegisteredPoolAnalytics();
    return analytics.inRangePoolSize;
  }

  /**
   * Get comprehensive registered pool analytics
   */
  async getRegisteredPoolAnalytics(): Promise<RegisteredPoolAnalytics> {
    const cacheKey = 'registered_pool_analytics';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      console.log('🔍 Calculating registered pool analytics...');
      
      // Get all registered positions from database
      const allRegisteredPositions = await db
        .select()
        .from(lpPositions)
        .where(eq(lpPositions.rewardEligible, true));

      console.log(`📊 Found ${allRegisteredPositions.length} registered positions`);

      let totalRegisteredPoolSize = 0;
      let inRangePoolSize = 0;
      let inRangePositions = 0;
      let outOfRangePositions = 0;

      // Check each position's in-range status and sum values
      for (const position of allRegisteredPositions) {
        const positionValueUSD = parseFloat(position.currentValueUSD || '0');
        totalRegisteredPoolSize += positionValueUSD;

        try {
          // Get real-time position data to check if it's in range
          const positionData = await uniswapIntegrationService.getFullPositionData(position.nftTokenId);
          
          if (positionData && positionData.isInRange && positionData.isActive) {
            inRangePoolSize += positionValueUSD;
            inRangePositions++;
          } else {
            outOfRangePositions++;
          }
        } catch (error) {
          console.warn(`Failed to check range status for position ${position.nftTokenId}:`, error);
          // If we can't determine range status, assume out of range for safety
          outOfRangePositions++;
        }
      }

      const analytics: RegisteredPoolAnalytics = {
        totalRegisteredPoolSize,
        inRangePoolSize,
        totalRegisteredPositions: allRegisteredPositions.length,
        inRangePositions,
        outOfRangePositions,
        lastUpdated: new Date()
      };

      // Cache the result
      this.cache.set(cacheKey, { data: analytics, timestamp: Date.now() });
      
      console.log(`✅ Registered Pool Analytics:`, {
        totalRegistered: `$${totalRegisteredPoolSize.toLocaleString()}`,
        inRange: `$${inRangePoolSize.toLocaleString()}`,
        inRangeCount: inRangePositions,
        outOfRangeCount: outOfRangePositions
      });

      return analytics;
    } catch (error) {
      console.error('Error calculating registered pool analytics:', error);
      
      // Return fallback data
      return {
        totalRegisteredPoolSize: 0,
        inRangePoolSize: 0,
        totalRegisteredPositions: 0,
        inRangePositions: 0,
        outOfRangePositions: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get a quick estimate of in-range pool size without full position checks
   * This is faster but less accurate - useful for high-frequency calculations
   */
  async getQuickInRangePoolSize(): Promise<number> {
    try {
      // Get sum of all active registered positions (assume most are in range)
      const result = await db
        .select({
          totalValue: sql<number>`SUM(CAST(${lpPositions.currentValueUSD} AS DECIMAL))`
        })
        .from(lpPositions)
        .where(
          and(
            eq(lpPositions.rewardEligible, true),
            eq(lpPositions.isActive, true)
          )
        );

      return result[0]?.totalValue || 0;
    } catch (error) {
      console.warn('Quick in-range pool size calculation failed:', error);
      return 0;
    }
  }

  /**
   * Clear cache - useful for testing or when positions are updated
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const registeredPoolAnalyticsService = new RegisteredPoolAnalyticsService();
