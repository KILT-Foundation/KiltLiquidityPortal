/**
 * Data Integrity Monitor Service
 * Prevents and detects database corruption issues
 */

import { eq, isNull, and } from "drizzle-orm";
import { lpPositions, positionEligibility } from "@shared/schema";

export class DataIntegrityMonitor {
  constructor(private db: any) {}

  /**
   * Checks for orphaned eligibility records (eligibility without positions)
   * This was the root cause of the original issue
   */
  async checkOrphanedEligibilityRecords(): Promise<{
    orphanedCount: number;
    orphanedRecords: any[];
    isHealthy: boolean;
  }> {
    try {
      // Find eligibility records where the referenced position doesn't exist
      const orphanedRecords = await this.db
        .select({
          eligibilityId: positionEligibility.id,
          positionId: positionEligibility.positionId,
          nftTokenId: positionEligibility.nftTokenId,
          eligibilityCheckedAt: positionEligibility.eligibilityCheckedAt
        })
        .from(positionEligibility)
        .leftJoin(lpPositions, eq(positionEligibility.positionId, lpPositions.id))
        .where(isNull(lpPositions.id));

      const orphanedCount = orphanedRecords.length;
      const isHealthy = orphanedCount === 0;

      if (!isHealthy) {
        console.error(`❌ DATA INTEGRITY ISSUE: Found ${orphanedCount} orphaned eligibility records`);
        console.error('Orphaned records:', orphanedRecords);
      } else {
        console.log('✅ Data integrity check passed: No orphaned eligibility records');
      }

      return {
        orphanedCount,
        orphanedRecords,
        isHealthy
      };

    } catch (error) {
      console.error('❌ Failed to check data integrity:', error);
      return {
        orphanedCount: -1,
        orphanedRecords: [],
        isHealthy: false
      };
    }
  }

  /**
   * Checks for positions without eligibility records
   */
  async checkPositionsWithoutEligibility(): Promise<{
    missingEligibilityCount: number;
    missingRecords: any[];
    isHealthy: boolean;
  }> {
    try {
      const missingRecords = await this.db
        .select({
          positionId: lpPositions.id,
          nftTokenId: lpPositions.nftTokenId,
          userId: lpPositions.userId,
          isActive: lpPositions.isActive
        })
        .from(lpPositions)
        .leftJoin(positionEligibility, eq(lpPositions.id, positionEligibility.positionId))
        .where(isNull(positionEligibility.id));

      const missingEligibilityCount = missingRecords.length;
      const isHealthy = missingEligibilityCount === 0;

      if (!isHealthy) {
        console.error(`❌ DATA INTEGRITY ISSUE: Found ${missingEligibilityCount} positions without eligibility records`);
        console.error('Positions missing eligibility:', missingRecords);
      }

      return {
        missingEligibilityCount,
        missingRecords,
        isHealthy
      };

    } catch (error) {
      console.error('❌ Failed to check positions eligibility:', error);
      return {
        missingEligibilityCount: -1,
        missingRecords: [],
        isHealthy: false
      };
    }
  }

