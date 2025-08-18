import { pgTable, text, serial, decimal, timestamp, integer, boolean, date, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== BLOCKCHAIN CONFIGURATION TABLE =====
export const blockchainConfig = pgTable('blockchain_config', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').notNull().unique(),
  configValue: text('config_value').notNull(),
  description: text('description'),
  category: text('category').notNull().default('blockchain'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertBlockchainConfigSchema = createInsertSchema(blockchainConfig);
export type InsertBlockchainConfig = z.infer<typeof insertBlockchainConfigSchema>;
export type BlockchainConfig = typeof blockchainConfig.$inferSelect;

// Core user table - EVM wallet addresses
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  address: text("address").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Uniswap V3 LP positions (NFT-based) - App-tracked only
export const lpPositions = pgTable("lp_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  nftTokenId: text("nft_token_id").notNull(), // Fixed: Use consistent naming
  poolAddress: text("pool_address").notNull(),
  token0Address: text("token_0_address").notNull(),
  token1Address: text("token_1_address").notNull(),
  token0Amount: text("token_0_amount").notNull(),
  token1Amount: text("token_1_amount").notNull(),
  minPrice: numeric("min_price", { precision: 30, scale: 18 }).notNull(),
  maxPrice: numeric("max_price", { precision: 30, scale: 18 }).notNull(),
  tickLower: integer("tick_lower").notNull(),
  tickUpper: integer("tick_upper").notNull(),
  liquidity: numeric("liquidity", { precision: 30, scale: 0 }).notNull(),
  feeTier: integer("fee_tier").notNull(), // 500, 3000, 10000 (0.05%, 0.3%, 1%)
  currentValueUSD: numeric("current_value_usd", { precision: 30, scale: 18 }).notNull(),
  isActive: boolean("is_active").default(true),
  // App-specific tracking fields
  createdViaApp: boolean("created_via_app").default(true).notNull(),
  appTransactionHash: text("app_transaction_hash").notNull(),
  appSessionId: text("app_session_id").notNull(),
  verificationStatus: text("verification_status").default("pending").notNull(),
  rewardEligible: boolean("reward_eligible").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// KILT treasury reward system with Top 100 ranking
export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  positionId: integer("position_id").references(() => lpPositions.id),
  nftTokenId: text("nft_token_id").notNull(), // Uniswap V3 NFT token ID
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(), // Total reward amount - required field
  positionValueUSD: decimal("position_value_usd", { precision: 20, scale: 8 }).notNull(),
  dailyRewardAmount: decimal("daily_reward_amount", { precision: 18, scale: 8 }).notNull(),
  accumulatedAmount: decimal("accumulated_amount", { precision: 18, scale: 8 }).notNull(),
  claimedAmount: decimal("claimed_amount", { precision: 18, scale: 8 }).default("0"),
  liquidityAddedAt: timestamp("liquidity_added_at").notNull(), // When liquidity was first added to pool
  stakingStartDate: timestamp("staking_start_date").defaultNow().notNull(), // When NFT staking for rewards started
  lastRewardCalculation: timestamp("last_reward_calculation").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
  isEligibleForClaim: boolean("is_eligible_for_claim").default(false),
  lockPeriodDays: integer("lock_period_days").default(7).notNull(), // 7 days from liquidity addition
  createdAt: timestamp("created_at").defaultNow(),
});

// Real-time pool statistics
export const poolStats = pgTable("pool_stats", {
  id: serial("id").primaryKey(),
  poolAddress: text("pool_address").notNull(),
  tvl: decimal("tvl", { precision: 18, scale: 2 }).notNull(),
  volume24h: decimal("volume_24h", { precision: 18, scale: 2 }).notNull(),
  apr: decimal("apr", { precision: 5, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});



// Daily reward tracking table
export const dailyRewards = pgTable("daily_rewards", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id").references(() => rewards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  positionId: integer("position_id").references(() => lpPositions.id).notNull(),
  date: date("date").notNull(),
  positionValueUSD: decimal("position_value_usd", { precision: 20, scale: 8 }).notNull(),
  baseAPR: decimal("base_apr", { precision: 5, scale: 2 }).notNull(),
  timeMultiplier: decimal("time_multiplier", { precision: 5, scale: 2 }).notNull(),
  sizeMultiplier: decimal("size_multiplier", { precision: 5, scale: 2 }).notNull(),
  effectiveAPR: decimal("effective_apr", { precision: 5, scale: 2 }).notNull(),
  dailyRewardAmount: decimal("daily_reward_amount", { precision: 18, scale: 8 }).notNull(),
  daysStaked: integer("days_staked").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueUserPositionDate: unique().on(table.userId, table.positionId, table.date),
}));



// App-specific transaction tracking for reward eligibility
export const appTransactions = pgTable("app_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionId: text("session_id").notNull(), // Unique session identifier
  userAddress: text("user_address").notNull(),
  transactionHash: text("transaction_hash").notNull().unique(),
  transactionType: text("transaction_type").notNull(), // 'mint', 'increase', 'decrease', 'collect', 'burn'
  nftTokenId: text("nft_token_id"), // Uniswap V3 NFT token ID (if applicable)
  poolAddress: text("pool_address").notNull(),
  amount0: numeric("amount_0", { precision: 20, scale: 8 }),
  amount1: numeric("amount_1", { precision: 20, scale: 8 }),
  liquidityAmount: numeric("liquidity_amount", { precision: 30, scale: 0 }),
  gasUsed: integer("gas_used"),
  gasPrice: numeric("gas_price", { precision: 20, scale: 0 }),
  blockNumber: integer("block_number"),
  verificationStatus: text("verification_status").default("pending").notNull(), // pending, verified, failed
  appVersion: text("app_version").notNull(), // Version of the app used
  userAgent: text("user_agent"), // Browser/device info for fraud detection
  ipAddress: text("ip_address"), // IP address for fraud detection
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
}, (table) => ({
  uniqueSessionTransaction: unique().on(table.sessionId, table.transactionHash),
}));

// Position reward eligibility tracking
export const positionEligibility = pgTable("position_eligibility", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id").references(() => lpPositions.id).notNull(),
  nftTokenId: text("nft_token_id").notNull(),
  appTransactionId: integer("app_transaction_id").references(() => appTransactions.id).notNull(),
  eligibilityReason: text("eligibility_reason").notNull(), // 'app_created', 'app_increased', 'verified_transaction'
  isEligible: boolean("is_eligible").default(true).notNull(),
  eligibilityCheckedAt: timestamp("eligibility_checked_at").defaultNow().notNull(),
  lastValidationAt: timestamp("last_validation_at").defaultNow().notNull(),
  notes: text("notes"), // Additional verification notes
}, (table) => ({
  uniquePositionEligibility: unique().on(table.positionId, table.nftTokenId),
}));

