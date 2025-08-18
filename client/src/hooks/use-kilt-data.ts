import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export interface KiltTokenData {
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  priceChange24h: number | null;
  totalSupply: number;
  treasuryAllocation: number;
  treasuryRemaining: number;
  distributionRate: number;
  programDuration: number;
  progress: number;
}

export interface RewardCalculation {
  baseAPR: number;
  timeMultiplier: number;
  sizeMultiplier: number;
  effectiveAPR: number;
  dailyRewards: number;
  liquidityAmount: number;
  daysStaked: number;
}

export interface NetworkStats {
  gasPrice: number;
  blockNumber: number;
  networkFee: number;
}

export function useKiltTokenData() {
  return useQuery<KiltTokenData>({
    queryKey: ['/api/kilt-data'],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}

export function useRewardCalculator() {
  const [params, setParams] = useState({
    liquidityAmount: 1000,
    daysStaked: 0,
    positionSize: 1000
  });

  const { data: calculation, isLoading } = useQuery<RewardCalculation>({
    queryKey: ['/api/calculate-rewards', params],
    enabled: params.liquidityAmount > 0,
    queryFn: async () => {
      const response = await fetch('/api/calculate-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('Failed to calculate rewards');
      return response.json();
    },
    refetchInterval: 10000, // Recalculate every 10 seconds
  });

  return {
    params,
    setParams,
    calculation,
    isLoading,
    updateLiquidity: (amount: number) => setParams(prev => ({ ...prev, liquidityAmount: amount })),
    updateDaysStaked: (days: number) => setParams(prev => ({ ...prev, daysStaked: days })),
    updatePositionSize: (size: number) => setParams(prev => ({ ...prev, positionSize: size })),
  };
}

export function useNetworkStats() {
  return useQuery<NetworkStats>({
    queryKey: ['/api/network-stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000,
  });
}