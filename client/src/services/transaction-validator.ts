import { base } from 'viem/chains';
import { createPublicClient, http, formatUnits } from 'viem';

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gasEstimate?: bigint;
  suggestions: string[];
}

export interface LiquidityParams {
  token0: string;
  token1: string;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  tickLower: number;
  tickUpper: number;
  fee: number;
  deadline: number;
  userAddress: string;
  isNativeETH?: boolean;
}

export class TransactionValidator {
  private static instance: TransactionValidator;

  static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  /**
   * Comprehensive validation for Uniswap V3 liquidity transactions
   */
  async validateLiquidityTransaction(params: LiquidityParams): Promise<TransactionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic parameter validation
      this.validateBasicParams(params, errors);
      
      // Token balance validation
      await this.validateTokenBalances(params, errors, warnings);
      
      // Price and slippage validation
      this.validatePriceAndSlippage(params, warnings, suggestions);
      
      // Tick validation
      this.validateTicks(params, errors);
      
      // Deadline validation
      this.validateDeadline(params, errors, warnings);
      
      // Fee tier validation
      this.validateFeeTier(params, errors);

      // Add helpful suggestions for successful transactions
      if (errors.length === 0) {
        suggestions.push('Transaction parameters look good');
        suggestions.push('Consider using a deadline of 20 minutes for better execution');
        if (!params.isNativeETH) {
          suggestions.push('Using WETH instead of native ETH reduces gas costs');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
        suggestions: ['Check network connection and try again']
      };
    }
  }

  private validateBasicParams(params: LiquidityParams, errors: string[]): void {
    if (!params.token0 || !params.token1) {
      errors.push('Invalid token addresses');
    }

    if (params.token0.toLowerCase() === params.token1.toLowerCase()) {
      errors.push('Cannot create position with identical tokens');
    }

    if (params.amount0Desired === 0n && params.amount1Desired === 0n) {
      errors.push('At least one token amount must be greater than zero');
    }

    if (!params.userAddress || params.userAddress.length !== 42) {
      errors.push('Invalid user address');
    }
  }

  private async validateTokenBalances(
    params: LiquidityParams, 
    errors: string[], 
    warnings: string[]
  ): Promise<void> {
    try {
      // Check token balances
      const token0Balance = await this.getTokenBalance(params.token0, params.userAddress);
      const token1Balance = await this.getTokenBalance(params.token1, params.userAddress);

      // For native ETH, check ETH balance instead of WETH balance
      if (params.isNativeETH && params.token0.toLowerCase() === '0x4200000000000000000000000000000000000006') {
        // When using native ETH, we check ETH balance but the transaction will handle WETH conversion
        const ethBalance = await publicClient.getBalance({ address: params.userAddress as `0x${string}` });
        
        if (params.amount0Desired > ethBalance) {
          errors.push(`Insufficient ETH balance. Required: ${formatUnits(params.amount0Desired, 18)}, Available: ${formatUnits(ethBalance, 18)}`);
        }
      } else {
        // Regular WETH balance check
        if (params.amount0Desired > token0Balance) {
          errors.push(`Insufficient WETH balance. Required: ${formatUnits(params.amount0Desired, 18)}, Available: ${formatUnits(token0Balance, 18)}`);
        }
      }

      // KILT balance check
      if (params.amount1Desired > token1Balance) {
        errors.push(`Insufficient KILT balance. Required: ${formatUnits(params.amount1Desired, 18)}, Available: ${formatUnits(token1Balance, 18)}`);
      }

      // Warn if using more than 90% of balance (only for successful balance checks)
      if (errors.length === 0) {
        if (params.isNativeETH) {
          const ethBalance = await publicClient.getBalance({ address: params.userAddress as `0x${string}` });
          if (params.amount0Desired > (ethBalance * 9n) / 10n) {
            warnings.push('Using more than 90% of ETH balance');
          }
        } else if (params.amount0Desired > (token0Balance * 9n) / 10n) {
          warnings.push('Using more than 90% of WETH balance');
        }

        if (params.amount1Desired > (token1Balance * 9n) / 10n) {
          warnings.push('Using more than 90% of KILT balance');
        }
      }

    } catch (error) {
      console.error('Balance validation error:', error);
      warnings.push('Could not verify token balances - check network connection');
    }
  }

  private async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    try {
      // Handle native ETH
      if (tokenAddress.toLowerCase() === '0x4200000000000000000000000000000000000006') {
        return await publicClient.getBalance({ address: userAddress as `0x${string}` });
      }

      // Handle ERC20 tokens
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: [{
          inputs: [{ name: 'account', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        }],
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });

      return balance as bigint;
    } catch (error) {
      return 0n;
    }
  }

  private validatePriceAndSlippage(
    params: LiquidityParams, 
    warnings: string[], 
    suggestions: string[]
  ): void {
    // Calculate slippage protection
    const slippage0 = params.amount0Desired > 0n 
      ? (params.amount0Desired - params.amount0Min) * 100n / params.amount0Desired
      : 0n;
    
    const slippage1 = params.amount1Desired > 0n 
      ? (params.amount1Desired - params.amount1Min) * 100n / params.amount1Desired
      : 0n;

    // Warn about high slippage
    if (slippage0 > 5n || slippage1 > 5n) {
      warnings.push(`High slippage detected (${slippage0}%/${slippage1}%). Consider reducing trade size.`);
    }

    // Warn about very low slippage
    if (slippage0 < 1n && slippage1 < 1n && (params.amount0Desired > 0n || params.amount1Desired > 0n)) {
      warnings.push('Very low slippage tolerance may cause transaction failure');
      suggestions.push('Consider setting slippage tolerance to 2-5% for better execution');
    }
  }

  private validateTicks(params: LiquidityParams, errors: string[]): void {
    if (params.tickLower >= params.tickUpper) {
      errors.push('Lower tick must be less than upper tick');
    }

    // Validate tick spacing based on fee tier
    const tickSpacing = this.getTickSpacing(params.fee);
    if (params.tickLower % tickSpacing !== 0) {
      errors.push(`Lower tick must be divisible by ${tickSpacing} for ${params.fee / 10000}% fee tier`);
    }

    if (params.tickUpper % tickSpacing !== 0) {
      errors.push(`Upper tick must be divisible by ${tickSpacing} for ${params.fee / 10000}% fee tier`);
    }

    // Check tick bounds
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;

    if (params.tickLower < MIN_TICK || params.tickLower > MAX_TICK) {
      errors.push(`Lower tick out of bounds: ${MIN_TICK} to ${MAX_TICK}`);
    }

    if (params.tickUpper < MIN_TICK || params.tickUpper > MAX_TICK) {
      errors.push(`Upper tick out of bounds: ${MIN_TICK} to ${MAX_TICK}`);
    }
  }

  private validateDeadline(params: LiquidityParams, errors: string[], warnings: string[]): void {
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (params.deadline <= currentTime) {
      errors.push('Transaction deadline has passed');
    }

    const timeUntilDeadline = params.deadline - currentTime;
    if (timeUntilDeadline < 300) { // Less than 5 minutes
      warnings.push('Short deadline may cause transaction failure due to network congestion');
    }

    if (timeUntilDeadline > 3600) { // More than 1 hour
      warnings.push('Very long deadline provides less MEV protection');
    }
  }

  private validateFeeTier(params: LiquidityParams, errors: string[]): void {
    const validFeeTiers = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%
    
    if (!validFeeTiers.includes(params.fee)) {
      errors.push(`Invalid fee tier: ${params.fee}. Valid tiers: ${validFeeTiers.join(', ')}`);
    }
  }

  private getTickSpacing(feeTier: number): number {
    switch (feeTier) {
      case 100: return 1;
      case 500: return 10;
      case 3000: return 60;
      case 10000: return 200;
      default: return 60;
    }
  }

  /**
   * Calculate optimal slippage protection based on current market conditions
   */
  calculateOptimalSlippage(
    amount0Desired: bigint, 
    amount1Desired: bigint, 
    marketVolatility: number = 0.02
  ): { amount0Min: bigint; amount1Min: bigint } {
    // Base slippage of 2% plus market volatility
    const slippagePercent = Math.max(0.02, marketVolatility);
    const slippageFactor = BigInt(Math.floor((1 - slippagePercent) * 10000)) / 10000n;

    return {
      amount0Min: (amount0Desired * slippageFactor) / 10000n,
      amount1Min: (amount1Desired * slippageFactor) / 10000n,
    };
  }

  /**
   * Generate safe transaction deadline (20 minutes from now)
   */
  generateSafeDeadline(): number {
    return Math.floor(Date.now() / 1000) + (20 * 60); // 20 minutes
  }
}

export const transactionValidator = TransactionValidator.getInstance();