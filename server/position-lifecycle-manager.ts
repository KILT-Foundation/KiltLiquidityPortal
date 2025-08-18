/**
 * Position Lifecycle Manager
 * Handles position state transitions (active/closed) and updates reward calculations
 */

import { db } from './db';
import { lpPositions, users } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface PositionStatusUpdate {
  nftTokenId: string;
  previousStatus: 'ACTIVE' | 'CLOSED';
  newStatus: 'ACTIVE' | 'CLOSED';
  liquidityAmount: string;
  reason: 'LIQUIDITY_REMOVED' | 'POSITION_BURNED' | 'LIQUIDITY_ADDED';
}

export class PositionLifecycleManager {
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private syncTimer?: NodeJS.Timeout;

  /**
   * Start automatic position status synchronization
   */
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(async () => {
      await this.syncAllPositions();
    }, this.SYNC_INTERVAL);
    
    console.log('📍 Position lifecycle auto-sync started (every 5 minutes)');
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Sync all registered positions with on-chain state
   */
  async syncAllPositions(): Promise<PositionStatusUpdate[]> {
    try {
      console.log('🔄 Starting position lifecycle sync...');
      
      // Get all registered positions
      const dbPositions = await db
        .select({
          nftTokenId: lpPositions.nftTokenId,
          userId: lpPositions.userId,
          isActive: lpPositions.isActive,
          liquidity: lpPositions.liquidity
        })
        .from(lpPositions);

      if (dbPositions.length === 0) {
        return [];
      }

      const updates: PositionStatusUpdate[] = [];

      // Group positions by user to batch blockchain calls
      const positionsByUser = new Map<number, string[]>();
      const positionLookup = new Map<string, typeof dbPositions[0]>();

      for (const pos of dbPositions) {
        positionLookup.set(pos.nftTokenId, pos);
        
        // Skip positions with null userId
        if (pos.userId === null) continue;
        
        if (!positionsByUser.has(pos.userId)) {
          positionsByUser.set(pos.userId, []);
        }
        positionsByUser.get(pos.userId)!.push(pos.nftTokenId);
      }

      // Get user addresses
      const userIds = Array.from(positionsByUser.keys());
      const userRecords = await db
        .select({ id: users.id, address: users.address })
        .from(users)
        .where(inArray(users.id, userIds));

      // Dynamic import to avoid circular dependency
      const { uniswapIntegrationService } = await import('./uniswap-integration-service');

      // Sync positions for each user
      for (const user of userRecords) {
        const userPositionIds = positionsByUser.get(user.id) || [];
        const onChainPositions = await uniswapIntegrationService.getUserPositions(user.address);
        
        // Create a map of on-chain positions by tokenId
        const onChainMap = new Map();
        for (const onChainPos of onChainPositions) {
          onChainMap.set(onChainPos.tokenId, onChainPos);
        }

        // Check each registered position
        for (const nftTokenId of userPositionIds) {
          const dbPosition = positionLookup.get(nftTokenId)!;
          const onChainPosition = onChainMap.get(nftTokenId);
          
          const wasActive = dbPosition.isActive;
          const isActiveOnChain = onChainPosition ? onChainPosition.isActive : false;

          if (wasActive !== isActiveOnChain) {
            const update: PositionStatusUpdate = {
              nftTokenId,
              previousStatus: wasActive ? 'ACTIVE' : 'CLOSED',
              newStatus: isActiveOnChain ? 'ACTIVE' : 'CLOSED',
              liquidityAmount: onChainPosition?.liquidity || '0',
              reason: isActiveOnChain ? 'LIQUIDITY_ADDED' : 'LIQUIDITY_REMOVED'
            };

            updates.push(update);

            // Update database
            await db
              .update(lpPositions)
              .set({
                isActive: isActiveOnChain,
                liquidity: onChainPosition?.liquidity || '0'
              })
              .where(eq(lpPositions.nftTokenId, nftTokenId));
          }
        }
      }

      if (updates.length > 0) {
        console.log(`✅ Position lifecycle sync completed - ${updates.length} positions updated`);
        for (const update of updates) {
          console.log(`📍 Position ${update.nftTokenId}: ${update.previousStatus} → ${update.newStatus} (${update.reason})`);
        }
      } else {
        console.log('✅ Position lifecycle sync completed - no changes needed');
      }

      return updates;

    } catch (error) {
      console.error('❌ Position lifecycle sync failed:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Sync positions for a specific user
   */
  async syncUserPositions(userAddress: string): Promise<PositionStatusUpdate[]> {
    try {
      console.log(`🔄 Syncing positions for user: ${userAddress}`);

      // Get user record
      const user = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.address, userAddress))
        .limit(1);

      if (user.length === 0) {
        return [];
      }

      // Get user's registered positions
      const dbPositions = await db
        .select({
          nftTokenId: lpPositions.nftTokenId,
          isActive: lpPositions.isActive,
          liquidity: lpPositions.liquidity
        })
        .from(lpPositions)
        .where(eq(lpPositions.userId, user[0].id));

      if (dbPositions.length === 0) {
        return [];
      }

      // Get on-chain positions
      const { uniswapIntegrationService } = await import('./uniswap-integration-service');
      const onChainPositions = await uniswapIntegrationService.getUserPositions(userAddress);
      const onChainMap = new Map();
      for (const pos of onChainPositions) {
        onChainMap.set(pos.tokenId, pos);
      }

      const updates: PositionStatusUpdate[] = [];

      // Check each registered position
      for (const dbPosition of dbPositions) {
        const onChainPosition = onChainMap.get(dbPosition.nftTokenId);
        const wasActive = dbPosition.isActive;
        const isActiveOnChain = onChainPosition ? onChainPosition.isActive : false;

        if (wasActive !== isActiveOnChain) {
          const update: PositionStatusUpdate = {
            nftTokenId: dbPosition.nftTokenId,
            previousStatus: wasActive ? 'ACTIVE' : 'CLOSED',
            newStatus: isActiveOnChain ? 'ACTIVE' : 'CLOSED',
            liquidityAmount: onChainPosition?.liquidity || '0',
            reason: isActiveOnChain ? 'LIQUIDITY_ADDED' : 'LIQUIDITY_REMOVED'
          };

          updates.push(update);

          // Update database
          await db
            .update(lpPositions)
            .set({
              isActive: isActiveOnChain,
              liquidity: onChainPosition?.liquidity || '0'
            })
            .where(
              and(
                eq(lpPositions.userId, user[0].id),
                eq(lpPositions.nftTokenId, dbPosition.nftTokenId)
              )
            );
        }
      }

      console.log(`✅ User position sync completed - ${updates.length} positions updated`);
      return updates;

    } catch (error) {
      console.error(`❌ User position sync failed for ${userAddress}:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Get active positions count for reward calculations
   */
  async getActivePositionsCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: lpPositions.nftTokenId })
        .from(lpPositions)
        .where(eq(lpPositions.isActive, true));
        
      return result.length;
    } catch (error) {
      console.error('Error getting active positions count:', error);
      return 0;
    }
  }

  /**
   * Get user's active positions only
   */
  async getUserActivePositions(userAddress: string) {
    try {
      const user = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.address, userAddress))
        .limit(1);

      if (user.length === 0) {
        return [];
      }

      return await db
        .select()
        .from(lpPositions)
        .where(
          and(
            eq(lpPositions.userId, user[0].id),
            eq(lpPositions.isActive, true)
          )
        );
    } catch (error) {
      console.error('Error getting user active positions:', error);
      return [];
    }
  }
}

// Export singleton instance
export const positionLifecycleManager = new PositionLifecycleManager();