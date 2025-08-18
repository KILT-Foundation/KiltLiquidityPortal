import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Real-time admin synchronization hook
 * Automatically detects admin panel changes and triggers blazing fast cache invalidation
 */
export function useAdminSync() {
  const queryClient = useQueryClient();
  const lastUpdateRef = useRef<number>(0);
  
  useEffect(() => {
    const checkForAdminUpdates = async () => {
      try {
        // Simple fetch without AbortController to avoid unhandled rejections
        const response = await Promise.race([
          fetch('/api/admin/operations', {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);
        
        if (response.ok) {
          const operations = await response.json();
          
          if (Array.isArray(operations) && operations.length > 0) {
            const latestOperation = operations[0];
            const operationTime = new Date(latestOperation.timestamp).getTime();
            
            // If there's a new admin operation since last check
            if (operationTime > lastUpdateRef.current) {
              console.log('🚀 Admin change detected - triggering blazing fast cache refresh');
              
              // Invalidate all admin-dependent queries for instant updates
              queryClient.invalidateQueries({ queryKey: ['maxAPR'] });
              queryClient.invalidateQueries({ queryKey: ['programAnalytics'] });
              queryClient.invalidateQueries({ queryKey: ['/api/rewards/maximum-apr'] });
              queryClient.invalidateQueries({ queryKey: ['/api/rewards/program-analytics'] });
              queryClient.invalidateQueries({ queryKey: ['personalAPR'] });
              queryClient.invalidateQueries({ queryKey: ['rewardStats'] });
              
              // Add missing reward stats query keys that should update with admin changes
              queryClient.invalidateQueries({ queryKey: ['reward-stats'] });
              queryClient.invalidateQueries({ queryKey: ['user-average-apr'] });
              queryClient.invalidateQueries({ queryKey: ['claimability'] });
              queryClient.invalidateQueries({ queryKey: ['expected-returns'] });
              queryClient.invalidateQueries({ queryKey: ['maximum-apr'] });
              queryClient.invalidateQueries({ queryKey: ['program-analytics'] });
              
              // Invalidate specific user-based queries with addresses  
              queryClient.invalidateQueries({ queryKey: ['user-average-apr'], exact: false });
              queryClient.invalidateQueries({ queryKey: ['claimability'], exact: false });
              queryClient.invalidateQueries({ queryKey: ['reward-history'], exact: false });
              
              // Invalidate unified dashboard queries - THE CRITICAL ONE!
              queryClient.invalidateQueries({ queryKey: ['rewardStats'], exact: false });
              queryClient.invalidateQueries({ queryKey: ['user'], exact: false });
              queryClient.invalidateQueries({ queryKey: ['user-stats'], exact: false });
              queryClient.invalidateQueries({ queryKey: ['user-dashboard'], exact: false });
              
              // Force immediate refetch for blazing fast updates
              queryClient.refetchQueries({ queryKey: ['maxAPR'] });
              queryClient.refetchQueries({ queryKey: ['programAnalytics'] });
              queryClient.refetchQueries({ queryKey: ['reward-stats'] });
              queryClient.refetchQueries({ queryKey: ['user-average-apr'] });
              
              lastUpdateRef.current = operationTime;
            }
          }
        }
      } catch (error) {
        // Silent fail - admin sync failures shouldn't disrupt user experience
        // Suppress all errors to prevent runtime overlays
        return;
      }
    };
    
    // Check for admin updates every 2 seconds for blazing fast synchronization
    const interval = setInterval(checkForAdminUpdates, 2000);
    
    // Initial check
    checkForAdminUpdates();
    
    return () => clearInterval(interval);
  }, [queryClient]);
}