// Program settings table - only essential formula parameters
export const programSettings = pgTable("program_settings", {
  id: serial("id").primaryKey(),
  timeBoostCoefficient: decimal("time_boost_coefficient", { precision: 10, scale: 3 }).notNull().default("0.600"),
  fullRangeBonus: decimal("full_range_bonus", { precision: 10, scale: 3 }).notNull().default("1.200"),
  minimumPositionValue: decimal("minimum_position_value", { precision: 18, scale: 8 }).notNull().default("10.00000000"),
  lockPeriod: integer("lock_period").notNull().default(7),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Treasury configuration table - essential fields only with auto-calculated fields
export const treasuryConfig = pgTable("treasury_config", {
  id: serial("id").primaryKey(),
  smartContractAddress: text("smart_contract_address").notNull(), // KILT Treasury Smart Contract Address - Single Source of Truth
  totalAllocation: numeric("total_allocation", { precision: 30, scale: 18 }).notNull(),
  programStartDate: date("program_start_date").notNull(),
  programDurationDays: integer("program_duration_days").notNull(),
  // Auto-calculated fields
  programEndDate: date("program_end_date").notNull(), // Calculated from startDate + durationDays
  dailyRewardsCap: numeric("daily_rewards_cap", { precision: 30, scale: 18 }).notNull(), // Calculated from totalAllocation / durationDays
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Token and pool configuration table - essential blockchain addresses
export const tokenPoolConfig = pgTable("token_pool_config", {
  id: serial("id").primaryKey(),
  kiltTokenAddress: text("kilt_token_address").notNull(),
  poolAddress: text("pool_address").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Admin operations audit log
export const adminOperations = pgTable("admin_operations", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(), // Legacy column for compatibility
  operationType: text("operation_type"), // 'treasury_update', 'settings_change', 'rewards_cap_change'
  operationDetails: text("operation_details"), // JSON string with operation details
  amount: numeric("amount", { precision: 30, scale: 18 }),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  reason: text("reason"),
  settings: text("settings"),
  performedBy: text("performed_by"), // Admin wallet address or username
  transactionHash: text("transaction_hash"), // If blockchain transaction involved
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Liquidity events tracking table
export const liquidityEvents = pgTable("liquidity_events", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id").references(() => lpPositions.id).notNull(),
  transactionHash: text("transaction_hash").notNull(),
  blockNumber: integer("block_number").notNull(),
  eventType: text("event_type").notNull(), // 'mint', 'burn', 'increase', 'decrease', 'collect'
  amount0: numeric("amount_0", { precision: 30, scale: 18 }),
  amount1: numeric("amount_1", { precision: 30, scale: 18 }),
  liquidityDelta: numeric("liquidity_delta", { precision: 30, scale: 0 }),
  token0Fees: numeric("token_0_fees", { precision: 30, scale: 18 }),
  token1Fees: numeric("token_1_fees", { precision: 30, scale: 18 }),
  gasUsed: integer("gas_used"),
  gasPrice: numeric("gas_price", { precision: 30, scale: 0 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Insert/select schemas for admin operations audit log
export const insertAdminOperationSchema = createInsertSchema(adminOperations).pick({
  operation: true,
  operationType: true,
  operationDetails: true,
  amount: true,
  fromAddress: true,
  toAddress: true,
  reason: true,
  settings: true,
  performedBy: true,
  transactionHash: true,
  success: true,
  errorMessage: true,
});



export const insertUserSchema = createInsertSchema(users).pick({
  address: true,
});

export const insertLpPositionSchema = createInsertSchema(lpPositions).pick({
  userId: true,
  nftTokenId: true,
  poolAddress: true,
  token0Address: true,
  token1Address: true,
  token0Amount: true,
  token1Amount: true,
  minPrice: true,
  maxPrice: true,
  tickLower: true,
  tickUpper: true,
  liquidity: true,
  feeTier: true,
  currentValueUSD: true,
  isActive: true,
  createdViaApp: true,
  appTransactionHash: true,
  appSessionId: true,
  verificationStatus: true,
  rewardEligible: true,
});

export const insertAppTransactionSchema = createInsertSchema(appTransactions).pick({
  userId: true,
  sessionId: true,
  userAddress: true,
  transactionHash: true,
  transactionType: true,
  nftTokenId: true,
  poolAddress: true,
  amount0: true,
  amount1: true,
  liquidityAmount: true,
  gasUsed: true,
  gasPrice: true,
  blockNumber: true,
  verificationStatus: true,
  appVersion: true,
  userAgent: true,
  ipAddress: true,
});

export const insertPositionEligibilitySchema = createInsertSchema(positionEligibility).pick({
  positionId: true,
  nftTokenId: true,
  appTransactionId: true,
  eligibilityReason: true,
  isEligible: true,
  notes: true,
});

export const insertLiquidityEventSchema = createInsertSchema(liquidityEvents).pick({
  positionId: true,
  transactionHash: true,
  blockNumber: true,
  eventType: true,
  amount0: true,
  amount1: true,
  liquidityDelta: true,
  token0Fees: true,
  token1Fees: true,
  gasUsed: true,
  gasPrice: true,
});

export const insertRewardSchema = createInsertSchema(rewards).pick({
  userId: true,
  positionId: true,
  nftTokenId: true,
  positionValueUSD: true,
  dailyRewardAmount: true,
  accumulatedAmount: true,
  liquidityAddedAt: true,
  stakingStartDate: true,
});

export const insertDailyRewardSchema = createInsertSchema(dailyRewards).pick({
  rewardId: true,
  userId: true,
  positionId: true,
  date: true,
  positionValueUSD: true,
  baseAPR: true,
  timeMultiplier: true,
  sizeMultiplier: true,
  effectiveAPR: true,
  dailyRewardAmount: true,
  daysStaked: true,
});

export const insertPoolStatsSchema = createInsertSchema(poolStats).pick({
  poolAddress: true,
  tvl: true,
  volume24h: true,
  apr: true,
  currentPrice: true,
});



// New schema validators for admin features
export const insertProgramSettingsSchema = createInsertSchema(programSettings).pick({
  timeBoostCoefficient: true,
  fullRangeBonus: true,
  minimumPositionValue: true,
  lockPeriod: true,
});

export const insertTreasuryConfigSchema = createInsertSchema(treasuryConfig).pick({
  smartContractAddress: true,
  totalAllocation: true,
  dailyRewardsCap: true,
  programStartDate: true,
  programEndDate: true,
  programDurationDays: true,
  isActive: true,
  createdBy: true,
});



export type AppTransaction = typeof appTransactions.$inferSelect;
export type InsertAppTransaction = typeof appTransactions.$inferInsert;

export type PositionEligibility = typeof positionEligibility.$inferSelect;
export type InsertPositionEligibility = typeof positionEligibility.$inferInsert;

// Program settings types
export type ProgramSettings = typeof programSettings.$inferSelect;
export type InsertProgramSettings = typeof programSettings.$inferInsert;

// Treasury config types
export type TreasuryConfig = typeof treasuryConfig.$inferSelect;
export type InsertTreasuryConfig = typeof treasuryConfig.$inferInsert;

// Admin operations types
export type AdminOperation = typeof adminOperations.$inferSelect;
export type InsertAdminOperation = typeof adminOperations.$inferInsert;

export type TokenPoolConfig = typeof tokenPoolConfig.$inferSelect;
export type InsertTokenPoolConfig = typeof tokenPoolConfig.$inferInsert;





export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLpPosition = z.infer<typeof insertLpPositionSchema>;
export type LpPosition = typeof lpPositions.$inferSelect;
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertDailyReward = z.infer<typeof insertDailyRewardSchema>;
export type DailyReward = typeof dailyRewards.$inferSelect;
export type InsertPoolStats = z.infer<typeof insertPoolStatsSchema>;
export type PoolStats = typeof poolStats.$inferSelect;



// Clean up duplicate type definitions
export type LiquidityEvent = typeof liquidityEvents.$inferSelect;
export type InsertLiquidityEvent = z.infer<typeof insertLiquidityEventSchema>;
