import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { PriceService } from './price-service';
import { rpcManager } from './rpc-connection-manager';

/**
 * Direct Fee Service - Alternative approach using position data instead of simulation
 * Now uses managed RPC connections with automatic failover and rate limit handling
 */
export class DirectFeeService {

  private static readonly POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1' as `0x${string}`;

  /**
   * Get position data and calculate fees using collect simulation (like Uniswap interface)
   * This matches Uniswap's official method for displaying unclaimed fees
   */
  static async getUnclaimedFees(tokenId: string): Promise<{ 
    token0: string; 
    token1: string; 
    usdValue?: number;
    ethPrice?: number;
    kiltPrice?: number;
  }> {
    console.log(`🚀 DirectFeeService.getUnclaimedFees called for token ${tokenId} (using collect simulation)`);
    
    return await rpcManager.executeWithRetry(async (client) => {
      try {
        // First check if position exists and has liquidity
        const positionData = await client.readContract({
          address: this.POSITION_MANAGER,
          abi: [
            {
              inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
              name: 'positions',
              outputs: [
                { internalType: 'uint96', name: 'nonce', type: 'uint96' },
                { internalType: 'address', name: 'operator', type: 'address' },
                { internalType: 'address', name: 'token0', type: 'address' },
                { internalType: 'address', name: 'token1', type: 'address' },
                { internalType: 'uint24', name: 'fee', type: 'uint24' },
                { internalType: 'int24', name: 'tickLower', type: 'int24' },
                { internalType: 'int24', name: 'tickUpper', type: 'int24' },
                { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
                { internalType: 'uint256', name: 'feeGrowthInside0LastX128', type: 'uint256' },
                { internalType: 'uint256', name: 'feeGrowthInside1LastX128', type: 'uint256' },
                { internalType: 'uint128', name: 'tokensOwed0', type: 'uint128' },
                { internalType: 'uint128', name: 'tokensOwed1', type: 'uint128' },
              ],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'positions',
          args: [BigInt(tokenId)],
        });

        const [,,,,,,, liquidity] = positionData as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, number, number, bigint, bigint, bigint, bigint, bigint];
        
        if (liquidity === 0n) {
          console.log(`✅ Position ${tokenId} - no active liquidity`);
          return {
            token0: '0',
            token1: '0',
            usdValue: 0
          };
        }

        // Use collect simulation like Uniswap interface does (more accurate than tokensOwed)
        const MAX_UINT128 = BigInt('340282366920938463463374607431768211455');
        
        const collectParams: [bigint, `0x${string}`, bigint, bigint] = [
          BigInt(tokenId),                                    // tokenId
          '0x0000000000000000000000000000000000000000',       // recipient (zero for simulation)
          MAX_UINT128,                                        // amount0Max (uint128 max)
          MAX_UINT128                                         // amount1Max (uint128 max)
        ];

        const result = await client.simulateContract({
          address: this.POSITION_MANAGER as `0x${string}`,
          abi: [{
            inputs: [
              { name: 'tokenId', type: 'uint256' },
              { name: 'recipient', type: 'address' },
              { name: 'amount0Max', type: 'uint128' },
              { name: 'amount1Max', type: 'uint128' }
            ],
            name: 'collect',
            outputs: [
              { name: 'amount0', type: 'uint256' },
              { name: 'amount1', type: 'uint256' }
            ],
            stateMutability: 'payable',
            type: 'function'
          }],
          functionName: 'collect',
          args: collectParams
        });

        const [amount0, amount1] = result.result as [bigint, bigint];
        
        console.log(`✅ Position ${tokenId} - collect simulation fees: ${amount0.toString()} / ${amount1.toString()}`);
        
        // Convert to USD using real-time prices
        if (amount0 > 0n || amount1 > 0n) {
          try {
            const feeConversion = await PriceService.convertFeesToUSD(
              amount0.toString(),
              amount1.toString()
            );
            
            return {
              token0: amount0.toString(),
              token1: amount1.toString(),
              usdValue: feeConversion.totalUSD,
              ethPrice: feeConversion.ethPrice,
              kiltPrice: feeConversion.kiltPrice
            };
          } catch (priceError) {
            console.warn(`⚠️ Price conversion failed for ${tokenId}:`, priceError);
            return {
              token0: amount0.toString(),
              token1: amount1.toString(),
              usdValue: undefined
            };
          }
        }

        return {
          token0: '0',
          token1: '0',
          usdValue: 0
        };
        
      } catch (error: any) {
        console.error(`❌ Collect simulation failed for position ${tokenId}:`, error.shortMessage || error.message);
        
        // Fallback to tokensOwed if simulation fails
        try {
          const positionData = await client.readContract({
            address: this.POSITION_MANAGER,
            abi: [
              {
                inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
                name: 'positions',
                outputs: [
                  { internalType: 'uint96', name: 'nonce', type: 'uint96' },
                  { internalType: 'address', name: 'operator', type: 'address' },
                  { internalType: 'address', name: 'token0', type: 'address' },
                  { internalType: 'address', name: 'token1', type: 'address' },
                  { internalType: 'uint24', name: 'fee', type: 'uint24' },
                  { internalType: 'int24', name: 'tickLower', type: 'int24' },
                  { internalType: 'int24', name: 'tickUpper', type: 'int24' },
                  { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
                  { internalType: 'uint256', name: 'feeGrowthInside0LastX128', type: 'uint256' },
                  { internalType: 'uint256', name: 'feeGrowthInside1LastX128', type: 'uint256' },
                  { internalType: 'uint128', name: 'tokensOwed0', type: 'uint128' },
                  { internalType: 'uint128', name: 'tokensOwed1', type: 'uint128' },
                ],
                stateMutability: 'view',
                type: 'function',
              },
            ],
            functionName: 'positions',
            args: [BigInt(tokenId)],
          });

          const [,,,,,,, liquidity, , , tokensOwed0, tokensOwed1] = positionData as readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, number, number, bigint, bigint, bigint, bigint, bigint];
          
          console.log(`⚠️ Position ${tokenId} - fallback to tokensOwed: ${tokensOwed0.toString()} / ${tokensOwed1.toString()}`);
          
          if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
            const feeConversion = await PriceService.convertFeesToUSD(
              tokensOwed0.toString(),
              tokensOwed1.toString()
            );
            
            return {
              token0: tokensOwed0.toString(),
              token1: tokensOwed1.toString(),
              usdValue: feeConversion.totalUSD,
              ethPrice: feeConversion.ethPrice,
              kiltPrice: feeConversion.kiltPrice
            };
          }
          
          return {
            token0: '0',
            token1: '0',
            usdValue: 0
          };
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed for position ${tokenId}:`, fallbackError);
          throw error; // Re-throw original error
        }
      }
    }, `DirectFeeService.getUnclaimedFees(${tokenId})`);
  }

  /**
   * Get fees for multiple positions in parallel
   */
  static async getBatchUnclaimedFees(tokenIds: string[]): Promise<Record<string, { token0: string; token1: string; usdValue?: number }>> {
    const promises = tokenIds.map(async (tokenId) => {
      const fees = await this.getUnclaimedFees(tokenId);
      return { tokenId, fees };
    });

    const results = await Promise.all(promises);
    
    return results.reduce((acc, { tokenId, fees }) => {
      acc[tokenId] = fees;
      return acc;
    }, {} as Record<string, { token0: string; token1: string; usdValue?: number }>);
  }
}