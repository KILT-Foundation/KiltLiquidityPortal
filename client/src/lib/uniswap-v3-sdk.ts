import { Token, CurrencyAmount, Price, Percent } from '@uniswap/sdk-core';
import { Pool, Position, nearestUsableTick, TickMath, TICK_SPACINGS } from '@uniswap/v3-sdk';
import { NonfungiblePositionManager } from '@uniswap/v3-sdk';
import { ethers } from 'ethers';
import { base } from 'viem/chains';

// Token definitions for Base network
export const KILT_TOKEN = new Token(
  base.id,
  '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8',
  18,
  'KILT',
  'KILT Protocol'
);

export const WETH_TOKEN = new Token(
  base.id,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether'
);

export interface UniswapV3PoolData {
  token0: string;
  token1: string;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
}

export interface MintPositionParams {
  token0Amount: string;
  token1Amount: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  slippageTolerance: number;
  deadline: number;
  recipient: string;
}

export class UniswapV3SDKService {
  private pool: Pool | null = null;
  private poolData: UniswapV3PoolData | null = null;

  constructor(private poolAddress: string) {}

  /**
   * Initialize the pool with current state data
   */
  async initializePool(poolData: UniswapV3PoolData): Promise<void> {
    this.poolData = poolData;

    // Determine token order based on addresses
    const [token0, token1] = poolData.token0.toLowerCase() < poolData.token1.toLowerCase() 
      ? [KILT_TOKEN, WETH_TOKEN] 
      : [WETH_TOKEN, KILT_TOKEN];

    // Create the pool instance
    this.pool = new Pool(
      token0,
      token1,
      poolData.fee,
      poolData.sqrtPriceX96.toString(),
      poolData.liquidity.toString(),
      poolData.tick
    );
  }

  /**
   * Calculate tick range for a given strategy
   */
  calculateTickRange(strategy: string, currentTick: number, tickSpacing: number): { tickLower: number; tickUpper: number } {
    let tickLower: number;
    let tickUpper: number;

    switch (strategy) {
      case 'Balanced (±50%)':
        const range50 = Math.floor(Math.log(1.5) / Math.log(1.0001));
        tickLower = currentTick - range50;
        tickUpper = currentTick + range50;
        break;
      case 'Wide (±100%)':
        const range100 = Math.floor(Math.log(2.0) / Math.log(1.0001));
        tickLower = currentTick - range100;
        tickUpper = currentTick + range100;
        break;
      case 'Narrow (±25%)':
        const range25 = Math.floor(Math.log(1.25) / Math.log(1.0001));
        tickLower = currentTick - range25;
        tickUpper = currentTick + range25;
        break;
      case 'Full Range':
        tickLower = TickMath.MIN_TICK;
        tickUpper = TickMath.MAX_TICK;
        break;
      default:
        // Default to balanced
        const rangeDefault = Math.floor(Math.log(1.5) / Math.log(1.0001));
        tickLower = currentTick - rangeDefault;
        tickUpper = currentTick + rangeDefault;
    }

    // Ensure ticks are usable (aligned to tick spacing)
    tickLower = nearestUsableTick(tickLower, tickSpacing);
    tickUpper = nearestUsableTick(tickUpper, tickSpacing);

    return { tickLower, tickUpper };
  }

  /**
   * Create a position with the specified parameters
   */
  async createPosition(params: MintPositionParams): Promise<Position> {
    if (!this.pool) {
      throw new Error('Pool not initialized. Call initializePool first.');
    }

    const { token0Amount, token1Amount, tickLower, tickUpper } = params;

    // Create currency amounts
    const amount0 = CurrencyAmount.fromRawAmount(this.pool.token0, token0Amount);
    const amount1 = CurrencyAmount.fromRawAmount(this.pool.token1, token1Amount);

    // Create the position
    const position = Position.fromAmounts({
      pool: this.pool,
      tickLower,
      tickUpper,
      amount0: amount0.quotient,
      amount1: amount1.quotient,
      useFullPrecision: false
    });

    return position;
  }

  /**
   * Get mint parameters for NonfungiblePositionManager
   */
  async getMintParameters(position: Position, params: MintPositionParams): Promise<any> {
    const { slippageTolerance, deadline, recipient } = params;

    const slippagePercent = new Percent(slippageTolerance * 100, 10000);

    return NonfungiblePositionManager.addCallParameters(position, {
      slippageTolerance: slippagePercent,
      deadline,
      recipient,
      createPool: false
    });
  }

  /**
   * Calculate optimal amounts for balanced liquidity
   */
  calculateOptimalAmounts(
    kiltAmount: string,
    ethAmount: string,
    tickLower: number,
    tickUpper: number
  ): { amount0: string; amount1: string } {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const token0IsKilt = this.pool.token0.address.toLowerCase() === KILT_TOKEN.address.toLowerCase();
    
    // Create currency amounts
    const kiltCurrency = CurrencyAmount.fromRawAmount(KILT_TOKEN, kiltAmount);
    const ethCurrency = CurrencyAmount.fromRawAmount(WETH_TOKEN, ethAmount);

    // Return amounts in token0/token1 order
    if (token0IsKilt) {
      return {
        amount0: kiltCurrency.quotient.toString(),
        amount1: ethCurrency.quotient.toString()
      };
    } else {
      return {
        amount0: ethCurrency.quotient.toString(),
        amount1: kiltCurrency.quotient.toString()
      };
    }
  }

  /**
   * Get current price from the pool
   */
  getCurrentPrice(): Price<Token, Token> | null {
    if (!this.pool) return null;
    return this.pool.token0Price;
  }

  /**
   * Get pool tokens in correct order
   */
  getPoolTokens(): { token0: Token; token1: Token } | null {
    if (!this.pool) return null;
    return {
      token0: this.pool.token0,
      token1: this.pool.token1
    };
  }

  /**
   * Convert tick to price
   */
  tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }

  /**
   * Convert price to tick
   */
  priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  /**
   * Get position value in USD
   */
  getPositionValue(position: Position, token0PriceUSD: number, token1PriceUSD: number): number {
    const amount0 = parseFloat(position.amount0.toFixed());
    const amount1 = parseFloat(position.amount1.toFixed());
    
    return (amount0 * token0PriceUSD) + (amount1 * token1PriceUSD);
  }

  /**
   * Check if position is in range
   */
  isPositionInRange(position: Position): boolean {
    if (!this.pool) return false;
    
    const currentTick = this.pool.tickCurrent;
    return currentTick >= position.tickLower && currentTick <= position.tickUpper;
  }
}

export default UniswapV3SDKService;