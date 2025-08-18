import { useQuery } from '@tanstack/react-query';
import { useWagmiWallet } from './use-wagmi-wallet';

export interface Position {
  nftTokenId: string;
  tokenId: string;
  token0Amount: string;
  token1Amount: string;
  token0Address: string;
  token1Address: string;
  token0Symbol: string;
  token1Symbol: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  fee: number;
  isInRange: boolean;
  currentValueUSD: string;
  uncollectedFeesUSD: string;
}

export function usePositionData() {
  const { address, isConnected } = useWagmiWallet();

  const { data: positions = [], isLoading, error } = useQuery<Position[]>({
    queryKey: ['/api/positions/wallet', address],
    enabled: !!address && isConnected,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider stale after 5 seconds
    queryFn: async () => {
      if (!address) return [];
      
      const response = await fetch(`/api/positions/wallet/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      
      const data = await response.json();
      return data.positions || [];
    }
  });

  return {
    positions,
    isLoading,
    error,
    hasPositions: positions.length > 0,
    kiltPositions: positions.filter(p => 
      p.token0Symbol === 'KILT' || p.token1Symbol === 'KILT'
    ),
    refreshPositions: () => {
      // Invalidate and refetch positions
      if (address) {
        fetch(`/api/positions/wallet/${address}`).then(() => {
          // Trigger refetch
        });
      }
    }
  };
}