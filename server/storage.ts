import { 
  users, 
  lpPositions, 
  rewards, 
  poolStats,
  type User, 
  type InsertUser,
  type LpPosition,
  type InsertLpPosition,
  type Reward,
  type InsertReward,
  type PoolStats,
  type InsertPoolStats
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByAddress(address: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // LP Position methods
  getLpPosition(id: number): Promise<LpPosition | undefined>;
  getLpPositionsByUserId(userId: number): Promise<LpPosition[]>;
  getAllLpPositions(): Promise<LpPosition[]>;
  getLpPositionByNftTokenId(nftTokenId: string): Promise<LpPosition | undefined>;
  createLpPosition(position: InsertLpPosition): Promise<LpPosition>;
  updateLpPosition(id: number, updates: Partial<LpPosition>): Promise<LpPosition | undefined>;
  updateLpPositionByTokenId(tokenId: string, updates: Partial<LpPosition>): Promise<LpPosition | undefined>;
  updateLpPositionStatus(tokenId: string, isActive: boolean): Promise<boolean>;
  updateLpPositionRewardEligibility(tokenId: string, rewardEligible: boolean): Promise<boolean>;
  deleteLpPosition(tokenId: string): Promise<boolean>;
  
  // Position registration methods
  getUserPositions(address: string): Promise<any[]>;
  getRegisteredPositions(address: string): Promise<any[]>;
  getAppTransactionsByUserId(userId: number): Promise<any[]>;
  
  // Reward methods
  getRewardsByUserId(userId: number): Promise<Reward[]>;
  getRewardsByPositionId(positionId: number): Promise<Reward[]>;
  createReward(reward: InsertReward): Promise<Reward>;
  claimRewards(userId: number): Promise<void>;
  
  // Pool Stats methods
  getPoolStats(poolAddress: string): Promise<PoolStats | undefined>;
  updatePoolStats(poolAddress: string, stats: InsertPoolStats): Promise<PoolStats>;
  
  // Missing methods for deployment health checks
  getAllRewards(): Promise<Reward[]>;
  getTreasuryConfig(): Promise<any>;
  getProgramSettings(): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private lpPositions: Map<number, LpPosition> = new Map();
  private rewards: Map<number, Reward> = new Map();
  private poolStats: Map<string, PoolStats> = new Map();
  
  private userIdCounter = 1;
  private positionIdCounter = 1;
  private rewardIdCounter = 1;
  private statsIdCounter = 1;

  constructor() {
    // Initialize with some sample positions for testing replacement notification
    this.initializeSamplePositions();
  }

  private initializeSamplePositions() {
    // No sample data - all data should come from real sources
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByAddress(address: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.address === address);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.userIdCounter++,
      address: insertUser.address,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getLpPosition(id: number): Promise<LpPosition | undefined> {
    return this.lpPositions.get(id);
  }

  async getLpPositionsByUserId(userId: number): Promise<LpPosition[]> {
    return Array.from(this.lpPositions.values()).filter(pos => pos.userId === userId);
  }

  async getAllLpPositions(): Promise<LpPosition[]> {
    return Array.from(this.lpPositions.values());
  }

  async createLpPosition(insertPosition: InsertLpPosition): Promise<LpPosition> {
    const position: LpPosition = {
      id: this.positionIdCounter++,
      userId: insertPosition.userId || null,
      nftTokenId: insertPosition.nftTokenId,
      poolAddress: insertPosition.poolAddress,
      token0Address: insertPosition.token0Address,
      token1Address: insertPosition.token1Address,
      token0Amount: insertPosition.token0Amount,
      token1Amount: insertPosition.token1Amount,
      minPrice: insertPosition.minPrice,
      maxPrice: insertPosition.maxPrice,
      tickLower: insertPosition.tickLower,
      tickUpper: insertPosition.tickUpper,
      liquidity: insertPosition.liquidity,
      currentValueUSD: insertPosition.currentValueUSD || '0',
      feeTier: insertPosition.feeTier || 3000,
      isActive: true,
      createdAt: new Date(),
      createdViaApp: insertPosition.createdViaApp || false,
      rewardEligible: insertPosition.rewardEligible || false,
      appTransactionHash: insertPosition.appTransactionHash || '',
      appSessionId: insertPosition.appSessionId || '',
      verificationStatus: insertPosition.verificationStatus || 'pending',
    };
    this.lpPositions.set(position.id, position);
    return position;
  }

  async updateLpPosition(id: number, updates: Partial<LpPosition>): Promise<LpPosition | undefined> {
    const position = this.lpPositions.get(id);
    if (!position) return undefined;
    
    const updatedPosition = { ...position, ...updates };
    this.lpPositions.set(id, updatedPosition);
    return updatedPosition;
  }

  async updateLpPositionByTokenId(tokenId: string, updates: Partial<LpPosition>): Promise<LpPosition | undefined> {
    const position = Array.from(this.lpPositions.values()).find(p => p.nftTokenId === tokenId);
    if (!position) return undefined;
    
    const updatedPosition = { ...position, ...updates };
    this.lpPositions.set(position.id, updatedPosition);
    return updatedPosition;
  }

  async getUserPositions(address: string): Promise<any[]> {
    // In real implementation, this would query Uniswap V3 contracts
    // For now, return empty array - all positions come from real blockchain data
    return [];
  }

  async getRegisteredPositions(address: string): Promise<any[]> {
    // Get positions that have been registered in our system
    const user = await this.getUserByAddress(address);
    if (!user) return [];
    
    return Array.from(this.lpPositions.values()).filter(pos => pos.userId === user.id);
  }



  async updateLpPositionStatus(tokenId: string, isActive: boolean): Promise<boolean> {
    const position = Array.from(this.lpPositions.values()).find(pos => pos.nftTokenId === tokenId);
    if (!position) return false;
    
    position.isActive = isActive;
    this.lpPositions.set(position.id, position);
    return true;
  }

  async updateLpPositionRewardEligibility(tokenId: string, rewardEligible: boolean): Promise<boolean> {
    const position = Array.from(this.lpPositions.values()).find(pos => pos.nftTokenId === tokenId);
    if (!position) return false;
    
    position.rewardEligible = rewardEligible;
    this.lpPositions.set(position.id, position);
    return true;
  }

  async getLpPositionByNftTokenId(nftTokenId: string): Promise<LpPosition | undefined> {
    return Array.from(this.lpPositions.values()).find(pos => pos.nftTokenId === nftTokenId);
  }

  async deleteLpPosition(tokenId: string): Promise<boolean> {
    const position = Array.from(this.lpPositions.values()).find(pos => pos.nftTokenId === tokenId);
    if (!position) return false;
    
    this.lpPositions.delete(position.id);
    return true;
  }

  async getAppTransactionsByUserId(userId: number): Promise<any[]> {
    // Return empty array for in-memory storage - handled by database
    return [];
  }

  async getRewardsByUserId(userId: number): Promise<Reward[]> {
    return Array.from(this.rewards.values()).filter(reward => reward.userId === userId);
  }

  async getRewardsByPositionId(positionId: number): Promise<Reward[]> {
    return Array.from(this.rewards.values()).filter(reward => reward.positionId === positionId);
  }

  async createReward(insertReward: InsertReward): Promise<Reward> {
    const reward: Reward = {
      id: this.rewardIdCounter++,
      userId: insertReward.userId || null,
      nftTokenId: insertReward.nftTokenId,
      positionId: insertReward.positionId || null,
      amount: insertReward.dailyRewardAmount,
      positionValueUSD: insertReward.positionValueUSD,
      dailyRewardAmount: insertReward.dailyRewardAmount,
      accumulatedAmount: insertReward.accumulatedAmount,
      liquidityAddedAt: insertReward.liquidityAddedAt,
      stakingStartDate: insertReward.stakingStartDate || new Date(),
      lockPeriodDays: 7, // Fixed 7-day lock period
      claimedAt: null,
      claimedAmount: '0',
      lastRewardCalculation: new Date(),
      isEligibleForClaim: false,
      createdAt: new Date(),
    };
    this.rewards.set(reward.id, reward);
    return reward;
  }

  async claimRewards(userId: number): Promise<void> {
    const userRewards = Array.from(this.rewards.values()).filter(
      reward => reward.userId === userId && !reward.claimedAt
    );
    
    userRewards.forEach(reward => {
      reward.claimedAt = new Date();
      this.rewards.set(reward.id, reward);
    });
  }

  async getClaimableRewards(): Promise<Array<{
    userAddress: string;
    accumulatedAmount: string;
    nftTokenId: string;
  }>> {
    // Get all rewards that are eligible for claiming (lock period expired)
    const now = new Date();
    const claimableRewards = Array.from(this.rewards.values()).filter(reward => {
      if (reward.claimedAt) return false; // Already claimed
      
      const lockExpiry = new Date(reward.stakingStartDate);
      lockExpiry.setDate(lockExpiry.getDate() + reward.lockPeriodDays);
      
      return now >= lockExpiry;
    });

    // Group by user and combine rewards
    const userRewards = new Map<string, {
      userAddress: string;
      accumulatedAmount: number;
      nftTokenId: string;
    }>();

    for (const reward of claimableRewards) {
      const user = await this.getUser(reward.userId!);
      if (!user) continue;

      const existing = userRewards.get(user.address) || {
        userAddress: user.address,
        accumulatedAmount: 0,
        nftTokenId: reward.nftTokenId
      };

      existing.accumulatedAmount += parseFloat(reward.accumulatedAmount);
      userRewards.set(user.address, existing);
    }

    return Array.from(userRewards.values()).map(reward => ({
      ...reward,
      accumulatedAmount: reward.accumulatedAmount.toString()
    }));
  }

  async getPoolStats(poolAddress: string): Promise<PoolStats | undefined> {
    return this.poolStats.get(poolAddress);
  }

  async updatePoolStats(poolAddress: string, stats: InsertPoolStats): Promise<PoolStats> {
    const existing = this.poolStats.get(poolAddress);
    const poolStat: PoolStats = {
      id: existing?.id || this.statsIdCounter++,
      ...stats,
      updatedAt: new Date(),
    };
    this.poolStats.set(poolAddress, poolStat);
    return poolStat;
  }

  async getAllRewards(): Promise<Reward[]> {
    return Array.from(this.rewards.values());
  }

  async getTreasuryConfig(): Promise<any> {
    return {
      totalAllocation: 1500000,
      dailyBudget: 25000,
      smartContractAddress: '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175'
    };
  }

  async getProgramSettings(): Promise<any> {
    return {
      timeBoostCoefficient: 1.5,
      inRangeMultiplier: 2.0,
      fullRangeBonus: 1.25
    };
  }
}

// Database storage implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByAddress(address: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.address, address)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getLpPosition(id: number): Promise<LpPosition | undefined> {
    const result = await db.select().from(lpPositions).where(eq(lpPositions.id, id)).limit(1);
    return result[0];
  }

  async getLpPositionsByUserId(userId: number): Promise<LpPosition[]> {
    return await db.select().from(lpPositions).where(eq(lpPositions.userId, userId));
  }

  async getAllLpPositions(): Promise<LpPosition[]> {
    return await db.select().from(lpPositions);
  }

  async createLpPosition(insertPosition: InsertLpPosition): Promise<LpPosition> {
    const result = await db.insert(lpPositions).values(insertPosition).returning();
    return result[0];
  }

  async updateLpPosition(id: number, updates: Partial<LpPosition>): Promise<LpPosition | undefined> {
    const result = await db.update(lpPositions).set(updates).where(eq(lpPositions.id, id)).returning();
    return result[0];
  }

  async updateLpPositionByTokenId(tokenId: string, updates: Partial<LpPosition>): Promise<LpPosition | undefined> {
    const result = await db.update(lpPositions).set(updates).where(eq(lpPositions.nftTokenId, tokenId)).returning();
    return result[0];
  }

  async getUserPositions(address: string): Promise<any[]> {
    // Return empty array - positions come from blockchain data
    return [];
  }

  async getRegisteredPositions(address: string): Promise<any[]> {
    const user = await this.getUserByAddress(address);
    if (!user) return [];
    
    return await db.select().from(lpPositions).where(eq(lpPositions.userId, user.id));
  }

  async getRewardsByUserId(userId: number): Promise<Reward[]> {
    return await db.select().from(rewards).where(eq(rewards.userId, userId));
  }

  async getRewardsByPositionId(positionId: number): Promise<Reward[]> {
    return await db.select().from(rewards).where(eq(rewards.positionId, positionId));
  }

  async createReward(insertReward: InsertReward): Promise<Reward> {
    // Ensure all required fields are present - cast to any to handle missing optional fields
    const anyReward = insertReward as any;
    const completeReward = {
      ...insertReward,
      amount: anyReward.amount || anyReward.dailyRewardAmount || '0',
      lockPeriodDays: anyReward.lockPeriodDays || 7,
      claimedAmount: anyReward.claimedAmount || '0',
      isEligibleForClaim: anyReward.isEligibleForClaim || false,
      lastRewardCalculation: anyReward.lastRewardCalculation || new Date(),
    };
    const result = await db.insert(rewards).values(completeReward).returning();
    return result[0];
  }

  async claimRewards(userId: number): Promise<void> {
    await db.update(rewards)
      .set({ claimedAt: new Date() })
      .where(eq(rewards.userId, userId));
  }

  async getPoolStats(poolAddress: string): Promise<PoolStats | undefined> {
    const result = await db.select().from(poolStats).where(eq(poolStats.poolAddress, poolAddress)).limit(1);
    return result[0];
  }

  async updatePoolStats(poolAddress: string, stats: InsertPoolStats): Promise<PoolStats> {
    const existing = await this.getPoolStats(poolAddress);
    if (existing) {
      const result = await db.update(poolStats)
        .set({ ...stats, updatedAt: new Date() })
        .where(eq(poolStats.poolAddress, poolAddress))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(poolStats).values({
        ...stats,
        poolAddress,
        updatedAt: new Date()
      }).returning();
      return result[0];
    }
  }

  async getAppTransactionsByUserId(userId: number): Promise<any[]> {
    const { appTransactions } = await import('@shared/schema');
    return await db.select().from(appTransactions).where(eq(appTransactions.userId, userId));
  }

  // CRITICAL MISSING METHOD FOR BETA RELEASE
  async getLpPositionByNftTokenId(nftTokenId: string): Promise<LpPosition | undefined> {
    const result = await db.select().from(lpPositions).where(eq(lpPositions.nftTokenId, nftTokenId)).limit(1);
    return result[0];
  }

  // Get all users for lifecycle management
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Update position status for burned position cleanup
  async updateLpPositionStatus(tokenId: string, isActive: boolean): Promise<boolean> {
    try {
      const result = await db.update(lpPositions)
        .set({ isActive })
        .where(eq(lpPositions.nftTokenId, tokenId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to update position status for token ${tokenId}:`, error);
      return false;
    }
  }

  // Update position reward eligibility
  async updateLpPositionRewardEligibility(tokenId: string, rewardEligible: boolean): Promise<boolean> {
    try {
      const result = await db.update(lpPositions)
        .set({ rewardEligible })
        .where(eq(lpPositions.nftTokenId, tokenId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to update reward eligibility for token ${tokenId}:`, error);
      return false;
    }
  }

  // ANTI-BLOAT: Delete burned positions from database to prevent bloat
  async deleteLpPosition(tokenId: string): Promise<boolean> {
    try {
      const result = await db.delete(lpPositions)
        .where(eq(lpPositions.nftTokenId, tokenId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to delete position ${tokenId}:`, error);
      return false;
    }
  }

  async getAllRewards(): Promise<Reward[]> {
    return await db.select().from(rewards);
  }

  async getTreasuryConfig(): Promise<any> {
    const { treasuryConfig } = await import('@shared/schema');
    const result = await db.select().from(treasuryConfig).limit(1);
    return result[0] || {
      totalAllocation: 1500000,
      dailyBudget: 25000,
      smartContractAddress: '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175'
    };
  }

  async getProgramSettings(): Promise<any> {
    const { programSettings } = await import('@shared/schema');
    const result = await db.select().from(programSettings).limit(1);
    return result[0] || {
      timeBoostCoefficient: 1.5,
      inRangeMultiplier: 2.0,
      fullRangeBonus: 1.25
    };
  }
}

// Use database storage instead of in-memory storage
export const storage = new DatabaseStorage();

// Export database instance for background services
export function getDatabase() {
  return db;
}
