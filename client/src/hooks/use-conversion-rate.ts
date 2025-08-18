import { useQuery } from '@tanstack/react-query';

export interface ConversionRate {
  kiltEthRatio: number; // ETH per KILT
  ethKiltRatio: number; // KILT per ETH
  poolAddress: string;
  timestamp: number;
  source: string;
}

export function useKiltEthConversionRate() {
  return useQuery<ConversionRate>({
    queryKey: ['/api/conversion/kilt-eth-rate'],
    refetchInterval: 30000, // Refetch every 30 seconds for real-time rates
    staleTime: 15000, // Consider stale after 15 seconds
    retry: 3,
    retryDelay: 1000,
  });
}