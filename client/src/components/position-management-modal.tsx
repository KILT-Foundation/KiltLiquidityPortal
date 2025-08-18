import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { Loader2, Plus, Minus, DollarSign, ArrowUpDown, Settings, Zap } from 'lucide-react';
import kiltLogoPath from '@assets/KILT_400x400_transparent_1751723574123.png';

interface Position {
  tokenId: string;
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  currentValueUSD: number;
  fees: {
    token0: string;
    token1: string;
  };
  isActive: boolean;
  isInRange: boolean;
}

interface PositionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
  mode: 'add' | 'remove' | 'collect' | null;
}

export function PositionManagementModal({ 
  isOpen, 
  onClose, 
  position, 
  mode 
}: PositionManagementModalProps) {
  const { toast } = useToast();
  const uniswapV3 = useUniswapV3();
  
  const [isLoading, setIsLoading] = useState(false);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [removePercentage, setRemovePercentage] = useState(25);
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen && position) {
      setAmount0('');
      setAmount1('');
      setRemovePercentage(25);
      setSlippage(0.5);
      setDeadline(20);
    }
  }, [isOpen, position, mode]);

  if (!position || !mode) return null;

  const handleAddLiquidity = async () => {
    if (!amount0 || !amount1) {
      toast({
        title: "Invalid Amounts",
        description: "Please enter valid token amounts",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await uniswapV3.increaseLiquidity({
        tokenId: position.tokenId,
        amount0Desired: amount0,
        amount1Desired: amount1
      });
      
      toast({
        title: "Liquidity Added Successfully!",
        description: `Added liquidity to position #${position.tokenId}`
      });
      onClose();
    } catch (error) {
      console.warn('Add liquidity failed (gracefully handled):', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (removePercentage <= 0 || removePercentage > 100) {
      toast({
        title: "Invalid Percentage",
        description: "Please enter a valid removal percentage",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const liquidityToRemove = (BigInt(position.liquidity) * BigInt(removePercentage)) / BigInt(100);
      
      // Two-step process: Remove liquidity then collect tokens
      console.log('Remove Liquidity Debug:', {
        positionId: position.tokenId,
        totalLiquidity: position.liquidity,
        removePercentage,
        liquidityToRemove: liquidityToRemove.toString(),
        position
      });

      // Use the integrated function that handles both steps automatically
      console.log('🔄 Starting removeLiquidityAndCollect (atomic transaction)...');
      await uniswapV3.removeLiquidityAndCollect({
        tokenId: position.tokenId,
        liquidity: liquidityToRemove.toString(),
        removePercentage
      });
      console.log('✅ Liquidity removed and tokens collected in single transaction');
      
      toast({
        title: "Liquidity Removed Successfully!",
        description: `Removed ${removePercentage}% liquidity from position #${position.tokenId} and collected WETH + KILT tokens to your wallet`
      });
      onClose();
    } catch (error: any) {
      console.error('Remove liquidity failed:', error);
      
      // If atomic transaction fails due to circuit breaker, fall back to two-step process
      if (error?.message?.includes('breaker is open') || 
          error?.message?.includes('circuit breaker') ||
          error?.message?.includes('multicall')) {
        
        console.log('🔄 Multicall failed, attempting two-step process...');
        
        try {
          const liquidityToRemove = (BigInt(position.liquidity) * BigInt(removePercentage)) / BigInt(100);
          
          // Step 1: Remove liquidity from position
          console.log('🔄 Step 1: Starting decreaseLiquidity transaction...');
          await uniswapV3.decreaseLiquidity({
            tokenId: position.tokenId,
            liquidity: liquidityToRemove.toString()
          });
          console.log('✅ Step 1 completed: Liquidity decreased successfully');
          
          // Wait a moment before Step 2
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Step 2: Collect the underlying tokens to wallet
          console.log('🔄 Step 2: Starting collectLiquidity transaction...');
          await uniswapV3.collectLiquidity({
            tokenId: position.tokenId
          });
          console.log('✅ Step 2 completed: Tokens collected successfully');
          
          toast({
            title: "Liquidity Removed Successfully!",
            description: `Removed ${removePercentage}% liquidity from position #${position.tokenId} and collected WETH + KILT tokens to your wallet (completed in 2 steps due to network protection)`
          });
          onClose();
        } catch (twoStepError) {
          console.error('Two-step process also failed:', twoStepError);
          toast({
            title: "Remove Liquidity Failed",
            description: (twoStepError as Error)?.message || 'Failed to remove liquidity from position',
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Remove Liquidity Failed",
          description: error?.message || 'Failed to remove liquidity from position',
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollectFees = async () => {
    setIsLoading(true);
    try {
      await uniswapV3.collectFees({
        tokenId: position.tokenId
      });
      
      toast({
        title: "Fees Collected Successfully!",
        description: `Collected fees from position #${position.tokenId}`
      });
      onClose();
    } catch (error) {
      console.warn('Collect fees failed (gracefully handled):', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAddLiquidityContent = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300">Add Tokens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <img src={kiltLogoPath} alt="KILT" className="w-8 h-8" />
                  <span className="font-medium">KILT</span>
                </div>
                <Input
                  placeholder="0.0"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  className="w-32 text-right bg-transparent border-none text-lg font-medium"
                  type="number"
                  step="any"
                />
              </div>
              
              <div className="flex justify-center">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    ETH
                  </div>
                  <span className="font-medium">ETH</span>
                </div>
                <Input
                  placeholder="0.0"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  className="w-32 text-right bg-transparent border-none text-lg font-medium"
                  type="number"
                  step="any"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Transaction Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Slippage Tolerance</span>
              <div className="flex items-center gap-2">
                <Input
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  className="w-16 text-right"
                  type="number"
                  step="0.1"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Transaction Deadline</span>
              <div className="flex items-center gap-2">
                <Input
                  value={deadline}
                  onChange={(e) => setDeadline(parseInt(e.target.value))}
                  className="w-16 text-right"
                  type="number"
                />
                <span className="text-sm text-gray-400">min</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button 
        onClick={handleAddLiquidity}
        disabled={isLoading || !amount0 || !amount1}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Add Liquidity
      </Button>
    </div>
  );

  const renderRemoveLiquidityContent = () => (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">Remove Liquidity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{removePercentage}%</span>
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <Button
                    key={percent}
                    onClick={() => setRemovePercentage(percent)}
                    variant={removePercentage === percent ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
            </div>
            
            <input
              type="range"
              min="1"
              max="100"
              value={removePercentage}
              onChange={(e) => setRemovePercentage(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <img src={kiltLogoPath} alt="KILT" className="w-4 h-4" />
                  <span>KILT</span>
                </div>
                <span className="font-medium">
                  {(parseFloat(position.amount0) * removePercentage / 100).toFixed(4)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    E
                  </div>
                  <span>ETH</span>
                </div>
                <span className="font-medium">
                  {(parseFloat(position.amount1) * removePercentage / 100).toFixed(6)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Transaction Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Slippage Tolerance</span>
            <div className="flex items-center gap-2">
              <Input
                value={slippage}
                onChange={(e) => setSlippage(parseFloat(e.target.value))}
                className="w-16 text-right"
                type="number"
                step="0.1"
              />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleRemoveLiquidity}
        disabled={isLoading || removePercentage <= 0}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Minus className="w-4 h-4 mr-2" />
        )}
        Remove Liquidity
      </Button>
    </div>
  );

  const renderCollectFeesContent = () => (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">Unclaimed Fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3">
                <img src={kiltLogoPath} alt="KILT" className="w-6 h-6" />
                <span className="font-medium">KILT</span>
              </div>
              <span className="font-mono text-lg">
                {parseFloat(position.fees.token0).toFixed(4)}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                  ETH
                </div>
                <span className="font-medium">ETH</span>
              </div>
              <span className="font-mono text-lg">
                {parseFloat(position.fees.token1).toFixed(6)}
              </span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Estimated Value</span>
              <span className="font-medium">
                ${((parseFloat(position.fees.token0) * 0.018) + (parseFloat(position.fees.token1) * 2400)).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-400">Gas Optimization</p>
            <p className="text-xs text-gray-300">
              Collecting fees will also collect any tokens owed from previous liquidity removal.
            </p>
          </div>
        </div>
      </div>

      <Button 
        onClick={handleCollectFees}
        disabled={isLoading}
        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <DollarSign className="w-4 h-4 mr-2" />
        )}
        Collect Fees
      </Button>
    </div>
  );

  const getModalTitle = () => {
    switch (mode) {
      case 'add': return 'Add Liquidity';
      case 'remove': return 'Remove Liquidity';
      case 'collect': return 'Collect Fees';
      default: return 'Manage Position';
    }
  };

  const getModalContent = () => {
    switch (mode) {
      case 'add': return renderAddLiquidityContent();
      case 'remove': return renderRemoveLiquidityContent();
      case 'collect': return renderCollectFeesContent();
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-950 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{getModalTitle()}</span>
            <Badge variant="secondary" className="bg-gray-800 text-gray-300">
              #{position.tokenId}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-900/30 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Pool</span>
              <div className="flex items-center gap-2">
                <img src={kiltLogoPath} alt="KILT" className="w-4 h-4" />
                <span>KILT/ETH</span>
                <Badge variant="outline" className="text-xs">
                  {(position.fee / 10000).toFixed(2)}%
                </Badge>
              </div>
            </div>
          </div>
          
          {getModalContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}