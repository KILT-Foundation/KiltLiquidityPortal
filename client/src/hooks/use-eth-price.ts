import { useQuery } from '@tanstack/react-query';

export interface EthPriceData {
  ethPrice: number;
  timestamp: number;
  source: string;
}

export function useEthPrice() {
  return useQuery<EthPriceData>({
    queryKey: ['/api/eth-price'],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}