import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Settings, Info, ChevronDown, ArrowDown, Plus } from 'lucide-react';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useToast } from '@/hooks/use-toast';
import kiltLogo from "@assets/KILT_400x400_transparent_1751723574123.png";

interface UniswapStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UniswapStyleModal({ isOpen, onClose }: UniswapStyleModalProps) {
  const { address, isConnected } = useWagmiWallet();
  const { toast } = useToast();
  
  // Form state
  const [ethAmount, setEthAmount] = useState('');
  const [kiltAmount, setKiltAmount] = useState('');
  const [selectedFeeRate, setSelectedFeeRate] = useState('0.3%');
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [deadline, setDeadline] = useState('20');
  const [showSettings, setShowSettings] = useState(false);
  
  // Price and pool state
  const [currentPrice, setCurrentPrice] = useState('0.01859'); // KILT price in ETH
  const [poolExists, setPoolExists] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Wallet balances (mock for now - would be real in production)
  const [ethBalance, setEthBalance] = useState('1.5');
  const [kiltBalance, setKiltBalance] = useState('75000');
  
  // Fee tier options
  const feeRates = [
    { rate: '0.01%', description: 'Best for very stable pairs' },
    { rate: '0.05%', description: 'Best for stable pairs' },
    { rate: '0.3%', description: 'Best for most pairs', recommended: true },
    { rate: '1%', description: 'Best for exotic pairs' },
  ];
  
  // Calculate the other amount when one is entered
  useEffect(() => {
    if (ethAmount && !kiltAmount) {
      const calculatedKilt = (parseFloat(ethAmount) / parseFloat(currentPrice)).toFixed(0);
      setKiltAmount(calculatedKilt);
    } else if (kiltAmount && !ethAmount) {
      const calculatedEth = (parseFloat(kiltAmount) * parseFloat(currentPrice)).toFixed(4);
      setEthAmount(calculatedEth);
    }
  }, [ethAmount, kiltAmount, currentPrice]);
  
  const handleEthChange = (value: string) => {
    setEthAmount(value);
    if (value && parseFloat(value) > 0) {
      const calculatedKilt = (parseFloat(value) / parseFloat(currentPrice)).toFixed(0);
      setKiltAmount(calculatedKilt);
    } else {
      setKiltAmount('');
    }
  };
  
  const handleKiltChange = (value: string) => {
    setKiltAmount(value);
    if (value && parseFloat(value) > 0) {
      const calculatedEth = (parseFloat(value) * parseFloat(currentPrice)).toFixed(4);
      setEthAmount(calculatedEth);
    } else {
      setEthAmount('');
    }
  };
  
  const handleMaxEth = () => {
    const maxAmount = (parseFloat(ethBalance) * 0.9).toFixed(4); // Leave some for gas
    handleEthChange(maxAmount);
  };
  
  const handleMaxKilt = () => {
    const maxAmount = (parseFloat(kiltBalance) * 1.0).toFixed(0);
    handleKiltChange(maxAmount);
  };
  
  const handleAddLiquidity = async () => {
    if (!isConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to add liquidity",
        variant: "destructive"
      });
      return;
    }
    
    if (!ethAmount || !kiltAmount) {
      toast({
        title: "Enter amounts",
        description: "Please enter amounts for both tokens",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Liquidity Added!",
        description: `Added ${ethAmount} ETH and ${kiltAmount} KILT to the pool`,
      });
      
      // Reset form
      setEthAmount('');
      setKiltAmount('');
      onClose();
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description: "Failed to add liquidity. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              Add liquidity
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="px-4 pb-4">
            <Card className="p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Slippage tolerance
                  </label>
                  <div className="flex gap-2 mt-2">
                    {['0.1', '0.5', '1.0'].map((value) => (
                      <Button
                        key={value}
                        variant={slippageTolerance === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSlippageTolerance(value)}
                        className="text-xs"
                      >
                        {value}%
                      </Button>
                    ))}
                    <Input
                      value={slippageTolerance}
                      onChange={(e) => setSlippageTolerance(e.target.value)}
                      className="w-16 text-xs"
                      placeholder="Custom"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Transaction deadline
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-20 text-xs"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
        
        <div className="p-4 space-y-4">
          {/* Fee Tier Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Select fee tier
              </span>
              <Info className="h-4 w-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {feeRates.map((fee) => (
                <Button
                  key={fee.rate}
                  variant={selectedFeeRate === fee.rate ? "default" : "outline"}
                  onClick={() => setSelectedFeeRate(fee.rate)}
                  className="h-auto p-3 flex flex-col items-start relative"
                >
                  {fee.recommended && (
                    <Badge className="absolute -top-1 -right-1 text-xs bg-green-500">
                      Best
                    </Badge>
                  )}
                  <div className="font-semibold text-sm">{fee.rate}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-left">
                    {fee.description}
                  </div>
                </Button>
              ))}
            </div>
          </div>
          
          <Separator />
          
          {/* Token Input Cards */}
          <div className="space-y-2">
            {/* ETH Input */}
            <Card className="p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">Ξ</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">ETH</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Balance: {ethBalance}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMaxEth}
                    className="text-xs h-auto p-1 text-blue-600 hover:text-blue-700"
                  >
                    MAX
                  </Button>
                </div>
              </div>
              <Input
                type="number"
                value={ethAmount}
                onChange={(e) => handleEthChange(e.target.value)}
                placeholder="0.0"
                className="text-2xl font-semibold border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </Card>
            
            {/* Plus Icon */}
            <div className="flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-full p-2">
                <Plus className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            
            {/* KILT Input */}
            <Card className="p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <img src={kiltLogo} alt="KILT" className="w-6 h-6 rounded-full" />
                  <span className="font-medium text-gray-900 dark:text-white">KILT</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Balance: {parseFloat(kiltBalance).toLocaleString()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMaxKilt}
                    className="text-xs h-auto p-1 text-blue-600 hover:text-blue-700"
                  >
                    MAX
                  </Button>
                </div>
              </div>
              <Input
                type="number"
                value={kiltAmount}
                onChange={(e) => handleKiltChange(e.target.value)}
                placeholder="0"
                className="text-2xl font-semibold border-0 p-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </Card>
          </div>
          
          {/* Price Info */}
          {ethAmount && kiltAmount && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <div className="flex justify-between">
                  <span>1 ETH = {(1 / parseFloat(currentPrice)).toFixed(0)} KILT</span>
                  <span>1 KILT = {currentPrice} ETH</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Add Liquidity Button */}
          <Button
            onClick={handleAddLiquidity}
            disabled={!ethAmount || !kiltAmount || isLoading || !isConnected}
            className="w-full h-12 text-base font-semibold bg-[#ff0066] hover:bg-[#ff0066]/90 text-white"
          >
            {isLoading ? 'Adding Liquidity...' : !isConnected ? 'Connect Wallet' : 'Add Liquidity'}
          </Button>
          
          {/* Pool Info */}
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {poolExists ? (
                <>Pool exists • Fee tier: {selectedFeeRate}</>
              ) : (
                <>Pool doesn't exist • You'll create the first liquidity position</>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}