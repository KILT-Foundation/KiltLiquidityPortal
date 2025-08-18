import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, ArrowUpDown, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';

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
  fees?: {
    token0: string;
    token1: string;
  };
  isActive: boolean;
  isInRange: boolean;
}

interface UniswapModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
  mode: 'add' | 'remove' | 'collect' | null;
}

export function UniswapModal({ isOpen, onClose, position, mode }: UniswapModalProps) {
  const { toast } = useToast();
  const uniswapV3 = useUniswapV3();
  
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [removePercentage, setRemovePercentage] = useState(25);
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

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
      toast({
        title: "Transaction Failed",
        description: "Failed to add liquidity. Please try again.",
        variant: "destructive"
      });
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
      
      await uniswapV3.decreaseLiquidity({
        tokenId: position.tokenId,
        liquidity: liquidityToRemove.toString()
      });
      
      toast({
        title: "Liquidity Removed Successfully!",
        description: `Removed ${removePercentage}% from position #${position.tokenId}`
      });
      onClose();
    } catch (error) {
      console.warn('Remove liquidity failed (gracefully handled):', error);
      toast({
        title: "Transaction Failed",
        description: "Failed to remove liquidity. Please try again.",
        variant: "destructive"
      });
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
      console.error('Collect fees failed:', error);
      toast({
        title: "Transaction Failed",
        description: "Failed to collect fees. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAddLiquidityModal = () => (
    <div className="bg-[#0D111C] rounded-2xl w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4">
        <h2 className="text-xl font-semibold text-white">Add Liquidity</h2>
        <div className="flex items-center gap-3">
          <div className="bg-gray-800 rounded-lg px-3 py-1.5 text-gray-400 text-sm font-mono">
            #{position.tokenId}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Pool Info */}
      <div className="px-6 pb-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Pool</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <span className="text-white font-medium">KILT/ETH</span>
              <span className="text-red-400 text-sm">0.3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Tokens Section */}
      <div className="px-6 pb-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Add Tokens</h3>
          
          {/* KILT Input */}
          <div className="mb-4">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">K</span>
                  </div>
                  <span className="text-white font-medium">KILT</span>
                </div>
                <span className="text-red-400 text-sm">0.3%</span>
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

          {/* Swap Arrow */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-800 border border-gray-600 rounded-full p-2">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* ETH Input */}
          <div className="mb-4">
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">Ξ</span>
                  </div>
                  <span className="text-white font-medium">ETH</span>
                </div>
                <span className="text-red-400 text-sm">0.3%</span>
              </div>
              <Input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0.0"
                className="bg-transparent border-0 text-white text-2xl font-medium p-0 h-auto focus:ring-0 focus:outline-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Settings */}
      <div className="px-6 pb-6">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-gray-400" />
            <h3 className="text-white font-medium">Transaction Settings</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Slippage Tolerance</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(parseFloat(e.target.value))}
                  className="w-16 bg-gray-800 border-gray-600 text-white text-center"
                  step="0.1"
                  min="0"
                  max="50"
                />
                <span className="text-gray-400">%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Transaction Deadline</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={deadline}
                  onChange={(e) => setDeadline(parseInt(e.target.value))}
                  className="w-16 bg-gray-800 border-gray-600 text-white text-center"
                  min="1"
                />
                <span className="text-gray-400">min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-6 pb-6">
        <Button
          onClick={handleAddLiquidity}
          disabled={isLoading || !amount0 || !amount1}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-4 text-lg rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Adding Liquidity...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 mr-2" />
              Add Liquidity
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderRemoveLiquidityModal = () => (
    <div className="bg-[#0D111C] rounded-2xl w-full max-w-lg mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Remove Liquidity</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-medium">Amount to Remove</span>
          <span className="text-gray-400 text-sm">Max</span>
        </div>
        
        <div className="text-center mb-4">
          <span className="text-4xl font-bold text-white">{removePercentage}%</span>
        </div>
        
        <div className="flex gap-2 mb-4">
          {[25, 50, 75, 100].map((percentage) => (
            <Button
              key={percentage}
              variant="outline"
              size="sm"
              onClick={() => setRemovePercentage(percentage)}
              className={`flex-1 ${
                removePercentage === percentage
                  ? 'bg-pink-600 border-pink-600 text-white'
                  : 'border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              {percentage}%
            </Button>
          ))}
        </div>
      </div>

      <Button
        onClick={handleRemoveLiquidity}
        disabled={isLoading}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-xl"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 w-4 mr-2 animate-spin" />
            Removing...
          </>
        ) : (
          'Remove Liquidity'
        )}
      </Button>
    </div>
  );

  const renderCollectFeesModal = () => (
    <div className="bg-[#0D111C] rounded-2xl w-full max-w-lg mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Collect Fees</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
        <p className="text-gray-400 text-sm mb-4">Available fees to collect:</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">Ξ</span>
              </div>
              <span className="text-white">ETH</span>
            </div>
            <div className="text-right">
              <div className="text-white">{position.fees?.token0 || '0.001'}</div>
              <div className="text-gray-400 text-sm">$3.64</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <span className="text-white">KILT</span>
            </div>
            <div className="text-right">
              <div className="text-white">{position.fees?.token1 || '234'}</div>
              <div className="text-gray-400 text-sm">$4.22</div>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleCollectFees}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 w-4 mr-2 animate-spin" />
            Collecting...
          </>
        ) : (
          'Collect Fees'
        )}
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-transparent border-0 p-0">
        {mode === 'add' && renderAddLiquidityModal()}
        {mode === 'remove' && renderRemoveLiquidityModal()}
        {mode === 'collect' && renderCollectFeesModal()}
      </DialogContent>
    </Dialog>
  );
}