  /**
   * Cross-validates database positions against real blockchain data
   */
  async validateAgainstBlockchain(): Promise<{
    isHealthy: boolean;
    issues: string[];
    validatedPositions: number;
    blockchainMismatches: number;
  }> {
    const issues: string[] = [];
    let validatedPositions = 0;
    let blockchainMismatches = 0;

    try {
      // Get all active positions from database
      const positions = await this.db.select().from(lpPositions).where(eq(lpPositions.isActive, true));
      
      // Import uniswap service for blockchain validation
      const { uniswapIntegrationService } = await import('./uniswap-integration-service');
      
      for (const position of positions) {
        validatedPositions++;
        
        try {
          // Get real blockchain data for this position
          const blockchainData = await uniswapIntegrationService.getFullPositionData(position.nftTokenId);
          
          if (!blockchainData) {
            blockchainMismatches++;
            issues.push(`Position ${position.nftTokenId} not found on blockchain but marked active in database`);
          } else {
            // Check if blockchain state matches database state
            const blockchainIsActive = blockchainData.isActive && parseFloat(blockchainData.liquidity) > 0;
            const databaseIsActive = position.isActive;
            
            if (blockchainIsActive !== databaseIsActive) {
              blockchainMismatches++;
              issues.push(`Position ${position.nftTokenId} state mismatch: DB=${databaseIsActive}, Blockchain=${blockchainIsActive}`);
            }
          }
        } catch (error) {
          console.error(`Failed to validate position ${position.nftTokenId} against blockchain:`, error);
          issues.push(`Could not validate position ${position.nftTokenId} against blockchain`);
        }
      }

      const isHealthy = blockchainMismatches === 0;
      
      if (isHealthy) {
        console.log(`✅ Blockchain validation passed: ${validatedPositions} positions verified`);
      } else {
        console.error(`❌ Blockchain validation failed: ${blockchainMismatches} mismatches found`);
      }

      return {
        isHealthy,
        issues,
        validatedPositions,
        blockchainMismatches
      };

    } catch (error) {
      console.error('❌ Blockchain validation check failed:', error);
      return {
        isHealthy: false,
        issues: ['Blockchain validation check execution failed'],
        validatedPositions: 0,
        blockchainMismatches: -1
      };
    }
  }

  /**
   * Comprehensive health check
   */
  async performHealthCheck(): Promise<{
    isHealthy: boolean;
    issues: string[];
    totalPositions: number;
    totalEligibilityRecords: number;
    blockchainValidation: any;
  }> {
    const issues: string[] = [];
    
    try {
      // Count total records
      const [totalPositions] = await this.db
        .select({ count: "COUNT(*)" })
        .from(lpPositions);
      
      const [totalEligibilityRecords] = await this.db
        .select({ count: "COUNT(*)" })
        .from(positionEligibility);

      // Check for orphaned eligibility records
      const orphanedCheck = await this.checkOrphanedEligibilityRecords();
      if (!orphanedCheck.isHealthy) {
        issues.push(`${orphanedCheck.orphanedCount} orphaned eligibility records`);
      }

      // Check for positions without eligibility
      const missingEligibilityCheck = await this.checkPositionsWithoutEligibility();
      if (!missingEligibilityCheck.isHealthy) {
        issues.push(`${missingEligibilityCheck.missingEligibilityCount} positions without eligibility`);
      }

      // CRITICAL: Validate against real blockchain data
      const blockchainValidation = await this.validateAgainstBlockchain();
      if (!blockchainValidation.isHealthy) {
        issues.push(...blockchainValidation.issues);
      }

      const isHealthy = issues.length === 0;

      if (isHealthy) {
        console.log('✅ Database health check passed - all integrity constraints satisfied');
      } else {
        console.error('❌ Database health check failed with issues:', issues);
      }

      return {
        isHealthy,
        issues,
        totalPositions: parseInt(totalPositions.count),
        totalEligibilityRecords: parseInt(totalEligibilityRecords.count),
        blockchainValidation
      };

    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        isHealthy: false,
        issues: ['Health check execution failed'],
        totalPositions: 0,
        totalEligibilityRecords: 0,
        blockchainValidation: {
          isHealthy: false,
          issues: ['Health check failed'],
          validatedPositions: 0,
          blockchainMismatches: -1
        }
      };
    }
  }

  /**
   * Automatic monitoring - runs periodically
   */
  startPeriodicMonitoring(intervalMinutes: number = 30): NodeJS.Timeout {
    console.log(`🔍 Starting data integrity monitoring (every ${intervalMinutes} minutes)`);
    
    return setInterval(async () => {
      console.log('🔍 Running periodic data integrity check...');
      const healthCheck = await this.performHealthCheck();
      
      if (!healthCheck.isHealthy) {
        console.error('❌ URGENT: Data integrity issues detected during periodic check');
        console.error('Issues:', healthCheck.issues);
        // In production, this could trigger alerts or automatic recovery
      }
    }, intervalMinutes * 60 * 1000);
  }
}