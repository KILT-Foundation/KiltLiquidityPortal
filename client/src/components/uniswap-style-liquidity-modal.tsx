import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
// Note: Switch component not needed for this implementation
import { Slider } from '@/components/ui/slider';
import { 
  X, 
  Settings, 
  ArrowUpDown, 
  Plus,
  Minus,
  DollarSign,
  Info,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShoppingCart
} from 'lucide-react';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useKiltTokenData } from '@/hooks/use-kilt-data';
import { useKiltEthConversionRate } from '@/hooks/use-conversion-rate';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { usePositionFees } from '@/hooks/use-position-fees';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatUnits, parseUnits } from 'viem';
import kiltLogo from '@assets/KILT_400x400_transparent_1751723574123.png';

// Ethereum logo component
const EthereumLogo = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M127.961 0L125.44 8.55656V285.168L127.961 287.688L255.922 212.32L127.961 0Z" fill="#627EEA"/>
    <path d="M127.962 0L0 212.32L127.962 287.688V153.864V0Z" fill="#627EEA"/>
    <path d="M127.961 312.187L126.385 314.154V415.484L127.961 417L255.922 237.832L127.961 312.187Z" fill="#627EEA"/>
    <path d="M127.962 417V312.187L0 237.832L127.962 417Z" fill="#627EEA"/>
    <path d="M127.961 287.688L255.922 212.32L127.961 153.864V287.688Z" fill="#627EEA"/>
    <path d="0 212.32L127.962 287.688V153.864L0 212.32Z" fill="#627EEA"/>
  </svg>
);

interface UniswapStyleLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'remove' | 'collect' | null;
  position?: any;
}

// Add proper typing for position fees
interface PositionFees {
  token0: string;
  token1: string;
  usdValue: number;
}

interface Position {
  fees?: PositionFees;
  [key: string]: any;
}

