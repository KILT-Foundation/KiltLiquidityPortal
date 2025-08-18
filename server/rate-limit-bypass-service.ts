/**
 * Rate Limit Bypass Service
 * Handles position registration when RPC endpoints are rate limited
 */

import { blockchainConfigService } from './blockchain-config-service';

export interface BypassValidationResult {
  canBypass: boolean;
  bypassReason?: string;
  requiresManualValidation?: boolean;
}

export class RateLimitBypassService {
  
  /**
   * Check if we can bypass KILT validation due to network issues
   */
  static async canBypassKiltValidation(
    userAddress: string,
    nftTokenId: string,
    errorContext?: string
  ): Promise<BypassValidationResult> {
    
    // Check if error indicates rate limiting
    const isRateLimited = errorContext?.includes('429') || 
                         errorContext?.includes('Too many requests') ||
                         errorContext?.includes('rate limit');
    
    if (isRateLimited) {
      console.log(`🔄 Rate limit bypass activated for user ${userAddress}, position ${nftTokenId}`);
      
      return {
        canBypass: true,
        bypassReason: 'RPC rate limiting detected - allowing manual validation',
        requiresManualValidation: true
      };
    }
    
    return {
      canBypass: false
    };
  }

  /**
   * Validate KILT position using manual token address checking
   * This bypasses blockchain calls when network is rate limited
   */
  static async validateKiltPositionManually(
    token0Address?: string,
    token1Address?: string
  ): Promise<boolean> {
    
    if (!token0Address || !token1Address) {
      console.log(`❌ Manual KILT validation failed: Missing token addresses`);
      return false;
    }
    
    try {
      const { kilt } = await blockchainConfigService.getTokenAddresses();
      const kiltLower = kilt.toLowerCase();
      
      const isKiltPosition = (
        token0Address.toLowerCase() === kiltLower ||
        token1Address.toLowerCase() === kiltLower
      );
      
      console.log(`${isKiltPosition ? '✅' : '❌'} Manual KILT validation: ${isKiltPosition}`, {
        token0Address,
        token1Address,
        kiltAddress: kilt
      });
      
      return isKiltPosition;
    } catch (error) {
      console.error('❌ Manual KILT validation error:', error);
      return false;
    }
  }

  /**
   * Create position data from minimal information during rate limiting
   */
  static createBypassPositionData(
    nftTokenId: string,
    userAddress: string,
    poolAddress?: string
  ) {
    return {
      nftTokenId,
      poolAddress: poolAddress || '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E', // KILT/ETH pool
      token0Address: '0x4200000000000000000000000000000000000006', // WETH on Base
      token1Address: '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8', // KILT
      amount0: '0',
      amount1: '0',
      minPrice: '0',
      maxPrice: '0',
      liquidity: '1', // Minimal liquidity to indicate active position
      currentValueUSD: 0,
      feeTier: 3000, // 0.3% fee tier (most common)
      createdAt: new Date(),
      tickLower: -887220, // Full range
      tickUpper: 887220,  // Full range
      isActive: true
    };
  }
}

export const rateLimitBypassService = RateLimitBypassService;