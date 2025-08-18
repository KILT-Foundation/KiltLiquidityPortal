/**
 * BLOCKCHAIN SYNC VALIDATOR
 * Prevents database desync issues at scale by:
 * - Cross-validating database state against blockchain reality
 * - Detecting and correcting sync discrepancies automatically
 * - Providing fail-safe mechanisms for data integrity
 * - Monitoring sync health across all users
 */

import { storage } from "./storage";
import { uniswapIntegrationService } from "./uniswap-integration-service";

interface SyncDiscrepancy {
  tokenId: string;
  userId: number;
  userAddress: string;
  databaseState: 'active' | 'inactive';
  blockchainState: 'active' | 'closed' | 'burned';
  blockchainLiquidity: string;
  severity: 'critical' | 'warning' | 'info';
  autoFixed: boolean;
}

class BlockchainSyncValidator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private discrepancies: SyncDiscrepancy[] = [];

  /**
   * Start continuous sync validation
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Blockchain Sync Validator started - ensuring data integrity at scale');
    
    // Run initial validation
    this.validateAllPositions();
    
    // Run validation every 5 minutes
    this.intervalId = setInterval(() => {
      this.validateAllPositions();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop the sync validator
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Blockchain Sync Validator stopped');
  }

  /**
   * Validate all user positions against blockchain reality
   */
  private async validateAllPositions() {
    try {
      console.log('🔍 SYNC VALIDATOR: Starting comprehensive validation...');
      
      const allUsers = await storage.getAllUsers();
      let totalValidated = 0;
      let discrepanciesFound = 0;
      let autoFixed = 0;

      for (const user of allUsers) {
        // Skip invalid addresses
        if (!user.address || !user.address.startsWith('0x')) {
          continue;
        }

        try {
          const positions = await storage.getLpPositionsByUserId(user.id);
          
          for (const position of positions) {
            totalValidated++;
            
            // Get blockchain reality with error handling
            let blockchainPositions;
            try {
              blockchainPositions = await uniswapIntegrationService.getUserPositions(user.address);
            } catch (blockchainError) {
              console.warn(`⚠️ SYNC VALIDATOR: Failed to fetch blockchain data for user ${user.id} - skipping to prevent false alarms`);
              continue; // Skip this user's positions if blockchain fetch fails
            }
            const blockchainPosition = blockchainPositions.find(bp => bp.tokenId === position.nftTokenId);
            
            // UNIFIED POSITION STATE LOGIC:
            // Use the SAME logic as lifecycle service to determine position state
            let blockchainState: 'active' | 'closed' | 'burned';
            let blockchainLiquidity = '0';
            
            if (!blockchainPosition) {
              // CRITICAL SAFETY: Don't assume position is burned just because we can't find it
              // Could be RPC issues, rate limits, or temporary connectivity problems
              console.warn(`⚠️ SYNC VALIDATOR: Position ${position.nftTokenId} not found on blockchain - treating as temporary RPC issue`);
              continue; // Skip validation for this position to prevent false alarms
            } else {
              const hasLiquidity = blockchainPosition.isActive && parseFloat(blockchainPosition.liquidity) > 0;
              const hasSignificantValue = position.currentValueUSD && parseFloat(position.currentValueUSD.toString()) > 100;
              
              // Use SAME logic as lifecycle service: active if has liquidity OR significant value
              if (hasLiquidity || hasSignificantValue) {
                blockchainState = 'active';
                blockchainLiquidity = blockchainPosition.liquidity;
              } else {
                blockchainState = 'closed';
              }
            }
            
            // Check for discrepancy
            const databaseState = position.isActive ? 'active' : 'inactive';
            const hasDiscrepancy = this.detectDiscrepancy(databaseState, blockchainState);
            
            if (hasDiscrepancy) {
              const discrepancy: SyncDiscrepancy = {
                tokenId: position.nftTokenId,
                userId: user.id,
                userAddress: user.address,
                databaseState: databaseState,
                blockchainState: blockchainState,
                blockchainLiquidity: blockchainLiquidity,
                severity: this.getSeverity(databaseState, blockchainState),
                autoFixed: false
              };
              
              discrepanciesFound++;
              
              // Auto-fix critical discrepancies
              if (discrepancy.severity === 'critical') {
                const fixed = await this.autoFixDiscrepancy(discrepancy);
                discrepancy.autoFixed = fixed;
                if (fixed) autoFixed++;
              }
              
              this.discrepancies.push(discrepancy);
              
              console.log(`🚨 SYNC DISCREPANCY: Position ${position.nftTokenId} (User ${user.id})`);
              console.log(`   Database: ${databaseState} | Blockchain: ${blockchainState}`);
              console.log(`   Severity: ${discrepancy.severity} | Auto-fixed: ${discrepancy.autoFixed}`);
            }
          }
        } catch (userError) {
          console.error(`❌ SYNC VALIDATOR: Error validating user ${user.id}:`, userError);
        }
      }
      
      console.log(`✅ SYNC VALIDATOR: Validated ${totalValidated} positions across ${allUsers.length} users`);
      console.log(`📊 SYNC VALIDATOR: Found ${discrepanciesFound} discrepancies, auto-fixed ${autoFixed}`);
      
      // Clear old discrepancies (keep last 100)
      if (this.discrepancies.length > 100) {
        this.discrepancies = this.discrepancies.slice(-100);
      }
      
    } catch (error) {
      console.error('💥 SYNC VALIDATOR: Validation failed:', error);
    }
  }

  /**
   * Detect if there's a sync discrepancy
   */
  private detectDiscrepancy(databaseState: 'active' | 'inactive', blockchainState: 'active' | 'closed' | 'burned'): boolean {
    // Critical: Database shows active but blockchain shows closed/burned
    if (databaseState === 'active' && (blockchainState === 'closed' || blockchainState === 'burned')) {
      return true;
    }
    
    // Critical: Database shows inactive but blockchain shows active
    if (databaseState === 'inactive' && blockchainState === 'active') {
      return true;
    }
    
    return false;
  }

  /**
   * Determine severity of discrepancy
   */
  private getSeverity(databaseState: 'active' | 'inactive', blockchainState: 'active' | 'closed' | 'burned'): 'critical' | 'warning' | 'info' {
    // Both cases are critical as they affect reward calculations
    if ((databaseState === 'active' && blockchainState !== 'active') ||
        (databaseState === 'inactive' && blockchainState === 'active')) {
      return 'critical';
    }
    
    return 'info';
  }

  /**
   * Auto-fix critical discrepancies
   */
  private async autoFixDiscrepancy(discrepancy: SyncDiscrepancy): Promise<boolean> {
    try {
      console.log(`🔧 AUTO-FIX: Correcting position ${discrepancy.tokenId} for user ${discrepancy.userId}`);
      
      // Determine correct state based on blockchain reality
      const correctActiveState = discrepancy.blockchainState === 'active';
      
      // Update database to match blockchain
      const updated = await storage.updateLpPositionByTokenId(discrepancy.tokenId, {
        isActive: correctActiveState
      });
      
      if (updated) {
        console.log(`✅ AUTO-FIX: Position ${discrepancy.tokenId} corrected to ${correctActiveState ? 'active' : 'inactive'}`);
        return true;
      } else {
        console.error(`❌ AUTO-FIX: Failed to update position ${discrepancy.tokenId}`);
        return false;
      }
      
    } catch (error) {
      console.error(`💥 AUTO-FIX: Error fixing position ${discrepancy.tokenId}:`, error);
      return false;
    }
  }

  /**
   * Get validation health report
   */
  getHealthReport() {
    const totalDiscrepancies = this.discrepancies.length;
    const criticalCount = this.discrepancies.filter(d => d.severity === 'critical').length;
    const autoFixedCount = this.discrepancies.filter(d => d.autoFixed).length;
    const recentDiscrepancies = this.discrepancies.slice(-10);

    return {
      totalDiscrepancies,
      criticalCount,
      autoFixedCount,
      fixRate: totalDiscrepancies > 0 ? (autoFixedCount / totalDiscrepancies * 100).toFixed(1) : '100.0',
      recentDiscrepancies: recentDiscrepancies.map(d => ({
        tokenId: d.tokenId,
        userId: d.userId,
        severity: d.severity,
        autoFixed: d.autoFixed,
        issue: `DB:${d.databaseState} vs BC:${d.blockchainState}`
      })),
      isHealthy: criticalCount === 0,
      status: criticalCount === 0 ? 'HEALTHY' : `${criticalCount} CRITICAL ISSUES`
    };
  }

  /**
   * Force validation of specific user positions
   */
  async validateUserPositions(userAddress: string): Promise<SyncDiscrepancy[]> {
    console.log(`🔍 SYNC VALIDATOR: Force validation for ${userAddress}`);
    
    const user = await storage.getUserByAddress(userAddress);
    if (!user) {
      console.log(`❌ SYNC VALIDATOR: User ${userAddress} not found`);
      return [];
    }

    const positions = await storage.getLpPositionsByUserId(user.id);
    const userDiscrepancies: SyncDiscrepancy[] = [];

    for (const position of positions) {
      try {
        const blockchainPositions = await uniswapIntegrationService.getUserPositions(userAddress);
        const blockchainPosition = blockchainPositions.find(bp => bp.tokenId === position.nftTokenId);
        
        let blockchainState: 'active' | 'closed' | 'burned';
        let blockchainLiquidity = '0';
        
        if (!blockchainPosition) {
          blockchainState = 'burned';
        } else if (blockchainPosition.isActive && parseFloat(blockchainPosition.liquidity) > 0) {
          blockchainState = 'active';
          blockchainLiquidity = blockchainPosition.liquidity;
        } else {
          blockchainState = 'closed';
        }
        
        const databaseState = position.isActive ? 'active' : 'inactive';
        const hasDiscrepancy = this.detectDiscrepancy(databaseState, blockchainState);
        
        if (hasDiscrepancy) {
          const discrepancy: SyncDiscrepancy = {
            tokenId: position.nftTokenId,
            userId: user.id,
            userAddress: userAddress,
            databaseState: databaseState,
            blockchainState: blockchainState,
            blockchainLiquidity: blockchainLiquidity,
            severity: this.getSeverity(databaseState, blockchainState),
            autoFixed: false
          };
          
          // Auto-fix immediately for force validation
          if (discrepancy.severity === 'critical') {
            const fixed = await this.autoFixDiscrepancy(discrepancy);
            discrepancy.autoFixed = fixed;
          }
          
          userDiscrepancies.push(discrepancy);
        }
      } catch (error) {
        console.error(`❌ SYNC VALIDATOR: Error validating position ${position.nftTokenId}:`, error);
      }
    }

    console.log(`✅ SYNC VALIDATOR: Found ${userDiscrepancies.length} discrepancies for ${userAddress}`);
    return userDiscrepancies;
  }
}

// Export singleton instance
export const blockchainSyncValidator = new BlockchainSyncValidator();