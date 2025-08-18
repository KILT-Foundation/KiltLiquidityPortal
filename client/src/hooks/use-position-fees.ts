import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch real-time unclaimed fees for a specific position
 */
export function usePositionFees(tokenId: string | null) {
  return useQuery({
    queryKey: [`/api/positions/${tokenId}/fees`],
    enabled: !!tokenId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    retry: 2,
  });
}

/**
 * Hook to fetch fees for multiple positions efficiently
 */
export function useMultiplePositionFees(tokenIds: string[]) {
  return useQuery({
    queryKey: [`/api/positions/fees/batch`, tokenIds],
    queryFn: async () => {
      if (!tokenIds.length) return {};
      
      // Fetch fees for each position
      const feePromises = tokenIds.map(async (tokenId) => {
        const response = await fetch(`/api/positions/${tokenId}/fees`);
        if (!response.ok) throw new Error(`Failed to fetch fees for position ${tokenId}`);
        const data = await response.json();
        return { tokenId, fees: data };
      });
      
      const results = await Promise.all(feePromises);
      
      // Convert to object for easy lookup
      return results.reduce((acc, { tokenId, fees }) => {
        acc[tokenId] = fees;
        return acc;
      }, {} as Record<string, any>);
    },
    enabled: tokenIds.length > 0,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
  });
}