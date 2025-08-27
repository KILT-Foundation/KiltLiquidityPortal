import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useUserPositions, useUserRewards } from '@/hooks/use-pool-data';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
// Token addresses now managed via blockchain configuration service
import { 
  Layers, 
  Gift, 
  Award, 
  Plus, 
  Minus, 
  DollarSign, 
  TrendingUp, 
  ExternalLink,
  RefreshCw,
  Settings,
  Eye,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

import { useState, useEffect } from 'react';
import { TOKENS } from '@/lib/uniswap-v3';
import { TokenLogo, KiltLogo, EthLogo } from '@/components/ui/token-logo';
import { useKiltTokenData } from '@/hooks/use-kilt-data';
import { useKiltEthConversionRate } from '@/hooks/use-conversion-rate';
import { UniswapModal } from '@/components/uniswap-modal';
import { useValidatedPositions } from '@/hooks/use-validated-positions';
import { useMultiplePositionFees } from '@/hooks/use-position-fees';
import { UniswapStyleLiquidityModal } from '@/components/uniswap-style-liquidity-modal';
import { CompleteRemoveLiquidityButton } from '@/components/complete-remove-liquidity-button';
import { TOKEN_ADDRESSES } from '@/lib/contracts';

export function UserPositions() {
  const { address, isConnected } = useWagmiWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const unifiedData = useUnifiedDashboard();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [modalPosition, setModalPosition] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove' | 'collect' | null>(null);
  const [showClosedPositions, setShowClosedPositions] = useState(false);
  const [logoAnimationComplete, setLogoAnimationComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [managementMode, setManagementMode] = useState<'increase' | 'decrease' | 'collect' | null>(null);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [liquidityAmount, setLiquidityAmount] = useState('');

  // Logo animation timing - optimize with single effect
  useEffect(() => {
    const timer = setTimeout(() => setLogoAnimationComplete(true), 800);
    return () => clearTimeout(timer);
  }, []);
  
  // KILT data hook and real-time conversion rates
  const { data: kiltData } = useKiltTokenData();
  const { data: conversionRate } = useKiltEthConversionRate();

  // Get real-time trading fees APR from DexScreener API (same logic as Trading Fees APR card)
  const { data: tradingFeesData } = useQuery({
    queryKey: ['/api/trading-fees/pool-apr'],
    staleTime: 0, // Always fetch fresh data from DexScreener API
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes for real-time data
    refetchOnWindowFocus: true, // Refresh on window focus for latest data
  });

  // Mobile device detection for performance optimization
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 768 || 
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );

  // Get validated positions (database-registered AND blockchain-verified)
  const { data: validatedPositions, isLoading: validatedPositionsLoading, error: validatedPositionsError } = useValidatedPositions(unifiedData?.user?.id);
  
  // Get position token IDs for fee fetching (database positions use nftTokenId)
  const tokenIds = Array.isArray(validatedPositions) ? validatedPositions.map((pos: any) => pos.nftTokenId || pos.tokenId || pos.id?.toString()).filter(Boolean) : [];
  
  // Fetch fees for all positions
  const { data: positionFees = {} } = useMultiplePositionFees(tokenIds);

  // Mobile-optimized blazing fast position loading
  const mobileOptimizedConfig = isMobile ? {
    staleTime: 2 * 60 * 1000, // 2 minutes for mobile to save bandwidth
    gcTime: 10 * 60 * 1000, // 10 minutes retention
    refetchInterval: false, // No background refresh on mobile to save battery
    refetchOnWindowFocus: false,
    retry: 2, // Fewer retries for mobile
    networkMode: 'online' as const,
  } : {
    staleTime: 30 * 1000, // 30 seconds for desktop
    gcTime: 5 * 60 * 1000, // 5 minutes retention
    refetchInterval: 60 * 1000, // Background refresh for desktop
    refetchOnWindowFocus: false,
    retry: 3,
    networkMode: 'online' as const,
  };

  // Legacy Uniswap integration for management functions
  const {
    userPositions,
    kiltEthPositions: legacyKiltEthPositions,
    poolData,
    kiltBalance,
    wethBalance,
    isLoading: uniswapLoading,
    increaseLiquidity,
    decreaseLiquidity,
    collectFees,
    burnPosition,
    isIncreasing,
    isDecreasing,
    isCollecting,
    isBurning,
    formatTokenAmount,
    parseTokenAmount,
    calculatePositionValue,
    isPositionInRange
  } = useUniswapV3();

  // Optimized BigInt renderer
  const safeBigIntRender = (value: bigint | number | string) => 
    typeof value === 'bigint' ? value.toString() : value?.toString() || '0';

  // Use validated positions (database-registered AND blockchain-verified)
  const allKiltPositions = Array.isArray(validatedPositions) ? validatedPositions : [];
  const positionsData = Array.isArray(validatedPositions) ? validatedPositions : [];
  
  // Positions are loading correctly - 4 KILT positions with real-time data
  
  // Filter positions based on toggle state and sort by value (descending)
  const filteredPositions = showClosedPositions 
    ? allKiltPositions 
    : allKiltPositions.filter((pos: any) => BigInt(pos.liquidity || 0) > 0n);
    
  // Sort positions by value in descending order (biggest first)
  const kiltPositions = [...filteredPositions].sort((a: any, b: any) => {
    const valueA = parseFloat(a.currentValueUSD || a.currentValueUsd || calculatePositionValue(a) || 0);
    const valueB = parseFloat(b.currentValueUSD || b.currentValueUsd || calculatePositionValue(b) || 0);
    return valueB - valueA; // Descending order (biggest first)
  });
    
  // Count open and closed positions
  const openPositions = allKiltPositions.filter((pos: any) => BigInt(pos.liquidity || 0) > 0n);
  const closedPositions = allKiltPositions.filter((pos: any) => BigInt(pos.liquidity || 0) === 0n);
  
  // Count non-KILT positions
  const nonKiltPositions = Array.isArray(userPositions) ? userPositions.filter((pos: any) => {
    const kiltTokenAddress = TOKEN_ADDRESSES.KILT; // Retrieved from centralized constants
    const hasKilt = pos.token0?.toLowerCase() === kiltTokenAddress.toLowerCase() || 
                   pos.token1?.toLowerCase() === kiltTokenAddress.toLowerCase();
    return !hasKilt;
  }) : [];
  




  // Database rewards integration
  const { data: userData } = useQuery({
    queryKey: [`/api/users/${address}`],
    enabled: !!address,
  });

  const typedUserData = userData as { id: number } | undefined;
  const { data: rewards = [] } = useUserRewards(typedUserData?.id || null);

  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!typedUserData?.id) throw new Error('User not found');
      const response = await apiRequest(`/api/rewards/claim/${typedUserData.id}`, {
        method: 'POST',
        data: {}
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Rewards Claimed",
        description: "Your rewards have been successfully claimed.",
      });
      if (typedUserData?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/rewards/user/${typedUserData.id}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to claim rewards",
        variant: "destructive",
      });
    },
  });

  const handleLiquidityManagement = async () => {
    if (!selectedPosition || !managementMode) return;

    setIsProcessing(true);
    try {
      switch (managementMode) {
        case 'increase':
          await increaseLiquidity({
            tokenId: selectedPosition,
            amount0Desired: parseTokenAmount(amount0),
            amount1Desired: parseTokenAmount(amount1),
            amount0Min: '0',
            amount1Min: '0'
          });
          break;
        case 'decrease':
          // Calculate actual liquidity amount from percentage
          const currentPosition = Array.isArray(validatedPositions) ? validatedPositions.find((pos: any) => pos.nftTokenId === selectedPosition) : null;
          if (!currentPosition) {
            throw new Error('Position not found');
          }
          
          const percentage = parseFloat(liquidityAmount) / 100;
          const actualLiquidityAmount = (BigInt(currentPosition.liquidity) * BigInt(Math.floor(percentage * 100)) / BigInt(100)).toString();
          
          await decreaseLiquidity({
            tokenId: selectedPosition,
            liquidity: actualLiquidityAmount,
            amount0Min: '0',
            amount1Min: '0'
          });
          break;
        case 'collect':
          await collectFees({
            tokenId: selectedPosition
          });
          break;
      }
      
      setManagementMode(null);
      setSelectedPosition(null);
      setAmount0('');
      setAmount1('');
      setLiquidityAmount('');
      
      // INSTANT UI UPDATE - Remove position immediately from UI
      if (managementMode === 'decrease' && liquidityAmount === '100') {
        // For 100% removal, immediately remove position from UI
        queryClient.setQueryData([`/api/positions/user/${unifiedData?.user?.id}`], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.filter((pos: any) => pos.nftTokenId !== selectedPosition);
        });
      }
      
      // BLAZING FAST CACHE INVALIDATION - Force refresh registered positions data
      queryClient.invalidateQueries({ queryKey: [`/api/positions/user/${unifiedData?.user?.id}`] });
      queryClient.refetchQueries({ queryKey: [`/api/positions/user/${unifiedData?.user?.id}`] });
      
      // Also force refresh unified dashboard data
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/program-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/user-apr', address] });
      
      toast({
        title: "Success",
        description: `Position ${managementMode} completed successfully`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: (error as Error)?.message || `Failed to ${managementMode} position`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="cluely-card rounded-lg">
        <CardContent className="p-4 text-center">
          <p className="text-white/60 text-xs">Connect your wallet to view your positions</p>
        </CardContent>
      </Card>
    );
  }

  if (validatedPositionsLoading || uniswapLoading) {
    return (
      <Card className="cluely-card rounded-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center space-x-2 text-white font-heading text-sm">
            <Layers className="h-3 w-3 text-blue-400" />
            <span>Your LP Positions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-3">
                <Skeleton className="h-6 w-20 mb-2" />
                <Skeleton className="h-3 w-28 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const unclaimedRewards = Array.isArray(rewards) ? rewards.filter((r: { claimedAt?: Date | null }) => !r.claimedAt) : [];
  const totalUnclaimed = unclaimedRewards.reduce((sum: number, r: { amount: string | number }) => {
    // Safe null check before toString()
    const amount = r.amount;
    if (amount === null || amount === undefined) return sum;
    return sum + parseFloat(amount.toString());
  }, 0);

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* Main Positions Grid */}
      <Card key={`positions-${Array.isArray(allKiltPositions) ? allKiltPositions.length : 0}`} className="cluely-card rounded-lg min-h-0">
        <CardHeader className="flex flex-col space-y-1.5 p-6 pb-4 from-slate-900/50 to-slate-800/50 backdrop-blur-sm border-b border-white/10 bg-[#000000]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left Side - Title and Stats */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#ff0066]/20 to-[#ff0066]/20 rounded-xl flex items-center justify-center border border-[#ff0066]/30 shadow-lg shadow-[#ff0066]/10">
                <Layers className="h-6 w-6 text-pink-400" />
              </div>
              <div>
                <CardTitle className="text-white font-bold text-xl mb-1">
                  Your KILT LP Positions
                </CardTitle>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-white/60">Real-time Uniswap V3 positions containing KILT token</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3 text-[#ff0066]" />
                    <span className="text-[#ff0066] text-xs">sorted by value</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Controls */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-6 bg-white/5 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="text-white text-sm numeric-mono">{Array.isArray(allKiltPositions) ? allKiltPositions.length : 0}</span>
                  <span className="text-white/60 text-sm">total</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-emerald-400 text-sm numeric-mono">{Array.isArray(openPositions) ? openPositions.length : 0}</span>
                  <span className="text-white/60 text-sm">active</span>
                </div>
                {Array.isArray(closedPositions) && closedPositions.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-400 text-sm numeric-mono">{Array.isArray(closedPositions) ? closedPositions.length : 0}</span>
                    <span className="text-white/60 text-sm">closed</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge className="bg-black/20 backdrop-blur-sm text-white border-white/20 px-3 py-1.5 text-xs font-medium">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                  Live
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (address) {
                      try {
                        // Clear server-side cache first for fresh data
                        await fetch(`/api/positions/clear-cache/${address}`, { method: 'POST' });
                        
                        // Then invalidate React Query cache
                        queryClient.invalidateQueries({ queryKey: [`/api/positions/wallet/${address}`] });
                        
                        toast({
                          title: "Cache Cleared",
                          description: "Fresh position data loading...",
                        });
                      } catch (error) {
                        // Fallback to just React Query invalidation
                        queryClient.invalidateQueries({ queryKey: [`/api/positions/wallet/${address}`] });
                        
                        toast({
                          title: "Refreshing Positions",
                          description: "Updated position data loading...",
                        });
                      }
                    }
                  }}
                  className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/50 hover:border-slate-500/80 text-white hover:text-white h-9 px-3 backdrop-blur-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
          
          {/* Bottom Row - Toggle for closed positions */}
          {closedPositions.length > 0 && (
            <div className="flex items-center justify-end mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-white/60">Show closed positions</span>
                <button
                  onClick={() => setShowClosedPositions(!showClosedPositions)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:ring-offset-2 focus:ring-offset-black ${
                    showClosedPositions 
                      ? 'bg-gradient-to-r from-[#ff0066] to-[#ff0066] shadow-lg shadow-[#ff0066]/25' 
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out shadow-sm ${
                      showClosedPositions ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 w-full">
          {validatedPositionsLoading ? (
            <div className="text-center py-4">
              <p className="text-white/60 text-xs">Validating positions...</p>
              <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-pink-500 rounded-full mx-auto mt-2"></div>
            </div>
          ) : validatedPositionsError ? (
            <div className="text-center py-4">
              <p className="text-red-400 text-xs">Error validating positions</p>
              <p className="text-white/40 text-xs">{String(validatedPositionsError)}</p>
            </div>
          ) : !Array.isArray(allKiltPositions) || allKiltPositions.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-white/60 text-xs">No registered KILT positions found</p>
              <p className="text-white/40 text-xs">Register your positions in the Overview tab to start earning rewards</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
              {kiltPositions.map((position: any) => {
                // Handle different data structures between database and blockchain positions
                const rawValue = position.currentValueUSD || position.currentValueUsd || calculatePositionValue(position) || 0;
                const positionValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue.toString()) || 0;
                const inRange = position.isInRange; // Use backend-calculated range status
                const isClosed = BigInt(position.liquidity || 0) === 0n;
                const ethAmount = position.token0Amount ? (parseFloat(position.token0Amount) / 1e18).toFixed(3) : '0.000';
                const kiltAmount = position.token1Amount ? (parseFloat(position.token1Amount) / 1e18).toFixed(0) : '0';
                // Get real-time fees from API (database positions use nftTokenId)
                const tokenId = position.nftTokenId || position.tokenId || position.id?.toString();
                const realFees = positionFees[tokenId];
                const ethFees = realFees?.token0 ? (parseFloat(realFees.token0) / 1e18).toFixed(4) : '0.0000';
                const kiltFees = realFees?.token1 ? (parseFloat(realFees.token1) / 1e18).toFixed(2) : '0.00';
                const totalFeesUSD = realFees?.usdValue || 0;
                
                return (
                  <div key={(position.tokenId || position.nftTokenId || position.id).toString()} className={`cyberpunk-position-card ${isClosed ? 'opacity-60' : ''}`}>
                    {/* Header */}
                    <div className="cyberpunk-header">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const tokenId = position.tokenId || position.nftTokenId || position.id;
                            const uniswapUrl = `https://app.uniswap.org/pool/${tokenId}`;
                            window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="text-sm font-semibold text-pink-primary hover:text-[#ff0066] transition-colors duration-200 cursor-pointer hover:underline flex items-center gap-1"
                          title="View on Uniswap"
                        >
                          #{position.tokenId || position.nftTokenId || position.id}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                        <div className={`cyberpunk-status ${inRange ? 'status-online' : 'status-warning'}`}>
                          {inRange ? 'ONLINE' : 'OFFLINE'}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-lg font-semibold text-white numeric-display">${positionValue.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Data Grid */}
                    <div className="cyberpunk-terminal-grid">
                      <div className="terminal-block eth-block">
                        <div className="terminal-header">
                          <span className="terminal-label">WETH</span>
                        </div>
                        <div className="terminal-value">{ethAmount}</div>
                        <div className="terminal-sublabel">${(parseFloat(ethAmount) * (kiltData?.price && conversionRate?.kiltEthRatio ? (kiltData.price / conversionRate.kiltEthRatio) : 0)).toFixed(2)}</div>
                      </div>
                      
                      <div className="terminal-block kilt-block">
                        <div className="terminal-header">
                          <span className="terminal-label">KILT</span>
                        </div>
                        <div className="terminal-value">{kiltAmount}</div>
                        <div className="terminal-sublabel">${(parseFloat(kiltAmount) * (kiltData?.price || 0.01715)).toFixed(2)}</div>
                      </div>
                      
                      <div className="terminal-block fees-block">
                        <div className="terminal-header">
                          <span className="terminal-label">FEES</span>
                        </div>
                        <div className="terminal-value">${totalFeesUSD.toFixed(2)}</div>
                        <div className="terminal-sublabel">EARNED</div>
                      </div>
                      
                      <div className="terminal-block apr-block">
                        <div className="terminal-header">
                          <span className="terminal-label">TRADING APR</span>
                        </div>
                        <div className="terminal-value">{(tradingFeesData as any)?.tradingFeesAPR?.toFixed(1) || '3.3'}%</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="cyberpunk-commands">
                      <button
                        onClick={() => {
                          setModalPosition(position);
                          setModalMode('add');
                        }}
                        className="cyberpunk-cmd cyberpunk-cmd-add"
                        disabled={isClosed}
                      >
                        <Plus className="w-3 h-3" />
                        ADD
                      </button>
                      <button
                        onClick={() => {
                          const tokenId = position.tokenId || position.nftTokenId || position.id;
                          const uniswapUrl = `https://app.uniswap.org/pool/${tokenId}`;
                          window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="cyberpunk-cmd cyberpunk-cmd-remove"
                        disabled={isClosed}
                      >
                        <Minus className="w-3 h-3" />
                        REMOVE
                      </button>
                      <button
                        onClick={() => {
                          const tokenId = position.tokenId || position.nftTokenId || position.id;
                          const uniswapUrl = `https://app.uniswap.org/pool/${tokenId}`;
                          window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
                        }}
                        className="cyberpunk-cmd cyberpunk-cmd-collect"
                      >
                        <DollarSign className="w-3 h-3" />
                        CLAIM
                      </button>
                    </div>

                    {/* Manual Step 2 Helper for positions that need token collection */}
                    {/* Show only for positions with zero liquidity + uncollected tokens (Step 1 completed, Step 2 needed) */}
                    {(BigInt(position.liquidity || 0) === 0n && !isClosed && realFees && 
                       (parseFloat(realFees.token0 || '0') > 0 || parseFloat(realFees.token1 || '0') > 0)) && (
                      <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                        <div className="text-xs text-orange-300 mb-2">
                          ⚠️ Step 2 needed: Complete token withdrawal
                        </div>
                        <CompleteRemoveLiquidityButton 
                          tokenId={tokenId}
                        />
                      </div>
                    )}


                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uniswap-Style Position Management Modal */}
      <UniswapStyleLiquidityModal
        isOpen={modalPosition !== null && modalMode !== null}
        onClose={() => {
          setModalPosition(null);
          setModalMode(null);
        }}
        position={modalPosition}
        mode={modalMode}
      />

      {/* Legacy Modal - Remove this section when replaced */}
      {selectedPosition && managementMode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {managementMode === 'increase' && 'Add Liquidity'}
                  {managementMode === 'decrease' && 'Remove Liquidity'}
                  {managementMode === 'collect' && 'Collect Fees'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">Position #{selectedPosition}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPosition(null);
                  setManagementMode(null);
                  setAmount0('');
                  setAmount1('');
                  setLiquidityAmount('');
                }}
                className="text-gray-400 hover:text-white hover:bg-gray-800 p-2"
              >
                ×
              </Button>
            </div>

            {/* Content */}
            <div className="p-6">
              {managementMode === 'increase' && (
                <div className="space-y-4">
                  {/* ETH Input */}
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">Ξ</span>
                        </div>
                        <span className="text-white font-medium">ETH</span>
                      </div>
                      <span className="text-gray-400 text-sm">Balance: 0.0000</span>
                    </div>
                    <Input
                      type="number"
                      value={amount1}
                      onChange={(e) => setAmount1(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent border-0 text-white text-2xl font-medium p-0 h-auto focus:ring-0 focus:outline-0"
                    />
                  </div>

                  {/* KILT Input */}
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">K</span>
                        </div>
                        <span className="text-white font-medium">KILT</span>
                      </div>
                      <span className="text-gray-400 text-sm">Balance: 0.0000</span>
                    </div>
                    <Input
                      type="number"
                      value={amount0}
                      onChange={(e) => setAmount0(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent border-0 text-white text-2xl font-medium p-0 h-auto focus:ring-0 focus:outline-0"
                    />
                  </div>
                </div>
              )}

              {managementMode === 'decrease' && (
                <div className="space-y-4">
                  <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Amount to Remove</span>
                      <span className="text-gray-400 text-sm">Max</span>
                    </div>
                    <Input
                      type="number"
                      value={liquidityAmount}
                      onChange={(e) => setLiquidityAmount(e.target.value)}
                      placeholder="0"
                      className="bg-transparent border-0 text-white text-2xl font-medium p-0 h-auto focus:ring-0 focus:outline-0 mb-3"
                    />
                    <span className="text-gray-400 text-sm">%</span>
                    
                    <div className="flex gap-2 mt-4">
                      {[25, 50, 75, 100].map((percentage) => (
                        <Button
                          key={percentage}
                          variant="outline"
                          size="sm"
                          onClick={() => setLiquidityAmount(percentage.toString())}
                          className={`flex-1 ${
                            liquidityAmount === percentage.toString()
                              ? 'bg-pink-600 border-pink-600 text-white'
                              : 'border-gray-600 text-gray-300 hover:border-gray-500'
                          }`}
                        >
                          {percentage}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {managementMode === 'collect' && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">Available fees to collect:</p>
                  <div className="space-y-2">
                    <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">Ξ</span>
                          </div>
                          <span className="text-white">ETH</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white">0.001</div>
                          <div className="text-gray-400 text-sm">$3.64</div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">K</span>
                          </div>
                          <span className="text-white">KILT</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white">234</div>
                          <div className="text-gray-400 text-sm">$4.22</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mt-6">
                <Button
                  onClick={handleLiquidityManagement}
                  disabled={isProcessing || 
                    (managementMode === 'increase' && (!amount0 || !amount1)) ||
                    (managementMode === 'decrease' && !liquidityAmount)
                  }
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {managementMode === 'increase' && 'Add Liquidity'}
                      {managementMode === 'decrease' && 'Remove Liquidity'}
                      {managementMode === 'collect' && 'Collect Fees'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Rewards Summary */}
      {totalUnclaimed > 0 && (
        <Card className="cluely-card rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#ff0066] to-[#ff0066] rounded-lg flex items-center justify-center">
                  <Gift className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold">Total Rewards Available</div>
                  <div className="text-white/60 text-sm">Ready to claim from all positions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white tabular-nums">
                  {totalUnclaimed.toFixed(1)} KILT
                </div>
                <Button 
                  onClick={() => claimRewardsMutation.mutate()}
                  disabled={claimRewardsMutation.isPending}
                  className="mt-2 bg-gradient-to-r from-[#ff0066] to-[#ff0066] hover:from-[#ff0066] hover:to-[#ff0066]"
                >
                  {claimRewardsMutation.isPending ? 'Claiming...' : 'Claim All'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
