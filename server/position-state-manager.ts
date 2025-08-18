/**
 * UNIFIED POSITION STATE MANAGER
 * 
 * This is the single source of truth for determining position active/inactive state.
 * All services (lifecycle, sync validator, etc.) MUST use this logic to avoid conflicts.
 * 
 * ARCHITECTURE: 
 * - Single function determines if position should be active
 * - All services call this function instead of implementing their own logic
 * - Eliminates competing services that fight each other
 */

export interface PositionStateContext {
  tokenId: string;
  hasBlockchainLiquidity: boolean;
  blockchainLiquidity: string;
  currentValueUSD: string | number | null;
  hasUnclaimedTokens: boolean;
  isOnBlockchain: boolean;
}

export type PositionState = 'active' | 'inactive' | 'burned';

export class PositionStateManager {
  
  /**
   * SINGLE SOURCE OF TRUTH: Determine if position should be active
   * 
   * LOGIC:
   * - BURNED: Position doesn't exist on blockchain
   * - ACTIVE: Has liquidity OR significant value (>$100)
   * - INACTIVE: No liquidity and no significant value
   */
  static determinePositionState(context: PositionStateContext): PositionState {
    // Position was burned/transferred - doesn't exist on blockchain
    if (!context.isOnBlockchain) {
      return 'burned';
    }

    // Parse USD value safely
    const usdValue = context.currentValueUSD ? parseFloat(context.currentValueUSD.toString()) : 0;
    
    // Position is ACTIVE if it has:
    // 1. Active liquidity on blockchain, OR
    // 2. Significant USD value (>$100 indicating real money at stake)
    if (context.hasBlockchainLiquidity || usdValue > 100) {
      return 'active';
    }

    // Position has no liquidity and no significant value - inactive
    return 'inactive';
  }

  /**
   * Determine if position should be eligible for rewards
   * 
   * LOGIC: Only active positions with value > $0.01 are reward eligible
   */
  static isRewardEligible(context: PositionStateContext): boolean {
    const state = this.determinePositionState(context);
    if (state !== 'active') {
      return false;
    }

    const usdValue = context.currentValueUSD ? parseFloat(context.currentValueUSD.toString()) : 0;
    return usdValue > 0.01;
  }

  /**
   * Check if position needs Step 2 completion (collect fees)
   */
  static needsStep2(context: PositionStateContext): boolean {
    const state = this.determinePositionState(context);
    
    // Only inactive positions with unclaimed tokens need Step 2
    return state === 'inactive' && context.hasUnclaimedTokens && !context.hasBlockchainLiquidity;
  }
}