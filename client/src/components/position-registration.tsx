import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Gift,
  Network
} from 'lucide-react';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';


interface ExternalPosition {
  tokenId: string; // Changed from nftTokenId to tokenId for consistency
  nftTokenId: string;
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  amount0: string;
  amount1: string;
  minPrice: string;
  maxPrice: string;
  liquidity: string;
  currentValueUSD: number;
  feeTier: number;
  createdAt: string;
  isKiltPosition: boolean;
  positionStatus?: string;
  // Historical validation data
  creationBlockNumber?: number;
  creationTransactionHash?: string;
}

interface RegistrationResult {
  success: boolean;
  message: string;
  positionId?: number;
  eligibilityStatus: string;
  validationResult?: {
    isValid: boolean;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
    details: {
      isFullRange: boolean;
      priceAtCreation: number;
      balanceRatio: number;
      expectedRatio: number;
      tolerance: number;
    };
  };
  rewardInfo?: {
    dailyRewards: number;
    estimatedAPR: number;
    lockPeriodDays: number;
  };
}

export function PositionRegistration() {
  const { address, isConnected } = useWagmiWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [registeringPositions, setRegisteringPositions] = useState<Set<string>>(new Set());

  // Get user for registration
  const { data: user } = useQuery({
    queryKey: ['user', address],
    queryFn: async () => {
      if (!address) return null;
      const response = await fetch(`/api/users/${address}`);
      if (!response.ok) {
        // Create user if doesn't exist
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address })
        });
        return createResponse.json();
      }
      return response.json();
    },
    enabled: !!address
  });

  // BLAZING FAST eligible positions using Uniswap-optimized endpoint
  const { data: unregisteredPositionsData, isLoading: loadingPositions } = useQuery({
    queryKey: ['eligible-positions-uniswap', address],
    staleTime: 0, // Force fresh data to see position count fix
    gcTime: 30 * 1000, // Shorter retention
    refetchInterval: false, // No polling needed with smart caching
    refetchOnWindowFocus: true, // Refetch when window gets focus
    queryFn: async () => {
      if (!address) return { eligiblePositions: [], totalPositions: 0, message: '' };
      
      try {
        const response = await fetch(`/api/positions/eligible/${address}`);
        if (!response.ok) {
          throw new Error('Failed to fetch eligible positions');
        }
        
        const result = await response.json();
        const timing = response.headers.get('X-Response-Time') || 'unknown';
        const cacheStatus = response.headers.get('X-Cache-Status') || 'unknown';
        
        return {
          eligiblePositions: result.eligiblePositions || [],
          totalPositions: result.totalPositions || 0,
          registeredCount: result.registeredCount || 0,
          message: result.message || '',
          timing,
          cacheStatus
        };
      } catch (error) {
        console.error('⚠️ Uniswap-optimized endpoint failed:', error);
        return { eligiblePositions: [], totalPositions: 0, message: '' };
      }
    },
    enabled: !!address
  });

  const unregisteredPositions = unregisteredPositionsData?.eligiblePositions || [];
  const totalPositions = unregisteredPositionsData?.totalPositions || 0;
  const registeredCount = unregisteredPositionsData?.registeredCount || 0;

  // Register position mutation
  const registerMutation = useMutation({
    mutationFn: async (position: ExternalPosition) => {
      if (!user?.id || !address) throw new Error('User not found');
      
      // Set loading state for this specific position
      setRegisteringPositions(prev => new Set(prev).add(position.tokenId));
      
      try {
        const response = await fetch('/api/positions/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userAddress: address,
            nftTokenId: position.tokenId,
            poolAddress: position.poolAddress,
            token0Address: position.token0Address,
            token1Address: position.token1Address,
            amount0: position.amount0 || '0',
            amount1: position.amount1 || '0',
            minPrice: position.minPrice,
            maxPrice: position.maxPrice,
            liquidity: position.liquidity,
            currentValueUSD: position.currentValueUSD,
            feeTier: position.feeTier,
            originalCreationDate: position.createdAt,
            // Historical validation data
            creationBlockNumber: position.creationBlockNumber,
            creationTransactionHash: position.creationTransactionHash
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Registration failed');
        }

        return response.json() as Promise<RegistrationResult>;
      } finally {
        // Clear loading state for this position
        setRegisteringPositions(prev => {
          const newSet = new Set(prev);
          newSet.delete(position.tokenId);
          return newSet;
        });
      }
    },
    onSuccess: (result) => {
      toast({
        title: "Position Registered!",
        description: "Position successfully added to reward program",
      });
      // Invalidate the correct query keys to refresh eligible positions
      queryClient.invalidateQueries({ queryKey: ['eligible-positions-uniswap', address] });
      queryClient.invalidateQueries({ queryKey: ['user-positions'] });
      queryClient.invalidateQueries({ queryKey: ['unregistered-positions'] });
      // Force immediate refetch with a small delay to ensure backend updates
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['eligible-positions-uniswap', address] });
      }, 100);
    },
    onError: (error) => {
      // Handle already registered positions differently
      if (error.message.includes('already registered')) {
        toast({
          title: "Position Already Registered",
          description: "This position is already earning rewards in the program",
          variant: "default"
        });
      } else {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  });

  // Bulk register mutation
  const bulkRegisterMutation = useMutation({
    mutationFn: async (positions: ExternalPosition[]) => {
      if (!user?.id || !address) throw new Error('User not found');
      
      const response = await fetch('/api/positions/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userAddress: address,
          positions: positions.map(pos => ({
            nftTokenId: pos.tokenId, // Use tokenId consistently
            poolAddress: pos.poolAddress,
            token0Address: pos.token0Address,
            token1Address: pos.token1Address,
            amount0: pos.amount0 || '0',
            amount1: pos.amount1 || '0',
            minPrice: pos.minPrice,
            maxPrice: pos.maxPrice,
            liquidity: pos.liquidity,
            currentValueUSD: pos.currentValueUSD,
            feeTier: pos.feeTier,
            createdAt: pos.createdAt
          }))
        })
      });

      return response.json();
    },
    onSuccess: (result) => {
      let message = '';
      let variant: 'default' | 'destructive' = 'default';
      
      if (result.successCount > 0 && result.failureCount === 0) {
        // All successful
        message = `Successfully registered ${result.successCount} position${result.successCount === 1 ? '' : 's'}`;
      } else if (result.successCount > 0 && result.failureCount > 0) {
        // Partial success
        message = `Registered ${result.successCount} of ${result.successCount + result.failureCount} positions`;
        variant = 'default';
      } else if (result.alreadyRegisteredCount > 0 && result.failureCount === 0) {
        // All already registered
        message = `All positions already registered and earning rewards`;
      } else if (result.failureCount > 0 && result.successCount === 0) {
        // All failed
        message = `Registration failed. Please try again.`;
        variant = 'destructive';
      } else {
        // Fallback
        message = `Registration complete`;
      }

      toast({
        title: "Bulk Registration Complete", 
        description: message,
        variant
      });
      // Invalidate the correct query keys to refresh eligible positions
      queryClient.invalidateQueries({ queryKey: ['eligible-positions-uniswap', address] });
      queryClient.invalidateQueries({ queryKey: ['user-positions'] });
      queryClient.invalidateQueries({ queryKey: ['unregistered-positions'] });
      // Force immediate refetch with a small delay to ensure backend updates
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['eligible-positions-uniswap', address] });
      }, 100);
      setSelectedPositions([]);
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: `Error during bulk registration: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleToggleSelection = (tokenId: string) => {
    setSelectedPositions(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const handleRegisterPosition = (tokenId: string) => {
    const position = unregisteredPositions.find((p: ExternalPosition) => p.tokenId === tokenId);
    if (position) {
      registerMutation.mutate(position);
    }
  };

  const handleBulkRegister = () => {
    const positionsToRegister = unregisteredPositions.filter((pos: any) => 
      selectedPositions.includes(pos.tokenId)
    );
    bulkRegisterMutation.mutate(positionsToRegister);
  };

  if (!isConnected) {
    return (
      <Card className="cluely-card">
        <CardContent className="p-3">
          <div className="text-center text-white/60 text-xs">
            Connect your wallet to register existing positions
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2 h-full flex flex-col">
      {/* Compact Header */}
      <Card className="cluely-card">
        <CardContent className="p-3">
          <Alert className="border-[#ff0066]/30 bg-black/40 backdrop-blur-sm">
            <Gift className="h-3 w-3 text-[#ff0066]" />
            <AlertDescription className="text-white text-xs leading-relaxed">
              <div className="font-semibold mb-2 text-white">
                Already have KILT liquidity positions on Uniswap? Register them here to start earning treasury rewards!
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start gap-2 pl-1">
                  <span className="text-[#ff0066] font-bold text-sm leading-none mt-0.5">•</span>
                  <span className="text-white font-medium">Immediate reward accrual upon registration</span>
                </div>
                <div className="flex items-start gap-2 pl-1">
                  <span className="text-[#ff0066] font-bold text-sm leading-none mt-0.5">•</span>
                  <span className="text-white font-medium">Smart contract security with historical validation</span>
                </div>
                <div className="flex items-start gap-2 pl-1">
                  <span className="text-[#ff0066] font-bold text-sm leading-none mt-0.5">•</span>
                  <span className="text-white font-medium">Auto-validation for full range positions</span>
                </div>
                <div className="flex items-start gap-2 pl-1">
                  <span className="text-[#ff0066] font-bold text-sm leading-none mt-0.5">•</span>
                  <span className="text-white font-medium">Complete transaction history verification</span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      {/* Unregistered Positions */}
      <Card className="cluely-card flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white font-heading text-sm">
              Eligible Positions
            </CardTitle>
            <div className="flex items-center gap-2">
              {unregisteredPositions.length > 1 && (
                <Button 
                  onClick={() => {
                    if (selectedPositions.length === unregisteredPositions.length) {
                      setSelectedPositions([]);
                    } else {
                      setSelectedPositions(unregisteredPositions.map((p: ExternalPosition) => p.tokenId));
                    }
                  }}
                  variant="outline"
                  className="border-[#ff0066]/30 hover:bg-[#ff0066]/10 text-xs py-1 px-2 h-6"
                >
                  {selectedPositions.length === unregisteredPositions.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              {selectedPositions.length > 0 && (
                <Button 
                  onClick={handleBulkRegister}
                  disabled={bulkRegisterMutation.isPending}
                  className="bg-[#ff0066] hover:bg-[#e6005c] text-xs py-1 px-2 h-6"
                >
                  {bulkRegisterMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Register ({selectedPositions.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingPositions ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#ff0066]" />
              <span className="ml-2 text-white/60 text-xs">Scanning for positions...</span>
            </div>
          ) : unregisteredPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              {totalPositions === 0 ? (
                <>
                  <Plus className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <h3 className="text-white font-semibold mb-2 text-xs">No KILT Positions Found</h3>
                  <p className="text-white/60 mb-3 text-xs">
                    You don't have any KILT liquidity positions yet. Create your first position to start earning treasury rewards!
                  </p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button 
                      onClick={() => {
                        // Navigate to liquidity tab using querySelector
                        const liquidityTabButton = document.querySelector('[data-value="liquidity"]') as HTMLElement;
                        liquidityTabButton?.click();
                      }}
                      className="bg-[#ff0066] hover:bg-[#e6005c] text-xs py-1 px-2 h-6"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Liquidity
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('https://app.uniswap.org/', '_blank')}
                      className="border-white/20 hover:bg-white/5 text-xs py-1 px-2 h-6"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Visit Uniswap
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowBypassModal(true)}
                      className="border-amber-500/30 hover:bg-amber-500/10 text-amber-400 text-xs py-1 px-2 h-6"
                    >
                      <Network className="h-3 w-3 mr-1" />
                      Manual Register
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="h-6 w-6 text-[#ff0066] mx-auto mb-3" />
                  <h3 className="text-white font-semibold mb-3 text-lg">All Set!</h3>
                  <p className="text-white/60 text-sm max-w-xs mb-3">
                    All your KILT position{totalPositions !== 1 ? 's are' : ' is'} already registered and earning rewards.
                  </p>
                  {registeredCount > 0 && (
                    <div className="text-xs text-[#ff0066] font-medium">
                      {registeredCount} position{registeredCount !== 1 ? 's' : ''} enrolled in reward program
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {unregisteredPositions
                .filter((position: any) => position.positionStatus === 'ACTIVE_IN_RANGE' || position.positionStatus === 'IN_RANGE') // Only show in-range positions
                .map((position: any) => (
                <div 
                  key={position.tokenId}
                  className="bg-gradient-to-r from-black/90 via-[#ff0066]/10 to-black/90 backdrop-blur-sm rounded border border-[#ff0066]/30 shadow-lg hover:shadow-[#ff0066]/20 transition-all duration-300 hover:border-[#ff0066]/50 p-3"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: NFT ID with cyberpunk styling */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPositions.includes(position.tokenId)}
                        onChange={() => handleToggleSelection(position.tokenId)}
                        className="w-3 h-3 text-[#ff0066] bg-black border-[#ff0066] rounded focus:ring-[#ff0066] focus:ring-1"
                      />
                      <div className="font-mono text-[#ff0066] text-sm font-bold">
                        #{position.tokenId || 'N/A'}
                      </div>
                    </div>
                    
                    {/* Center: Position Value */}
                    <div className="text-center">
                      <div className="text-white font-bold text-lg font-mono">
                        ${position.currentValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Right: Register Button */}
                    <Button
                      onClick={() => handleRegisterPosition(position.tokenId)}
                      disabled={registeringPositions.has(position.tokenId)}
                      className="bg-gradient-to-r from-[#ff0066] to-[#ff0066] hover:from-[#ff0066] hover:to-[#ff0066] text-white border-0 shadow-lg hover:shadow-[#ff0066]/20 transition-all duration-200 h-7 px-3 text-xs font-medium"
                    >
                      {registeringPositions.has(position.tokenId) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}