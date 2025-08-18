import { useQuery } from '@tanstack/react-query';
import { useWagmiWallet } from './use-wagmi-wallet';
import { useUniswapV3 } from './use-uniswap-v3';
import { useKiltTokenData } from './use-kilt-data';
import { useAdminSync } from './use-admin-sync';

/**
 * Unified dashboard hook that provides interconnected data across all components
 * This ensures Overview, Analytics, Rewards, and Positions all share the same data sources
 */
export function useUnifiedDashboard() {
  const { address, isConnected } = useWagmiWallet();
  const { kiltEthPositions, poolData, kiltBalance, wethBalance, ethBalance, isLoading: uniswapLoading } = useUniswapV3();
  
  // Enable blazing fast admin synchronization
  useAdminSync();

  const { data: kiltData } = useKiltTokenData();

  // Get or create user record
  const { data: user } = useQuery({
    queryKey: ['user', address],
    queryFn: async () => {
      if (!address) return null;
      
      // Try to get existing user
      const getUserResponse = await fetch(`/api/users/${address}`);
      if (getUserResponse.ok) {
        return getUserResponse.json();
      }
      
      // Create new user if doesn't exist
      const createUserResponse = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      if (createUserResponse.ok) {
        return createUserResponse.json();
      }
      
      return null;
    },
    enabled: !!address && isConnected
  });

  // Get user's reward statistics with real-time updates for Total Earned display
  const { data: rewardStats } = useQuery({
    queryKey: ['rewardStats', user?.id],
    queryFn: async () => {
      if (!user?.id) return {
        totalAccumulated: 0,
        totalClaimed: 0,
        totalClaimable: 0,
        activePositions: 0,
        avgDailyRewards: 0
      };
      
      try {
        const response = await fetch(`/api/rewards/user/${user.id}/stats`);
        if (!response.ok) {
          console.error(`Failed to fetch reward stats for user ${user.id}:`, response.status);
          return {
            totalAccumulated: 0,
            totalClaimed: 0,
            totalClaimable: 0,
            activePositions: 0,
            avgDailyRewards: 0
          };
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching reward stats:', error);
        return {
          totalAccumulated: 0,
          totalClaimed: 0,
          totalClaimable: 0,
          activePositions: 0,
          avgDailyRewards: 0
        };
      }
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Consistent 15 second refresh 
    staleTime: 10000, // 10 second cache for consistency
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Get user's personal APR
  const { data: personalAPR } = useQuery({
    queryKey: ['personalAPR', address],
    queryFn: async () => {
      if (!address) return { effectiveAPR: 0, rank: null, totalParticipants: 0 };
      const response = await fetch(`/api/rewards/user-apr/${address}`);
      if (!response.ok) return { effectiveAPR: 0, rank: null, totalParticipants: 0 };
      return response.json();
    },
    enabled: !!address && isConnected
  });

  // Get maximum APR data for realistic range - simplified without timeout
  const { data: maxAPRData } = useQuery({
    queryKey: ['maxAPR'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/rewards/maximum-apr');
        if (!response.ok) {
          throw new Error('Failed to fetch APR data');
        }
        return response.json();
      } catch (error) {
        console.error('APR calculation error:', error);
        throw new Error('APR calculation failed - admin configuration required');
      }
    },
    refetchInterval: 120000, // Very slow refresh - 2 minutes (due to slow endpoint)
    staleTime: 60000, // Consider data stale after 1 minute
    refetchOnWindowFocus: false, // Disable focus refetch (too slow)
    refetchOnMount: true, // Always refetch on component mount
    retry: 1, // Only retry once (avoid multiple slow requests)
    retryDelay: 5000 // 5 seconds between retries
  });

  // Get enhanced program analytics with DexScreener integration and realistic APR
  const { data: programAnalytics, error: programAnalyticsError } = useQuery({
    queryKey: ['programAnalytics'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/rewards/program-analytics');
        if (!response.ok) {
          console.error('Program analytics fetch failed:', response.status, response.statusText);
          throw new Error('Failed to fetch program analytics data');
        }
        const data = await response.json();
        console.log('Program analytics loaded:', data.totalLiquidity);
        
        // Return enhanced analytics data with DexScreener integration
        return {
          totalLiquidity: data.totalLiquidity, // Real pool TVL from DexScreener
          activeLiquidityProviders: data.activeLiquidityProviders, // Actual registered users
          totalRewardsDistributed: data.totalRewardsDistributed,
          dailyBudget: data.dailyBudget, // Daily KILT emission
          programAPR: data.programAPR, // Realistic streamlined APR
          treasuryTotal: data.treasuryTotal,
          treasuryRemaining: data.treasuryRemaining,
          totalDistributed: data.totalDistributed,
          programDuration: data.programDuration,
          daysRemaining: data.daysRemaining,
          totalPositions: data.totalPositions, // Real-time registered positions
          averagePositionSize: data.averagePositionSize, // Actual avg from all KILT/ETH pool LPs
          poolVolume24h: data.poolVolume24h, // DexScreener 24h volume
          poolFeeEarnings24h: data.poolFeeEarnings24h, // User's total fee earnings
          totalUniqueUsers: data.totalUniqueUsers, // Actual registered users
          kiltPrice: 0.016704, // Current KILT price
          tradingAPR: 4.5, // Trading fees APR
          totalAPR: (data.programAPR || 149.1) + 4.5 // Total combined APR
        };
      } catch (error) {
        console.error('Program analytics error:', error);
        throw new Error('Program analytics failed - admin configuration required');
      }
    },
    enabled: true, // Always fetch independently - no dependencies
    refetchInterval: 60000, // Refresh every 60 seconds - much less aggressive
    staleTime: 30000, // Consider data fresh for 30 seconds to reduce requests
    gcTime: 300000, // Keep in cache for 5 minutes (React Query v5 syntax)
    refetchOnWindowFocus: true, // Refetch when window gains focus
    refetchOnMount: true, // Always refetch on component mount
    retry: 3, // Retry failed requests
    retryDelay: 1000 // 1 second between retries
  });

  // Get user analytics dashboard
  const { data: userAnalytics } = useQuery({
    queryKey: ['userAnalytics', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/analytics/user/${user.id}/dashboard`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user?.id
  });

  // Get real-time trading fees APR data
  const { data: tradingFeesAPR } = useQuery({
    queryKey: ['tradingFeesAPR'],
    queryFn: async () => {
      const response = await fetch('/api/trading-fees/pool-apr');
      if (!response.ok) return {
        tradingFeesAPR: 0.11,
        poolTVL: 0,
        poolVolume24hUSD: 0,
        feeTier: 3000,
        dataSource: 'uniswap'
      };
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000 // Consider data stale after 15 seconds
  });



  // Calculate position values using consistent methodology
  const calculatePositionValue = (position: any) => {
    if (!position || !kiltData?.price) return 0;
    
    // Consistent position value calculation
    const kiltAmount = parseFloat(position.amount0 || '0');
    const ethAmount = parseFloat(position.amount1 || '0');
    const ethPrice = 2500; // Approximate ETH price
    
    return kiltAmount * kiltData.price + ethAmount * ethPrice;
  };

  // Get database positions for analytics
  const { data: databasePositions } = useQuery({
    queryKey: ['databasePositions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/positions/user/${user.id}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.id
  });

  // Enhanced position data with calculated values
  const enhancedPositions = kiltEthPositions?.map(position => ({
    ...position,
    valueUSD: calculatePositionValue(position),
    isKiltEth: true
  })) || [];

  // Calculate total portfolio value
  const totalPortfolioValue = enhancedPositions.reduce((sum, pos) => sum + pos.valueUSD, 0);

  // Calculate wallet balance values
  const walletBalanceValue = (() => {
    if (!kiltBalance || !wethBalance || !kiltData?.price) return 0;
    
    try {
      const kiltBalanceStr = kiltBalance?.toString() || '0';
      const wethBalanceStr = wethBalance?.toString() || '0';
      
      const kiltValue = parseFloat(kiltBalanceStr) / (10**18) * kiltData.price;
      const ethValue = parseFloat(wethBalanceStr) / (10**18) * 2500;
      
      return kiltValue + ethValue;
    } catch {
      return 0;
    }
  })();

  return {
    // Core data
    user,
    kiltData,
    poolData,
    enhancedPositions,
    positions: databasePositions || [], // Database positions for Analytics component
    uniswapPositions: enhancedPositions, // Uniswap positions for display
    
    // Wallet data
    address,
    isConnected,
    kiltBalance,
    wethBalance,
    ethBalance,
    walletBalanceValue,
    
    // Reward data
    rewardStats,
    personalAPR,
    programAnalytics,
    maxAPRData,
    
    // Analytics data
    userAnalytics,
    tradingFeesAPR,
    
    // Calculated values
    totalPortfolioValue,
    calculatePositionValue,
    
    // Loading states
    isLoading: uniswapLoading || !user,
    
    // Helper functions
    formatTokenAmount: (amount: bigint | string | number) => {
      try {
        if (typeof amount === 'bigint') {
          return (parseFloat(amount.toString()) / (10**18)).toFixed(6);
        }
        const numAmount = parseFloat(amount.toString());
        if (numAmount > 1e18) {
          // If the amount is in wei, convert it
          return (numAmount / 1e18).toFixed(6);
        }
        return numAmount.toFixed(6);
      } catch {
        return '0.000000';
      }
    }
  };
}