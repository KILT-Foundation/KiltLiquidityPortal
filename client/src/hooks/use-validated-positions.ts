import { useQuery } from '@tanstack/react-query';
import { useWagmiWallet } from './use-wagmi-wallet';

/**
 * Hook that validates registered database positions against live blockchain data
 * This ensures we only show positions that are both:
 * 1. Registered in our database (reward-eligible)
 * 2. Actually active on the blockchain (not closed/burned)
 */
export function useValidatedPositions(userId: number | undefined) {
  const { address, isConnected } = useWagmiWallet();

  return useQuery({
    queryKey: ['validated-positions', userId, address],
    queryFn: async () => {
      if (!userId || !address) return [];

      try {
        // Get registered positions from database
        const registeredResponse = await fetch(`/api/positions/user/${userId}`);
        if (!registeredResponse.ok) {
          throw new Error('Failed to fetch registered positions');
        }
        const registeredPositions = await registeredResponse.json();

        // Get live blockchain positions
        const blockchainResponse = await fetch(`/api/positions/wallet/${address}`);
        if (!blockchainResponse.ok) {
          throw new Error('Failed to fetch blockchain positions');
        }
        const blockchainPositions = await blockchainResponse.json();

        // Track burned positions for database cleanup
        const burnedPositions: string[] = [];
        
        // Cross-validate: only include registered positions that still exist on blockchain
        const validatedPositions = registeredPositions.map((dbPosition: any) => {
          const blockchainPosition = blockchainPositions.find((bcPosition: any) => 
            bcPosition.tokenId === dbPosition.nftTokenId
          );
          
          // Position must exist on blockchain
          if (!blockchainPosition) {
            console.warn(`Registered position ${dbPosition.nftTokenId} not found on blockchain - may have been burned`);
            burnedPositions.push(dbPosition.nftTokenId);
            return null;
          }

          // Check if position is still active (has liquidity)
          const hasLiquidity = blockchainPosition.liquidity && BigInt(blockchainPosition.liquidity) > 0n;
          if (!hasLiquidity) {
            console.warn(`Registered position ${dbPosition.nftTokenId} has no liquidity on blockchain - filtering out closed position`);
            return null; // Filter out positions with zero liquidity
          }

          // Merge database and blockchain data for complete position info
          return {
            ...dbPosition,
            // Use fresh blockchain data for critical fields
            liquidity: blockchainPosition.liquidity,
            token0Amount: blockchainPosition.token0Amount,
            token1Amount: blockchainPosition.token1Amount,
            currentValueUSD: blockchainPosition.currentValueUSD,
            isInRange: blockchainPosition.isInRange,
            fees: blockchainPosition.fees,
            isActive: true, // Only active positions make it this far
            // Include APR data from blockchain position
            totalAPR: blockchainPosition.totalAPR,
            tradingFeeAPR: blockchainPosition.tradingFeeAPR,
            aprBreakdown: blockchainPosition.aprBreakdown,
            // Keep database fields for reward tracking
            rewardEligible: dbPosition.rewardEligible,
            createdViaApp: dbPosition.createdViaApp,
            verificationStatus: dbPosition.verificationStatus
          };
        }).filter(Boolean); // Remove null entries (burned and zero-liquidity positions)

        // Automatically clean up burned positions from database
        if (burnedPositions.length > 0) {
          console.warn(`🔥 Auto-cleaning ${burnedPositions.length} burned positions from database:`, burnedPositions);
          
          try {
            const cleanupPromises = burnedPositions.map(async (tokenId) => {
              const response = await fetch(`/api/positions/cleanup-burned/${tokenId}`, {
                method: 'DELETE'
              });
              if (response.ok) {
                console.warn(`✅ Cleaned up burned position ${tokenId} from database`);
                return tokenId;
              } else {
                console.warn(`⚠️ Failed to cleanup burned position ${tokenId}`);
                return null;
              }
            });
            
            const cleanedUp = await Promise.all(cleanupPromises);
            const successfulCleanups = cleanedUp.filter(Boolean);
            
            if (successfulCleanups.length > 0) {
              console.warn(`✅ Successfully marked ${successfulCleanups.length} burned positions as inactive`);
            }
            
            // Invalidate related queries to refresh UI
            // Note: This will be handled by the component using this hook
          } catch (error) {
            console.error('Failed to cleanup burned positions:', error);
          }
        }
        
        return validatedPositions;
        
      } catch (error) {
        console.error('Failed to validate positions:', error);
        return [];
      }
    },
    enabled: !!userId && !!address && isConnected,
    staleTime: 30 * 1000, // 30 seconds - frequent validation to catch position changes
    gcTime: 2 * 60 * 1000, // 2 minutes retention
    refetchInterval: 60 * 1000, // Refresh every minute to detect closed positions
    refetchOnWindowFocus: true, // Revalidate when user returns to app
    retry: 2,
    networkMode: 'online' as const,
  });
}