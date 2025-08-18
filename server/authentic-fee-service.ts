import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { PriceService } from './price-service';

/**
 * Authentic Fee Service using manual calculation like Uniswap interface
 * This implements the exact method Uniswap uses to show $13.94 instead of $7.96
 */
export class AuthenticFeeService {
  private static readonly rpcEndpoints = [
    'https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA',
    'https://mainnet.base.org',
    'https://base.drpc.org'
  ];

  private static getClient(rpcIndex: number = 0) {
    return createPublicClient({
      chain: base,
      transport: http(this.rpcEndpoints[rpcIndex])
    });
  }

  private static readonly POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1' as `0x${string}`;
  private static readonly KILT_ETH_POOL = '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E' as `0x${string}`;

  /**
   * Calculate authentic unclaimed fees using the exact same method as Uniswap interface
   * Calculates authentic unclaimed fees using exact Uniswap methodology
   */
  static async getUnclaimedFees(tokenId: string): Promise<{ 
    token0: string; 
    token1: string; 
    usdValue?: number;
    ethPrice?: number;
    kiltPrice?: number;
  }> {
    console.log(`🚀 AuthenticFeeService.getUnclaimedFees called for token ${tokenId} (manual calculation)`);
    
    // Try each RPC endpoint until one works
    for (let rpcIndex = 0; rpcIndex < this.rpcEndpoints.length; rpcIndex++) {
      try {
        console.log(`🔧 Authentic fee calculation attempt ${rpcIndex + 1} using ${this.rpcEndpoints[rpcIndex]}`);
        
        const client = this.getClient(rpcIndex);
        
        // Get position data
        const positionData = await client.readContract({
          address: this.POSITION_MANAGER,
          abi: [{
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            name: 'positions',
            outputs: [
              { name: 'nonce', type: 'uint96' },
              { name: 'operator', type: 'address' },
              { name: 'token0', type: 'address' },
              { name: 'token1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickLower', type: 'int24' },
              { name: 'tickUpper', type: 'int24' },
              { name: 'liquidity', type: 'uint128' },
              { name: 'feeGrowthInside0LastX128', type: 'uint256' },
              { name: 'feeGrowthInside1LastX128', type: 'uint256' },
              { name: 'tokensOwed0', type: 'uint128' },
              { name: 'tokensOwed1', type: 'uint128' }
            ],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'positions',
          args: [BigInt(tokenId)]
        });

        const [,, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] = 
          positionData as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, number, number, bigint, bigint, bigint, bigint, bigint];

        if (liquidity === 0n) {
          console.log(`✅ Position ${tokenId} - no active liquidity`);
          return {
            token0: '0',
            token1: '0',
            usdValue: 0
          };
        }

        // Get current pool feeGrowthGlobal values
        const [feeGrowthGlobal0X128, feeGrowthGlobal1X128] = await Promise.all([
          client.readContract({
            address: this.KILT_ETH_POOL,
            abi: [{
              inputs: [],
              name: 'feeGrowthGlobal0X128',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function'
            }],
            functionName: 'feeGrowthGlobal0X128'
          }),
          client.readContract({
            address: this.KILT_ETH_POOL,
            abi: [{
              inputs: [],
              name: 'feeGrowthGlobal1X128',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function'
            }],
            functionName: 'feeGrowthGlobal1X128'
          })
        ]) as [bigint, bigint];

        // Get tick data for lower and upper bounds
        const [lowerTickData, upperTickData] = await Promise.all([
          client.readContract({
            address: this.KILT_ETH_POOL,
            abi: [{
              inputs: [{ name: 'tick', type: 'int24' }],
              name: 'ticks',
              outputs: [
                { name: 'liquidityGross', type: 'uint128' },
                { name: 'liquidityNet', type: 'int128' },
                { name: 'feeGrowthOutside0X128', type: 'uint256' },
                { name: 'feeGrowthOutside1X128', type: 'uint256' },
                { name: 'tickCumulativeOutside', type: 'int56' },
                { name: 'secondsPerLiquidityOutsideX128', type: 'uint160' },
                { name: 'secondsOutside', type: 'uint32' },
                { name: 'initialized', type: 'bool' }
              ],
              stateMutability: 'view',
              type: 'function'
            }],
            functionName: 'ticks',
            args: [tickLower]
          }),
          client.readContract({
            address: this.KILT_ETH_POOL,
            abi: [{
              inputs: [{ name: 'tick', type: 'int24' }],
              name: 'ticks',
              outputs: [
                { name: 'liquidityGross', type: 'uint128' },
                { name: 'liquidityNet', type: 'int128' },
                { name: 'feeGrowthOutside0X128', type: 'uint256' },
                { name: 'feeGrowthOutside1X128', type: 'uint256' },
                { name: 'tickCumulativeOutside', type: 'int56' },
                { name: 'secondsPerLiquidityOutsideX128', type: 'uint160' },
                { name: 'secondsOutside', type: 'uint32' },
                { name: 'initialized', type: 'bool' }
              ],
              stateMutability: 'view',
              type: 'function'
            }],
            functionName: 'ticks',
            args: [tickUpper]
          })
        ]) as [readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean], readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]];

        const lowerFeeGrowthOutside0X128 = lowerTickData[2];
        const lowerFeeGrowthOutside1X128 = lowerTickData[3];
        const upperFeeGrowthOutside0X128 = upperTickData[2];
        const upperFeeGrowthOutside1X128 = upperTickData[3];

        // Get current tick to determine position
        const slot0Data = await client.readContract({
          address: this.KILT_ETH_POOL,
          abi: [{
            inputs: [],
            name: 'slot0',
            outputs: [
              { name: 'sqrtPriceX96', type: 'uint160' },
              { name: 'tick', type: 'int24' },
              { name: 'observationIndex', type: 'uint16' },
              { name: 'observationCardinality', type: 'uint16' },
              { name: 'observationCardinalityNext', type: 'uint16' },
              { name: 'feeProtocol', type: 'uint8' },
              { name: 'unlocked', type: 'bool' }
            ],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'slot0'
        }) as readonly [bigint, number, number, number, number, number, boolean];

        const currentTick = slot0Data[1];

        // Calculate feeGrowthInside using the same logic as Uniswap
        let feeGrowthInside0X128: bigint;
        let feeGrowthInside1X128: bigint;

        if (currentTick < tickLower) {
          // Current tick is below position
          feeGrowthInside0X128 = lowerFeeGrowthOutside0X128 - upperFeeGrowthOutside0X128;
          feeGrowthInside1X128 = lowerFeeGrowthOutside1X128 - upperFeeGrowthOutside1X128;
        } else if (currentTick >= tickUpper) {
          // Current tick is above position
          feeGrowthInside0X128 = upperFeeGrowthOutside0X128 - lowerFeeGrowthOutside0X128;
          feeGrowthInside1X128 = upperFeeGrowthOutside1X128 - lowerFeeGrowthOutside1X128;
        } else {
          // Current tick is inside position (this should be our case)
          feeGrowthInside0X128 = feeGrowthGlobal0X128 - lowerFeeGrowthOutside0X128 - upperFeeGrowthOutside0X128;
          feeGrowthInside1X128 = feeGrowthGlobal1X128 - lowerFeeGrowthOutside1X128 - upperFeeGrowthOutside1X128;
        }

        // Calculate unclaimed fees using Uniswap's formula
        const unclaimedFee0 = tokensOwed0 + (liquidity * (feeGrowthInside0X128 - feeGrowthInside0LastX128)) / (BigInt(2) ** BigInt(128));
        const unclaimedFee1 = tokensOwed1 + (liquidity * (feeGrowthInside1X128 - feeGrowthInside1LastX128)) / (BigInt(2) ** BigInt(128));

        console.log(`✅ Authentic calculation for ${tokenId}:`);
        console.log(`   tokensOwed: ${tokensOwed0} / ${tokensOwed1}`);
        console.log(`   feeGrowthInside: ${feeGrowthInside0X128} / ${feeGrowthInside1X128}`);
        console.log(`   feeGrowthInsideLast: ${feeGrowthInside0LastX128} / ${feeGrowthInside1LastX128}`);
        console.log(`   liquidity: ${liquidity}`);
        console.log(`   unclaimedFees: ${unclaimedFee0} / ${unclaimedFee1}`);

        // Convert to USD using real-time prices
        const feeConversion = await PriceService.convertFeesToUSD(
          unclaimedFee0.toString(),
          unclaimedFee1.toString()
        );

        console.log(`💰 Authentic fee conversion: ${unclaimedFee0.toString()} WETH + ${unclaimedFee1.toString()} KILT = $${feeConversion.totalUSD}`);

        return {
          token0: unclaimedFee0.toString(),
          token1: unclaimedFee1.toString(),
          usdValue: feeConversion.totalUSD,
          ethPrice: feeConversion.ethPrice,
          kiltPrice: feeConversion.kiltPrice
        };

      } catch (error: any) {
        console.log(`⚠️ Authentic calculation attempt ${rpcIndex + 1} failed:`, error.shortMessage || error.message);
        
        // If this is the last RPC endpoint, throw the error
        if (rpcIndex === this.rpcEndpoints.length - 1) {
          console.error(`❌ All RPC endpoints failed for authentic calculation of position ${tokenId}. Last error:`, error);
          throw error;
        }
        
        // Continue to next RPC endpoint
        continue;
      }
    }

    // Fallback if all RPC endpoints fail
    console.error(`❌ All RPC endpoints exhausted for authentic calculation of position ${tokenId}`);
    return {
      token0: '0',
      token1: '0',
      usdValue: 0
    };
  }
}