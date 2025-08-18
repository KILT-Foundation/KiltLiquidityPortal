/**
 * POSITION LIFECYCLE SERVICE
 * Automatically manages position states for all users:
 * - Detects burned/closed positions and updates database
 * - Identifies positions needing Step 2 token collection
 * - Handles position state transitions dynamically
 */

import { storage } from "./storage";
import { PositionStateManager, PositionStateContext } from './position-state-manager';

interface PositionStateChange {
  tokenId: string;
  userId: number;
  oldState: 'active' | 'inactive' | 'unknown';
  newState: 'active' | 'inactive' | 'burned';
  needsStep2: boolean;
  reason: string;
}

class PositionLifecycleService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start automatic position lifecycle management
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Position Lifecycle Service started - monitoring all user positions');
    
    // Run initial check
    this.checkAllUserPositions();
    
    // Run every 2 minutes to detect position changes
    this.intervalId = setInterval(() => {
      this.checkAllUserPositions();
    }, 2 * 60 * 1000);
  }

  /**
   * Stop the automatic position lifecycle management
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Position Lifecycle Service stopped');
  }

  /**
   * Check positions for all users in the system
   */
  private async checkAllUserPositions() {
    try {
      console.log('🔍 Scanning all user positions for lifecycle changes...');
      
      // Get all users with registered positions
      const allUsers = await storage.getAllUsers();
      const usersWithPositions = [];
      
      for (const user of allUsers) {
        // Skip users with invalid wallet addresses
        if (!user.address || user.address === 'undefined' || !user.address.startsWith('0x')) {
          continue;
        }
        
        const positions = await storage.getLpPositionsByUserId(user.id);
        if (positions.length > 0) {
          usersWithPositions.push({
            user,
            positions: positions // Check ALL positions, not just active ones
          });
        }
      }
      
      console.log(`👥 Found ${usersWithPositions.length} users with ${usersWithPositions.reduce((sum, u) => sum + u.positions.length, 0)} active positions to check`);
      
      // Process users in batches to avoid overwhelming the blockchain
      const batchSize = 3;
      for (let i = 0; i < usersWithPositions.length; i += batchSize) {
        const batch = usersWithPositions.slice(i, i + batchSize);
        await Promise.all(batch.map(({ user, positions }) => 
          this.checkUserPositions(user.address, user.id, positions)
        ));
        
        // Small delay between batches
        if (i + batchSize < usersWithPositions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
    } catch (error) {
      console.error('❌ Error in position lifecycle check:', error);
    }
  }

  /**
   * Check positions for a specific user
   */
  private async checkUserPositions(userAddress: string, userId: number, dbPositions: any[]) {
    try {
      const { uniswapIntegrationService } = await import('./uniswap-integration-service');
      
      // Get current blockchain state
      const blockchainPositions = await uniswapIntegrationService.getUserPositions(userAddress);
      const blockchainPositionMap = new Map(
        blockchainPositions.map(p => [p.tokenId, p])
      );
      
      const stateChanges: PositionStateChange[] = [];
      
      // Check each registered position
      for (const dbPosition of dbPositions) {
        const tokenId = dbPosition.nftTokenId;
        const blockchainPosition = blockchainPositionMap.get(tokenId);
        
        if (!blockchainPosition) {
          // CRITICAL FIX: Don't immediately assume position is burned
          // Could be RPC failure, rate limit, or temporary blockchain connectivity issue
          console.warn(`⚠️ LIFECYCLE: Position ${tokenId} not found on blockchain - checking if this is a temporary issue...`);
          
          // Only mark as burned if we can confirm the position doesn't exist after multiple checks
          // For now, skip this position to prevent accidental deletion due to RPC issues
          console.log(`🔒 LIFECYCLE: Skipping position ${tokenId} to prevent accidental deletion (RPC issues suspected)`);
          continue;
        } else {
          // Position exists - check liquidity state AND USD value
          const hasLiquidity = blockchainPosition.liquidity && BigInt(blockchainPosition.liquidity) > 0n;
          const hasUnclaimedTokens = this.hasUnclaimedTokens(blockchainPosition);
          
          // Get current position from database to check USD value
          const dbPosition = dbPositions.find(p => p.nftTokenId === tokenId);
          
          // USE UNIFIED STATE MANAGER - Single source of truth for ALL position state decisions
          const stateContext: PositionStateContext = {
            tokenId,
            hasBlockchainLiquidity: Boolean(hasLiquidity),
            blockchainLiquidity: blockchainPosition.liquidity || '0',
            currentValueUSD: dbPosition?.currentValueUSD || null,
            hasUnclaimedTokens,
            isOnBlockchain: true
          };
          
          const expectedState = PositionStateManager.determinePositionState(stateContext);
          const needsStep2 = PositionStateManager.needsStep2(stateContext);
          
          // Only create state change if database state differs from expected state
          const currentDbState = dbPosition?.isActive ? 'active' : 'inactive';
          
          if (expectedState === 'active' && currentDbState === 'inactive') {
            stateChanges.push({
              tokenId, userId, oldState: 'inactive', newState: 'active', needsStep2: false,
              reason: 'Position should be active (liquidity or significant value)'
            });
          } else if (expectedState === 'inactive' && currentDbState === 'active') {
            stateChanges.push({
              tokenId, userId, oldState: 'active', newState: 'inactive', needsStep2,
              reason: needsStep2 ? 'Zero liquidity with unclaimed tokens (Step 2 needed)' : 'Position fully closed'
            });
          } else {
            console.log(`🔄 LIFECYCLE: Position ${tokenId} state correct (${expectedState})`);
          }
        }
      }
      
      // Apply state changes
      if (stateChanges.length > 0) {
        await this.applyStateChanges(stateChanges);
      }
      
    } catch (error) {
      console.error(`❌ Error checking positions for user ${userAddress}:`, error);
    }
  }

  /**
   * Check if a position has unclaimed tokens (fees or remaining tokens)
   */
  private hasUnclaimedTokens(position: any): boolean {
    try {
      // Check if position has unclaimed fees
      if (position.fees) {
        const token0Fees = parseFloat(position.fees.token0 || '0');
        const token1Fees = parseFloat(position.fees.token1 || '0');
        if (token0Fees > 0 || token1Fees > 0) {
          return true;
        }
      }
      
      // Check for tokensOwed (remaining tokens after liquidity removal)
      if (position.tokensOwed0 && BigInt(position.tokensOwed0) > 0n) return true;
      if (position.tokensOwed1 && BigInt(position.tokensOwed1) > 0n) return true;
      
      return false;
    } catch (error) {
      console.warn(`⚠️ Error checking unclaimed tokens for position ${position.tokenId}:`, error);
      return false;
    }
  }

  /**
   * Apply detected state changes to the database
   */
  private async applyStateChanges(stateChanges: PositionStateChange[]) {
    try {
      console.log(`🔄 Applying ${stateChanges.length} position state changes:`);
      
      for (const change of stateChanges) {
        console.log(`   ${change.tokenId}: ${change.oldState} → ${change.newState} (${change.reason})`);
        
        if (change.newState === 'burned') {
          // CRITICAL PROTECTION: Only delete positions if we're absolutely certain they're burned
          // This prevents accidental deletion due to RPC failures
          console.warn(`🚨 LIFECYCLE: Position ${change.tokenId} marked for deletion - requiring manual confirmation`);
          console.warn(`🔒 LIFECYCLE: Position deletion temporarily disabled to prevent data loss from RPC issues`);
          // TODO: Implement safer burn detection with multiple confirmation checks
          // await storage.deleteLpPosition(change.tokenId);
        } else if (change.newState === 'active') {
          // Make position active AND reward eligible using unified state manager
          await storage.updateLpPositionByTokenId(change.tokenId, { isActive: true });
          await storage.updateLpPositionRewardEligibility(change.tokenId, true);
          console.log(`✅ Position ${change.tokenId} marked as active and reward eligible (${change.reason})`);
        } else if (change.newState === 'inactive') {
          // Handle inactive state with unified eligibility logic
          await storage.updateLpPositionByTokenId(change.tokenId, { isActive: false });
          
          const position = await storage.getLpPositionByNftTokenId(change.tokenId);
          const stateContext: PositionStateContext = {
            tokenId: change.tokenId,
            hasBlockchainLiquidity: false,
            blockchainLiquidity: '0',
            currentValueUSD: position?.currentValueUSD || null,
            hasUnclaimedTokens: change.needsStep2,
            isOnBlockchain: true
          };
          
          const shouldBeRewardEligible = PositionStateManager.isRewardEligible(stateContext);
          await storage.updateLpPositionRewardEligibility(change.tokenId, shouldBeRewardEligible);
          
          if (shouldBeRewardEligible) {
            console.log(`⚠️ Position ${change.tokenId} marked as inactive but kept reward eligible (value: $${position?.currentValueUSD})`);
          } else {
            console.log(`❌ Position ${change.tokenId} marked as inactive and ineligible (no significant value)`);
          }
        }
        
        // Log Step 2 notifications for monitoring
        if (change.needsStep2) {
          console.log(`💡 Position ${change.tokenId} needs Step 2 completion - user will see notification in UI`);
        }
      }
      
      console.log(`✅ Successfully applied ${stateChanges.length} position state changes`);
      
    } catch (error) {
      console.error('❌ Error applying position state changes:', error);
    }
  }

  /**
   * Manually trigger position check for a specific user
   */
  async checkSpecificUser(userAddress: string) {
    try {
      const user = await storage.getUserByAddress(userAddress);
      if (!user) {
        console.log(`❌ User not found: ${userAddress}`);
        return;
      }
      
      const positions = await storage.getLpPositionsByUserId(user.id);
      const activePositions = positions.filter(p => p.isActive === true);
      
      if (activePositions.length === 0) {
        console.log(`📍 No active positions found for user ${userAddress}`);
        return;
      }
      
      console.log(`🔍 Checking ${activePositions.length} active positions for user ${userAddress}`);
      await this.checkUserPositions(userAddress, user.id, activePositions);
      
    } catch (error) {
      console.error(`❌ Error checking specific user ${userAddress}:`, error);
    }
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null
    };
  }
}

// Create singleton instance
export const positionLifecycleService = new PositionLifecycleService();

// Auto-start the service when the module is imported
positionLifecycleService.start();