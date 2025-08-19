import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { storage } from './storage';
import { db } from './db';
import { adminOperations } from '../shared/schema';

// ERC20 ABI for KILT token transfers
const KILT_TOKEN_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

interface RewardDistributionConfig {
  treasuryWalletAddress: string;
  treasuryPrivateKey?: string; // Only for automated distributions
  kiltTokenAddress: string;
  dailyRewardsCap: string;
  lockPeriodDays: number;
}

export class RewardDistributionService {
  private config: RewardDistributionConfig;
  private publicClient;
  private walletClient;

  constructor(config: RewardDistributionConfig) {
    this.config = config;
    
    // Base network client
    this.publicClient = createPublicClient({
      chain: base,
      transport: http('https://base-rpc.publicnode.com'),
    });

    // Wallet client for treasury operations (if private key provided)
    if (config.treasuryPrivateKey) {
      const account = privateKeyToAccount(config.treasuryPrivateKey as `0x${string}`);
      this.walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('https://base-rpc.publicnode.com'),
      });
    }
  }

  /**
   * Get treasury wallet KILT balance
   */
  async getTreasuryBalance(): Promise<string> {
    try {
      const balance = await this.publicClient.readContract({
        address: this.config.kiltTokenAddress as `0x${string}`,
        abi: KILT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [this.config.treasuryWalletAddress as `0x${string}`],
      });

      return formatEther(balance);
    } catch (error: unknown) {
      console.error('Failed to get treasury balance:', error instanceof Error ? error.message : 'Unknown error');
      return '0';
    }
  }

  /**
   * Distribute rewards to eligible users
   * This function should be called by admin panel or automated system
   */
  async distributeRewards(recipients: Array<{
    userAddress: string;
    amount: string;
    nftTokenId: string;
    reason: string;
  }>): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
    distributedAmount: string;
  }> {
    if (!this.walletClient) {
      return {
        success: false,
        error: 'Treasury wallet not configured for automated distributions',
        distributedAmount: '0'
      };
    }

    try {
      // Calculate total distribution amount
      const totalAmount = recipients.reduce((sum, recipient) => {
        return sum + parseFloat(recipient.amount);
      }, 0);

      // Check if distribution exceeds daily cap
      const dailyCap = parseFloat(this.config.dailyRewardsCap);
      if (totalAmount > dailyCap) {
        return {
          success: false,
          error: `Distribution amount (${totalAmount} KILT) exceeds daily cap (${dailyCap} KILT)`,
          distributedAmount: '0'
        };
      }

      // Check treasury balance
      const treasuryBalance = await this.getTreasuryBalance();
      if (parseFloat(treasuryBalance) < totalAmount) {
        return {
          success: false,
          error: `Insufficient treasury balance. Available: ${treasuryBalance} KILT, Required: ${totalAmount} KILT`,
          distributedAmount: '0'
        };
      }

      // Execute batch transfers
      const successfulTransfers = [];
      const failedTransfers = [];

      for (const recipient of recipients) {
        try {
          const amountWei = parseEther(recipient.amount);
          
          const hash = await this.walletClient.writeContract({
            address: this.config.kiltTokenAddress as `0x${string}`,
            abi: KILT_TOKEN_ABI,
            functionName: 'transfer',
            args: [recipient.userAddress as `0x${string}`, amountWei],
          });

          successfulTransfers.push({
            ...recipient,
            transactionHash: hash
          });

          // Log operation to admin operations table
          await db.insert(adminOperations).values({
            operation: 'REWARD_DISTRIBUTION',
            operationDetails: `Distributed ${recipient.amount} KILT to ${recipient.userAddress} for NFT ${recipient.nftTokenId}`,
            performedBy: 'automated_system',
            transactionHash: hash,
            success: true,
          });

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown transfer error';
          failedTransfers.push({
            ...recipient,
            error: errorMessage
          });

          // Log failed operation
          await db.insert(adminOperations).values({
            operation: 'REWARD_DISTRIBUTION',
            operationDetails: `Failed to distribute ${recipient.amount} KILT to ${recipient.userAddress}`,
            performedBy: 'automated_system',
            success: false,
            errorMessage: errorMessage,
          });
        }
      }

      const distributedAmount = successfulTransfers.reduce((sum, transfer) => {
        return sum + parseFloat(transfer.amount);
      }, 0);

      return {
        success: successfulTransfers.length > 0,
        transactionHash: successfulTransfers.length > 0 ? successfulTransfers[0].transactionHash : undefined,
        error: failedTransfers.length > 0 ? `${failedTransfers.length} transfers failed` : undefined,
        distributedAmount: distributedAmount.toString()
      };

    } catch (error: unknown) {
      console.error('Reward distribution failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown distribution error',
        distributedAmount: '0'
      };
    }
  }

  /**
   * Get eligible users for reward distribution
   * This queries the reward system for users with claimable rewards
   */
  async getEligibleUsers(): Promise<Array<{
    userAddress: string;
    amount: string;
    nftTokenId: string;
    reason: string;
  }>> {
    try {
      // Import required database components
      const { db } = await import('./db');
      const { users, rewards } = await import('../shared/schema');
      const { eq, isNull } = await import('drizzle-orm');
      
      // Query database for users with claimable rewards
      // Get all claimable rewards from database directly 
      const eligibleRewards = await db.select({
        userAddress: users.address,
        dailyRewardAmount: rewards.dailyRewardAmount,
        nftTokenId: rewards.nftTokenId
      })
        .from(rewards)
        .innerJoin(users, eq(rewards.userId, users.id))
        .where(isNull(rewards.claimedAt));
      
      return eligibleRewards.map((row: any) => ({
        userAddress: row.userAddress || '',
        amount: row.dailyRewardAmount || '0',
        nftTokenId: row.nftTokenId || '',
        reason: `Liquidity rewards for position ${row.nftTokenId}`
      }));

    } catch (error: unknown) {
      console.error('Failed to get eligible users:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Process daily reward distribution
   * This should be called once per day by cron job or admin
   */
  async processDailyDistribution(): Promise<{
    success: boolean;
    distributedAmount: string;
    recipientCount: number;
    error?: string;
  }> {
    try {
      const eligibleUsers = await this.getEligibleUsers();
      
      if (eligibleUsers.length === 0) {
        return {
          success: true,
          distributedAmount: '0',
          recipientCount: 0
        };
      }

      const result = await this.distributeRewards(eligibleUsers);
      
      return {
        success: result.success,
        distributedAmount: result.distributedAmount,
        recipientCount: result.success ? eligibleUsers.length : 0,
        error: result.error
      };

    } catch (error: unknown) {
      console.error('Daily distribution failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        distributedAmount: '0',
        recipientCount: 0,
        error: error instanceof Error ? error.message : 'Unknown distribution error'
      };
    }
  }
}

// Export singleton instance
export const rewardDistributionService = new RewardDistributionService({
  treasuryWalletAddress: process.env.TREASURY_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000',
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY, // Optional for automated distributions
  kiltTokenAddress: '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8',
  dailyRewardsCap: '33333.33',
  lockPeriodDays: 7
});