export function UniswapStyleLiquidityModal({ 
  isOpen, 
  onClose, 
  mode, 
  position 
}: UniswapStyleLiquidityModalProps) {
  const { address, isConnected } = useWagmiWallet();
  const { data: kiltData } = useKiltTokenData();
  const { data: conversionRate } = useKiltEthConversionRate();
  const { ethBalance, wethBalance, kiltBalance, increaseLiquidity, decreaseLiquidity, collectFees } = useUniswapV3();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get real-time fees for the position when in collect mode
  const positionId = position?.tokenId || position?.nftTokenId || position?.id;
  const { data: positionFees } = usePositionFees(mode === 'collect' ? positionId?.toString() : null) as { data: PositionFees | undefined };

  // Form state
  const [ethAmount, setEthAmount] = useState('');
  const [kiltAmount, setKiltAmount] = useState('');
  const [removePercentage, setRemovePercentage] = useState([25]);
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [deadline, setDeadline] = useState('20');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addAsEth, setAddAsEth] = useState(true);

  // Real wallet balances
  const realEthBalance = ethBalance || '0';
  const realKiltBalance = kiltBalance || '0';
  
  // Use accurate KILT/ETH conversion based on current pool price
  // Use real-time conversion rate from DexScreener pool only
  const kiltEthRatio = conversionRate?.kiltEthRatio;

  useEffect(() => {
    if (!isOpen) {
      setEthAmount('');
      setKiltAmount('');
      setRemovePercentage([25]);
      setShowSettings(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleMaxClick = (token: 'eth' | 'kilt') => {
    if (token === 'eth') {
      const formattedEthBalance = parseFloat(realEthBalance).toFixed(6);
      setEthAmount(formattedEthBalance);
      // ETH to KILT: divide ETH amount by KILT/ETH ratio (only if conversion rate available)
      if (kiltEthRatio) {
        const kiltAmount = parseFloat(realEthBalance) / kiltEthRatio;
        setKiltAmount(kiltAmount.toFixed(0));
      }
    } else {
      setKiltAmount(realKiltBalance);
      // KILT to ETH: multiply KILT amount by KILT/ETH ratio (only if conversion rate available)
      if (kiltEthRatio) {
        const ethAmount = parseFloat(realKiltBalance) * kiltEthRatio;
        setEthAmount(ethAmount.toFixed(6));
      }
    }
  };

  const handlePercentageClick = (percentage: number) => {
    setRemovePercentage([percentage]);
  };

  const handleSubmit = async () => {
    if (!address || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to continue",
        variant: "destructive"
      });
      return;
    }

    // Check if MetaMask is available
    if (typeof window !== 'undefined' && !window.ethereum) {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to continue",
        variant: "destructive"
      });
      return;
    }

    if (mode === 'add' && (!ethAmount || !kiltAmount || parseFloat(ethAmount) <= 0 || parseFloat(kiltAmount) <= 0)) {
      toast({
        title: "Invalid Amounts",
        description: "Please enter valid token amounts",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'add') {
        // This is for adding liquidity to an existing position
        const positionId = position?.tokenId || position?.nftTokenId || position?.id;
        if (!positionId) {
          console.error('Position data:', position);
          toast({
            title: "Position Not Found",
            description: "Cannot add liquidity without a position ID",
            variant: "destructive"
          });
          return;
        }

        // Parse amounts to string format (the hook expects strings)
        const ethAmountString = parseUnits(ethAmount, 18).toString();
        const kiltAmountString = parseUnits(kiltAmount, 18).toString();
        
        console.log('Add Liquidity Debug:', {
          positionId: positionId.toString(),
          ethAmount,
          kiltAmount,
          ethAmountString,
          kiltAmountString,
          addAsEth,
          position
        });
        
        // Use the increaseLiquidity function for existing positions
        const increaseLiquidityParams = {
          tokenId: positionId.toString(),
          amount0Desired: ethAmountString, // ETH/WETH amount  
          amount1Desired: kiltAmountString, // KILT amount
          amount0Min: (BigInt(ethAmountString) * 85n / 100n).toString(), // 15% slippage for testing
          amount1Min: (BigInt(kiltAmountString) * 85n / 100n).toString(), // 15% slippage for testing
          useEth: addAsEth, // Pass the toggle state to the hook
        };

        // Call the increaseLiquidity function from the hook
        const txHash = await increaseLiquidity(increaseLiquidityParams);
        
        toast({
          title: "Transaction Submitted",
          description: `Adding ${ethAmount} ETH and ${kiltAmount} KILT to position ${positionId}`,
        });
        
        // Invalidate and refresh position data
        if (address) {
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/wallet', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/eligible', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: [`/api/positions/${positionId}/fees`] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/rewards/user', address] 
          });
        }
        
        // Transaction successful - close modal
        onClose();
        
        return;
      }
      
      if (mode === 'remove') {
        // Remove liquidity functionality
        const positionId = position?.tokenId || position?.nftTokenId || position?.id;
        if (!positionId) {
          toast({
            title: "Position Not Found",
            description: "Cannot remove liquidity without a position ID",
            variant: "destructive"
          });
          return;
        }

        // Calculate liquidity amount to remove based on percentage
        const totalLiquidity = position?.liquidity || '0';
        const liquidityToRemove = (BigInt(totalLiquidity) * BigInt(removePercentage[0]) / 100n).toString();
        
        console.log('Remove Liquidity Debug:', {
          positionId: positionId.toString(),
          totalLiquidity,
          removePercentage: removePercentage[0],
          liquidityToRemove,
          position
        });

        // Calculate minimum amounts (with slippage protection)
        const amount0Min = '0'; // For testing, use 0 - in production should calculate based on slippage
        const amount1Min = '0'; // For testing, use 0 - in production should calculate based on slippage

        const txHash = await decreaseLiquidity({
          tokenId: positionId.toString(),
          liquidity: liquidityToRemove,
          amount0Min,
          amount1Min,
        });

        toast({
          title: "Liquidity Removal Submitted",
          description: `Removing ${removePercentage[0]}% liquidity from position ${positionId}`,
        });

        // Invalidate and refresh position data
        if (address) {
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/wallet', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/eligible', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: [`/api/positions/${positionId}/fees`] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/rewards/user', address] 
          });
        }

        // Close modal after successful transaction
        onClose();
        return;
      }

      if (mode === 'collect') {
        // Collect fees functionality
        const positionId = position?.tokenId || position?.nftTokenId || position?.id;
        if (!positionId) {
          toast({
            title: "Position Not Found", 
            description: "Cannot collect fees without a position ID",
            variant: "destructive"
          });
          return;
        }

        console.log('Collect Fees Debug:', {
          positionId: positionId.toString(),
          position
        });

        const txHash = await collectFees({
          tokenId: positionId.toString(),
        });

        toast({
          title: "Fee Collection Submitted",
          description: `Collecting fees from position ${positionId}`,
        });

        // Invalidate and refresh position data
        if (address) {
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/wallet', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/positions/eligible', address] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: [`/api/positions/${positionId}/fees`] 
          });
          await queryClient.invalidateQueries({ 
            queryKey: ['/api/rewards/user', address] 
          });
        }

        // Close modal after successful transaction
        onClose();
        return;
      }
      
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage = (error as Error)?.message || "Unknown error";
      
      // Handle specific MetaMask errors
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        toast({
          title: "Transaction Cancelled",
          description: "You cancelled the transaction in MetaMask",
          variant: "destructive"
        });
      } else if (errorMessage.includes('insufficient funds')) {
        toast({
          title: "Insufficient Funds",
          description: "You don't have enough tokens or ETH for gas",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Transaction Failed", 
          description: `Error: ${errorMessage}`,
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'add': return 'Add Liquidity';
      case 'remove': return 'Remove Liquidity';
      case 'collect': return 'Collect Fees';
      default: return 'Manage Position';
    }
  };

  const getButtonText = () => {
    if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
    switch (mode) {
      case 'add': return 'Add Liquidity';
      case 'remove': return 'Remove Liquidity';
      case 'collect': return 'Collect Fees';
      default: return 'Confirm';
    }
  };

  if (!mode) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-black/90 backdrop-blur-sm border border-gray-700/60 text-white p-0 gap-0 [&>button]:!top-4 [&>button]:!right-4 [&>button]:!absolute [&>button]:!flex [&>button]:!items-center [&>button]:!justify-center [&>button]:!h-8 [&>button]:!w-8">
        <DialogTitle className="sr-only">{getTitle()}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'add' && 'Add liquidity to the KILT/ETH pool by providing both tokens'}
          {mode === 'remove' && 'Remove liquidity from your KILT/ETH position'}
          {mode === 'collect' && 'Collect accumulated trading fees from your position'}
        </DialogDescription>
        {/* Header */}
        <div className="flex items-center justify-between p-4 pr-16 border-b border-gray-700/60">
          <h2 className="text-lg font-semibold">{getTitle()}</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-white hover:bg-black/40 backdrop-blur-sm p-2 h-8 w-8 flex items-center justify-center"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Pool Info */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-gray-700/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-1">
                  <img src={kiltLogo} alt="KILT" className="w-5 h-5" />
                  <EthereumLogo className="w-5 h-5" />
                </div>
                <span className="font-medium">KILT/ETH</span>
                <Badge variant="secondary" className="bg-gray-700 text-gray-300 text-xs">
                  v3
                </Badge>
                <Badge variant="secondary" className="bg-green-900/30 text-green-400 text-xs">
                  0.3%
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                In range
              </div>
            </div>
          </div>

          {mode === 'add' && (
            <>
              {/* Token Input 1 */}
              <div className="space-y-2">
                <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <EthereumLogo className="w-5 h-5" />
                      <span className="font-medium">ETH</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Balance: {parseFloat(realEthBalance).toFixed(6)} ETH
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={ethAmount}
                      onChange={(e) => {
                        setEthAmount(e.target.value);
                        if (e.target.value && !isNaN(parseFloat(e.target.value)) && kiltEthRatio) {
                          // ETH to KILT: divide ETH amount by KILT/ETH ratio
                          const kiltAmount = parseFloat(e.target.value) / kiltEthRatio;
                          setKiltAmount(kiltAmount.toFixed(0));
                        } else {
                          setKiltAmount('');
                        }
                      }}
                      placeholder="0"
                      className="text-2xl bg-gray-900/50 border border-gray-700/30 rounded-md px-3 py-2 h-auto font-mono focus:ring-1 focus:ring-[#ff0066]/50 focus:border-[#ff0066]/50"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleMaxClick('eth')}
                      className="text-[#ff0066] hover:bg-[#ff0066]/10 text-xs px-2 py-1 h-auto"
                    >
                      MAX
                    </Button>
                  </div>
                </div>

                {/* Switch toggle */}
                <div className="flex justify-center">
                  <div className="bg-black/40 backdrop-blur-sm border border-gray-700/60 rounded-full p-2">
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Token Input 2 */}
                <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/60 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <img src={kiltLogo} alt="KILT" className="w-5 h-5" />
                      <span className="font-medium">KILT</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Balance: {parseFloat(realKiltBalance).toLocaleString()} KILT
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={kiltAmount}
                      onChange={(e) => {
                        setKiltAmount(e.target.value);
                        if (e.target.value && !isNaN(parseFloat(e.target.value)) && kiltEthRatio) {
                          // KILT to ETH: multiply KILT amount by KILT/ETH ratio
                          const ethAmount = parseFloat(e.target.value) * kiltEthRatio;
                          setEthAmount(ethAmount.toFixed(6));
                        } else {
                          setEthAmount('');
                        }
                      }}
                      placeholder="0"
                      className="text-2xl bg-gray-900/50 border border-gray-700/30 rounded-md px-3 py-2 h-auto font-mono focus:ring-1 focus:ring-[#ff0066]/50 focus:border-[#ff0066]/50"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleMaxClick('kilt')}
                      className="text-[#ff0066] hover:bg-[#ff0066]/10 text-xs px-2 py-1 h-auto"
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>

              {/* Add as ETH Toggle */}
              <div className="flex items-center justify-between bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-gray-700/60">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Add as ETH</span>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
                <Button
                  variant={addAsEth ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAddAsEth(!addAsEth)}
                  className="h-8 px-3"
                >
                  {addAsEth ? "ETH" : "WETH"}
                </Button>
              </div>

              {/* Position Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">ETH position</span>
                  <div className="flex items-center gap-1">
                    <EthereumLogo className="w-4 h-4" />
                    <span>{ethAmount || '0'} ETH</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">KILT position</span>
                  <div className="flex items-center gap-1">
                    <img src={kiltLogo} alt="KILT" className="w-4 h-4" />
                    <span>{parseFloat(kiltAmount || '0').toLocaleString()} KILT</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'remove' && (
            <>
              {/* Amount to Remove */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-2">
                    {removePercentage[0]}%
                  </div>
                  <div className="text-sm text-gray-400">Amount to remove</div>
                </div>

                {/* Percentage Slider */}
                <div className="px-2">
                  <Slider
                    value={removePercentage}
                    onValueChange={setRemovePercentage}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Quick Percentage Buttons */}
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((percentage) => (
                    <Button
                      key={percentage}
                      variant={removePercentage[0] === percentage ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePercentageClick(percentage)}
                      className="flex-1 text-xs"
                    >
                      {percentage}%
                    </Button>
                  ))}
                </div>

                {/* Expected Output */}
                <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/60 p-3 space-y-2">
                  <div className="text-sm text-gray-400">You will receive</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <EthereumLogo className="w-4 h-4" />
                      <span>ETH</span>
                    </div>
                    <span className="font-mono">
                      {position?.token0Amount ? ((parseFloat(position.token0Amount) / 1e18) * removePercentage[0] / 100).toFixed(6) : '0.000000'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src={kiltLogo} alt="KILT" className="w-4 h-4" />
                      <span>KILT</span>
                    </div>
                    <span className="font-mono">
                      {position?.token1Amount ? ((parseFloat(position.token1Amount) / 1e18) * removePercentage[0] / 100).toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'collect' && (
            <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/60 p-4 space-y-3">
              <div className="text-sm text-gray-400">Available to collect</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <EthereumLogo className="w-4 h-4" />
                    <span>ETH</span>
                  </div>
                  <span className="font-mono">
                    {positionFees?.token0 ? (parseFloat(positionFees.token0) / 1e18).toFixed(6) : 
                     (position?.fees as PositionFees)?.token0 ? (parseFloat((position.fees as PositionFees).token0) / 1e18).toFixed(6) : '0.000000'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={kiltLogo} alt="KILT" className="w-4 h-4" />
                    <span>KILT</span>
                  </div>
                  <span className="font-mono">
                    {positionFees?.token1 ? (parseFloat(positionFees.token1) / 1e18).toLocaleString() : 
                     (position?.fees as PositionFees)?.token1 ? (parseFloat((position.fees as PositionFees).token1) / 1e18).toLocaleString() : '0'}
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Total value: ~${positionFees?.usdValue ? positionFees.usdValue.toFixed(2) : 
                              (position?.fees as PositionFees)?.usdValue ? (position.fees as PositionFees).usdValue.toFixed(2) : '0.00'}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-gray-700/60 p-4 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Transaction Settings
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Slippage Tolerance</span>
                  <div className="flex items-center gap-1">
                    <Input 
                      value={slippageTolerance}
                      onChange={(e) => setSlippageTolerance(e.target.value)}
                      className="w-16 h-8 text-center bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm">%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Transaction Deadline</span>
                  <div className="flex items-center gap-1">
                    <Input 
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-16 h-8 text-center bg-gray-700 border-gray-600"
                    />
                    <span className="text-sm">min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          {mode !== 'collect' ? (
            <div className="space-y-2">
              {(!ethAmount || !kiltAmount) && mode === 'add' && (
                <div className="bg-black/20 backdrop-blur-sm border border-gray-700/60 rounded-lg p-4 text-center">
                  <span className="text-gray-400">Enter an amount</span>
                </div>
              )}
              
              {(ethAmount && kiltAmount) || mode !== 'add' ? (
                <Button 
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="w-full bg-[#ff0066] hover:bg-[#cc0052] text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {getButtonText()}
                </Button>
              ) : null}
            </div>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full bg-[#ff0066] hover:bg-[#cc0052] text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {getButtonText()}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}