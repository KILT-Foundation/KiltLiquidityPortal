import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface APRData {
  tradingFeeAPR: number;
  incentiveAPR: number;
  totalAPR: number;
  weightedAverageAPR?: number;
  breakdown?: string;
  error?: string;
}

interface AnalyticsData {
  averageTradingAPR: number;
  averageIncentiveAPR: number;
  totalLiquidity: number;
  totalPositions: number;
  averageAPR: number;
}

interface OptimizedQueriesResult {
  calculations: {
    feeAPR: string;
    kiltRewardAPR: string;
    totalAPR: string;
  };
  aprData: APRData | null;
  isLoading: boolean;
  error: string | null;
  source: string;
}

export function useOptimizedQueries(address?: string): OptimizedQueriesResult {
  const [calculations, setCalculations] = useState({
    feeAPR: '0.00',
    kiltRewardAPR: '0.00',
    totalAPR: '0.00'
  });

  // Fetch user APR data
  const { data: aprData, isLoading: aprLoading, error: aprError } = useQuery<APRData>({
    queryKey: ['/api/rewards/user-apr', address],
    enabled: !!address,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Fetch program analytics for fallback data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/rewards/program-analytics'],
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });

  // Update calculations when data changes - SINGLE SOURCE OF TRUTH
  useEffect(() => {
    if (aprData) {
      // Use user-specific APR data if available
      setCalculations({
        feeAPR: aprData.tradingFeeAPR?.toFixed(2) || '0.00',
        kiltRewardAPR: aprData.incentiveAPR?.toFixed(2) || '0.00',
        totalAPR: aprData.totalAPR?.toFixed(2) || '0.00'
      });
    } 
    // COMPLETELY REMOVE FALLBACK - ONLY USE REAL APR DATA FROM SINGLE SOURCE API
    // No more hardcoded values or program analytics fallbacks
  }, [aprData, analyticsData]);

  return {
    calculations,
    aprData: aprData || null,
    isLoading: aprLoading || analyticsLoading,
    error: aprError ? 'Failed to load APR data' : null,
    source: 'optimized-queries-real-data-only'
  };
}