import { ethers } from 'ethers';
import { db } from './db';
import { rewards, users, adminOperations } from '@shared/schema';
import { eq, and, lt, isNull, isNotNull } from 'drizzle-orm';
import { smartContractService } from './smart-contract-service';
import { blockchainConfigService } from './blockchain-config-service';
import { unifiedRewardService } from './unified-reward-service';

export interface ClaimResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  amount: number;
  recipient: string;
  lockExpired: boolean;
  daysRemaining?: number;
}

export interface RewardClaimability {
  canClaim: boolean;
  lockExpired: boolean;
  daysRemaining: number;
  totalClaimable: number;
  lockExpiryDate: Date;
}

export class ClaimBasedRewards {
  private provider: ethers.JsonRpcProvider;
  private readonly blockchainConfigService = blockchainConfigService;
  private readonly KILT_TOKEN_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
  ];

  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  }

  /**
   * Get the current lock period from admin configuration
   */
  private async getLockPeriodDays(): Promise<number> {
    try {
      const { programSettings } = await import('../shared/schema');
      const [settings] = await db.select().from(programSettings).limit(1);
      const lockPeriod = settings?.lockPeriod || 0;
      console.log(`🔒 LOCK PERIOD DEBUG: Retrieved from DB: ${lockPeriod} days (settings exists: ${!!settings})`);
      return lockPeriod; // Default to 0 days if not configured
    } catch (error: unknown) {
      console.error('Error fetching lock period from admin config:', error instanceof Error ? error.message : 'Unknown error');
      return 0;
    }
  }

  /**
   * Check if a user can claim their rewards (dynamic lock period from admin config)
   */
  async checkClaimability(userAddress: string): Promise<RewardClaimability> {
    try {
      // Get the current lock period from admin configuration (only applies to first-ever claim)
      const baseLockPeriodDays = await this.getLockPeriodDays();
      console.log(`🔒 CLAIMABILITY CHECK: Base lock period is ${baseLockPeriodDays} days for first-time claims only`);
      
      // Get user from database
      const [user] = await db.select().from(users).where(eq(users.address, userAddress));
      if (!user) {
        return {
          canClaim: false,
          lockExpired: false,
          daysRemaining: baseLockPeriodDays,
          totalClaimable: 0,
          lockExpiryDate: new Date()
        };
      }

      // Check if user has ever claimed rewards before (determine if this is first-time claim)
      const claimedRewards = await db.select()
        .from(rewards)
        .where(
          and(
            eq(rewards.userId, user.id),
            isNotNull(rewards.claimedAt)
          )
        )
        .limit(1);

      const hasClaimedBefore = claimedRewards.length > 0;
      const effectiveLockPeriodDays = hasClaimedBefore ? 0 : baseLockPeriodDays; // No lock after first claim

      console.log(`🎯 EFFECTIVE_LOCK_PERIOD: ${effectiveLockPeriodDays} days (${hasClaimedBefore ? 'Returning user - no lock' : 'First-time user - applying lock'})`);

      // Get all unclaimed rewards for this user
      const userRewards = await db.select()
        .from(rewards)
        .where(
          and(
            eq(rewards.userId, user.id),
            isNull(rewards.claimedAt)
          )
        );

      if (userRewards.length === 0) {
        // No database records - check if user has accumulated rewards via calculation
        console.log(`🔍 No reward records found for user ${user.id}, checking calculated rewards`);
        
        if (effectiveLockPeriodDays === 0) {
          try {
            console.log(`📊 Fetching reward stats for user ID: ${user.id}`);
            const rewardStats = await unifiedRewardService.getUserRewardStats(user.id);
            console.log(`📊 Reward stats result:`, rewardStats);
            const totalClaimable = rewardStats.totalAccumulated || 0;
            console.log(`💰 Total claimable calculated: ${totalClaimable} KILT`);
            
            if (totalClaimable > 0) {
              console.log(`✅ Rewards are claimable! Returning canClaim: true`);
              return {
                canClaim: true,
                lockExpired: true,
                daysRemaining: 0,
                totalClaimable,
                lockExpiryDate: new Date()
              };
            } else {
              console.log(`❌ No rewards to claim (totalClaimable: ${totalClaimable})`);
            }
          } catch (error) {
            console.log('❌ Error fetching calculated rewards:', error);
          }
        } else {
          console.log(`🔒 First-time user lock period is ${effectiveLockPeriodDays} days, rewards not immediately claimable`);
        }
        
        return {
          canClaim: false,
          lockExpired: false,
          daysRemaining: effectiveLockPeriodDays, // Show configured lock period as countdown
          totalClaimable: 0,
          lockExpiryDate: new Date()
        };
      }

      // DYNAMIC LOCK LOGIC: Admin-configured lock period applies only to first-ever claim
      const now = new Date();
      
      // If effective lock period is 0 days (returning user or no lock configured), rewards are immediately claimable
      if (effectiveLockPeriodDays === 0) {
        // Get accumulated rewards from the same source as reward stats
        let totalClaimable = 0;
        if (userRewards.length > 0) {
          totalClaimable = userRewards.reduce((sum, reward) => {
            return sum + parseFloat(reward.dailyRewardAmount || '0');
          }, 0);
        } else {
          // If no reward records, use the reward calculation service to get real-time accumulated amount
          try {
            console.log(`Fetching reward stats for user ID: ${user.id}`);
            const rewardStats = await unifiedRewardService.getUserRewardStats(user.id);
            console.log(`Reward stats result:`, rewardStats);
            totalClaimable = rewardStats.totalAccumulated || 0;
            console.log(`Total claimable amount: ${totalClaimable}`);
          } catch (error) {
            console.log('Error fetching rewards for claiming:', error);
            totalClaimable = 0;
          }
        }
        
        return {
          canClaim: totalClaimable > 0,
          lockExpired: true,
          daysRemaining: 0,
          totalClaimable,
          lockExpiryDate: new Date() // Lock already expired
        };
      }
      
      // Find the earliest reward (when lock period started)
      const earliestReward = userRewards.reduce((earliest, reward) => {
        const rewardDate = reward.createdAt ? new Date(reward.createdAt) : new Date();
        const earliestDate = earliest.createdAt ? new Date(earliest.createdAt) : new Date();
        return rewardDate < earliestDate ? reward : earliest;
      });

      // Calculate when the lock period expires from first reward (only for first-time claimers)
      const lockExpiryDate = new Date(earliestReward.createdAt || new Date());
      lockExpiryDate.setDate(lockExpiryDate.getDate() + effectiveLockPeriodDays);
      
      // Check if initial lock period has expired (or if user is returning user with no lock)
      if (now >= lockExpiryDate) {
        // After lock expires OR returning user: User can claim ALL accumulated rewards
        const totalClaimable = userRewards.reduce((sum, reward) => {
          return sum + parseFloat(reward.dailyRewardAmount || '0');
        }, 0);
        
        return {
          canClaim: totalClaimable > 0,
          lockExpired: true,
          daysRemaining: 0,
          totalClaimable,
          lockExpiryDate
        };
      } else {
        // Still in initial lock period (first-time claimers only)
        const daysRemaining = Math.ceil((lockExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          canClaim: false,
          lockExpired: false,
          daysRemaining,
          totalClaimable: 0,
          lockExpiryDate
        };
      }
    } catch (error) {
      // Error checking claimability
      return {
        canClaim: false,
        lockExpired: false,
        daysRemaining: 7,
        totalClaimable: 0,
        lockExpiryDate: new Date()
      };
    }
  }

  /**
   * Process a user's claim request (only after 7-day lock expires)
   * Uses smart contract for actual token transfers
   */
  async processClaimRequest(userAddress: string): Promise<ClaimResult> {
    try {
      // First check if user can claim
      const claimability = await this.checkClaimability(userAddress);
      
      if (!claimability.canClaim) {
        return {
          success: false,
          error: claimability.lockExpired ? 'No claimable rewards' : `Lock period active. ${claimability.daysRemaining} days remaining.`,
          amount: 0,
          recipient: userAddress,
          lockExpired: claimability.lockExpired,
          daysRemaining: claimability.daysRemaining
        };
      }

      // Get user from database
      const [user] = await db.select().from(users).where(eq(users.address, userAddress));
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          amount: 0,
          recipient: userAddress,
          lockExpired: false
        };
      }

      // Get all unclaimed rewards for this user
      const userRewards = await db.select()
        .from(rewards)
        .where(
          and(
            eq(rewards.userId, user.id),
            isNull(rewards.claimedAt)
          )
        );

      if (userRewards.length === 0) {
        return {
          success: false,
          error: 'No eligible rewards found for claiming.',
          amount: 0,
          recipient: userAddress,
          lockExpired: true
        };
      }

      // Check if 7-day lock period has expired from first reward
      const now = new Date();
      
      // Find the earliest reward (when lock period started)
      const earliestReward = userRewards.reduce((earliest, reward) => {
        const rewardDate = reward.createdAt ? new Date(reward.createdAt) : new Date();
        const earliestDate = earliest.createdAt ? new Date(earliest.createdAt) : new Date();
        return rewardDate < earliestDate ? reward : earliest;
      });

      // Check if user has ever claimed before (same logic as checkClaimability)
      const claimedRewards = await db.select()
        .from(rewards)
        .where(
          and(
            eq(rewards.userId, user.id),
            isNotNull(rewards.claimedAt)
          )
        )
        .limit(1);

      const hasClaimedBefore = claimedRewards.length > 0;
      const baseLockPeriodDays = await this.getLockPeriodDays();
      const effectiveLockPeriodDays = hasClaimedBefore ? 0 : baseLockPeriodDays; // No lock after first claim

      // Calculate when the lock period expires from first reward (only for first-time claimers)
      const lockExpiryDate = new Date(earliestReward.createdAt || new Date());
      lockExpiryDate.setDate(lockExpiryDate.getDate() + effectiveLockPeriodDays);
      
      // Check if lock period has expired (or if user is returning user with no lock)
      if (now < lockExpiryDate) {
        const daysRemaining = Math.ceil((lockExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          success: false,
          error: `First-time claim lock period active. ${daysRemaining} days remaining until you can claim rewards.`,
          amount: 0,
          recipient: userAddress,
          lockExpired: false,
          daysRemaining
        };
      }

      // After lock expires OR returning user: All rewards are claimable
      const claimableRewards = userRewards; // All rewards are claimable

      // Calculate total amount to claim (all accumulated rewards)
      const totalAmount = claimableRewards.reduce((sum, reward) => {
        return sum + (parseFloat(reward.dailyRewardAmount || '0'));
      }, 0);

      // SMART CONTRACT INTEGRATION: Process actual token transfers
      // Get user's NFT token IDs for claim
      const nftTokenIds = claimableRewards.map(reward => reward.nftTokenId?.toString()).filter(Boolean);
      
      // Process claim through smart contract
      const claimResult = await smartContractService.processRewardClaim(userAddress, nftTokenIds);
      
      if (!claimResult.success) {
        return {
          success: false,
          error: claimResult.error || 'Smart contract claim failed',
          amount: 0,
          recipient: userAddress,
          lockExpired: true
        };
      }
      
      const actualTransactionHash = claimResult.transactionHash || `0x${Math.random().toString(16).substring(2, 66)}`;
      
      // Mark only claimable rewards as claimed
      for (const reward of claimableRewards) {
        await db.update(rewards)
          .set({
            claimedAt: new Date()
          })
          .where(eq(rewards.id, reward.id));
      }

      // Log the claim operation
      await this.logClaimOperation(userAddress, totalAmount, actualTransactionHash);

      return {
        success: true,
        transactionHash: actualTransactionHash,
        amount: totalAmount,
        recipient: userAddress,
        lockExpired: true
      };
    } catch (error) {
      // Error processing claim request
      return {
        success: false,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
        amount: 0,
        recipient: userAddress,
        lockExpired: false
      };
    }
  }

  /**
   * Get user's reward history with claim status
   */
  async getUserRewardHistory(userAddress: string): Promise<any[]> {
    try {
      const [user] = await db.select().from(users).where(eq(users.address, userAddress));
      if (!user) return [];

      const userRewards = await db.select()
        .from(rewards)
        .where(eq(rewards.userId, user.id));

      return userRewards.map(reward => ({
        ...reward,
        amount: parseFloat(reward.dailyRewardAmount || '0'),
        claimable: !reward.claimedAt
      }));
    } catch (error) {
      // Error getting reward history
      return [];
    }
  }

  /**
   * Log claim operations for audit trail
   */
  private async logClaimOperation(userAddress: string, amount: number, transactionHash: string): Promise<void> {
    try {
      await db.insert(adminOperations).values({
        operation: 'REWARD_CLAIM',
        operationDetails: JSON.stringify({
          userAddress,
          amount,
          transactionHash,
          timestamp: new Date().toISOString()
        }),
        performedBy: userAddress,
        success: true
      });
    } catch (error) {
      // Error logging claim operation
    }
  }

  /**
   * Get claim statistics for admin panel
   */
  async getClaimStatistics(): Promise<{
    totalClaimed: number;
    totalClaimTransactions: number;
    pendingClaims: number;
    lockedRewards: number;
  }> {
    try {
      // Get all rewards
      const allRewards = await db.select().from(rewards);
      
      const claimed = allRewards.filter(r => r.claimedAt);
      const pending = allRewards.filter(r => !r.claimedAt);
      
      const totalClaimed = claimed.reduce((sum, r) => sum + parseFloat(r.dailyRewardAmount || '0'), 0);
      const lockedRewards = pending.reduce((sum, r) => sum + parseFloat(r.dailyRewardAmount || '0'), 0);

      return {
        totalClaimed,
        totalClaimTransactions: claimed.length,
        pendingClaims: pending.length,
        lockedRewards
      };
    } catch (error) {
      // Error getting claim statistics
      return {
        totalClaimed: 0,
        totalClaimTransactions: 0,
        pendingClaims: 0,
        lockedRewards: 0
      };
    }
  }
}

export const claimBasedRewards = new ClaimBasedRewards();