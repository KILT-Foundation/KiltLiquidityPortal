import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface UserPersonalAPRProps {
  address: string;
}

export function UserPersonalAPR({ address }: UserPersonalAPRProps) {
  const { data: userAPR, isLoading } = useQuery({
    queryKey: ['/api/rewards/user-apr', address],
    queryFn: async () => {
      try {
        // Get user's positions and calculate their ranking-based APR
        const response = await fetch(`/api/rewards/user-apr/${address}`);
        if (!response.ok) {
          console.warn('User APR fetch failed, using fallback');
          return { effectiveAPR: 0, rank: null };
        }
        return response.json();
      } catch (error) {
        console.warn('User APR error (gracefully handled):', error);
        return { effectiveAPR: 0, rank: null };
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!address,
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (!userAPR) {
    return (
      <div className="text-center">
        <span className="text-white/50">0.0%</span>
        <div className="text-white/40 text-xs mt-1">No positions</div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <span className="text-numbers">
        {userAPR.totalAPR?.toFixed(1) || userAPR.effectiveAPR.toFixed(1)}%
      </span>
      <div className="text-white/60 text-xs mt-1">
        {userAPR.tradingFeeAPR && userAPR.incentiveAPR ? (
          <div className="space-y-1">
            <div>{userAPR.tradingFeeAPR.toFixed(1)}% Trading + {userAPR.incentiveAPR.toFixed(1)}% Incentive</div>
            <div>{userAPR.rank ? `Active participant` : 'Not active'}</div>
          </div>
        ) : (
          <div>{userAPR.rank ? `Active participant` : 'Not active'}</div>
        )}
      </div>
    </div>
  );
}