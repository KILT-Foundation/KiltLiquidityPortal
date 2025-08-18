import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Prefetch critical data on app load for instant navigation
export function usePrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchCriticalData = async () => {
      // Prefetch essential data that's likely to be needed
      const criticalQueries = [
        ['/api/kilt-data'],
        ['/api/blockchain-config'],
        ['/api/rewards/program-analytics'],
        ['/api/rewards/maximum-apr'],
      ];

      // Fire all prefetch requests simultaneously
      await Promise.allSettled(
        criticalQueries.map(queryKey => 
          queryClient.prefetchQuery({
            queryKey,
            staleTime: 2 * 60 * 1000, // 2 minutes
          })
        )
      );
    };

    // Prefetch after a short delay to not block initial render
    setTimeout(prefetchCriticalData, 100);
  }, [queryClient]);
}