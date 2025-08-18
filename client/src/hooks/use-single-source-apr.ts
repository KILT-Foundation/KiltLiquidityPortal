/**
 * SINGLE SOURCE OF TRUTH APR HOOK
 * 
 * This hook provides the ONLY authoritative APR data for all frontend components.
 * Replaces all other APR-related hooks and calculations.
 */

import { useQuery } from '@tanstack/react-query';

interface SingleSourceAPRData {
  // Program-wide APR (official values)
  programAPR: number;
  tradingAPR: number;
  totalProgramAPR: number;
  
  // User-specific APR (if available)
  userTradingAPR?: number;
  userIncentiveAPR?: number;
  userTotalAPR?: number;
  
  // Maximum theoretical APR
  maxTheoreticalAPR: number;
  
  // Metadata
  source: string;
  timestamp: number;
  totalParticipants: number;
  totalProgramTVL: number;
}

interface ExpectedReturnsDisplay {
  tradingAPR: string;
  incentiveAPR: string;
  totalAPR: string;
  source: string;
}

/**
 * Get official program APR - use this for all Expected Returns displays
 */
export function useOfficialAPR() {
  return useQuery<SingleSourceAPRData>({
    queryKey: ['/api/apr/official'],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Get formatted Expected Returns data - use this for Expected Returns components
 */
export function useExpectedReturns() {
  return useQuery<ExpectedReturnsDisplay>({
    queryKey: ['/api/apr/expected-returns'],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Get user-specific APR data - use this for user wallet analysis
 */
export function useUserAPR(address?: string) {
  return useQuery<SingleSourceAPRData>({
    queryKey: ['/api/apr/user', address],
    enabled: !!address,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * LEGACY REPLACEMENT: Single hook that replaces useOptimizedQueries
 * This maintains backward compatibility while using single source
 */
export function useSingleSourceAPR(address?: string) {
  // Get expected returns (program-wide APR)
  const { data: expectedReturns, isLoading: expectedLoading, error: expectedError } = useExpectedReturns();
  
  // Get user-specific APR if address provided
  const { data: userAPR, isLoading: userLoading } = useUserAPR(address);

  // Return formatted data for backward compatibility
  const calculations = {
    feeAPR: expectedReturns?.tradingAPR || '0.00',
    kiltRewardAPR: expectedReturns?.incentiveAPR || '0.00',
    totalAPR: expectedReturns?.totalAPR || '0.00'
  };

  return {
    calculations,
    aprData: userAPR || null,
    isLoading: expectedLoading || userLoading,
    error: expectedError ? 'Failed to load APR data' : null,
    source: 'single-source-apr'
  };
}