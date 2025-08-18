import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, ExternalLink, Info, TrendingUp } from 'lucide-react';
import { useKiltTokenData } from '@/hooks/use-kilt-data';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import kiltLogo from '@assets/KILT_400x400_transparent_1751723574123.png';

// Ethereum Logo Component
const EthereumLogo = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M127.961 0L125.44 8.55656V285.168L127.961 287.688L255.922 212.32L127.961 0Z" fill="#343434"/>
    <path d="M127.962 0L0 212.32L127.962 287.688V153.864V0Z" fill="#8C8C8C"/>
    <path d="M127.961 312.187L126.385 314.154V415.484L127.961 417L255.922 237.832L127.961 312.187Z" fill="#3C3C3B"/>
    <path d="M127.962 417V312.187L0 237.832L127.962 417Z" fill="#8C8C8C"/>
    <path d="M127.961 287.688L255.922 212.32L127.961 153.864V287.688Z" fill="#141414"/>
    <path d="M0 212.32L127.962 287.688V153.864L0 212.32Z" fill="#393939"/>
  </svg>
);

export const SwapModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void; }) => {
  const { data: kiltData } = useKiltTokenData();
  const { address } = useWagmiWallet();
  const [ethAmount, setEthAmount] = useState('0.010');
  const [isCalculating, setIsCalculating] = useState(false);

  // Balance display (mock for now)
  const ethBalance = 0.005404;
  const kiltBalance = 51544.325239;

  // Real-time swap quote calculation
  const { data: swapQuote, isLoading: quoteLoading } = useQuery({
    queryKey: ['/api/swap/quote', ethAmount],
    enabled: !!ethAmount && parseFloat(ethAmount) > 0,
    refetchInterval: 5000, // Update every 5 seconds
    staleTime: 4000
  });

  const kiltOutput = swapQuote?.kiltAmount || '0.0';
  const priceImpact = swapQuote?.priceImpact || 0;

  // Handle percentage buttons
  const handlePercentageClick = (percentage: number) => {
    const maxAmount = Math.min(ethBalance * 0.99, 0.005); // Keep some ETH for gas
    const amount = (maxAmount * percentage / 100).toFixed(6);
    setEthAmount(amount);
  };

  // Handle manual amount input
  const handleAmountChange = useCallback((value: string) => {
    if (!value || value === '') {
      setEthAmount('0');
      return;
    }
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setEthAmount(value);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-black/95 backdrop-blur-xl border border-gray-800/50 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-[#ff0066]" />
              <span>Buy KILT</span>
            </div>
            <div className="flex items-center gap-1">
              <img src={kiltLogo} alt="KILT" className="w-5 h-5" />
              <span className="text-sm text-gray-400">
                ${kiltData?.price?.toFixed(4) || '0.0185'}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Balance Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Your ETH</div>
              <div className="text-lg font-bold text-white">{ethBalance.toFixed(6)}</div>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Your KILT</div>
              <div className="text-lg font-bold text-white">{kiltBalance.toLocaleString()}</div>
            </div>
          </div>

          {/* Swap Interface */}
          <div className="space-y-4">
            {/* You Pay (ETH) */}
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-gray-700/50 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-400">You Pay (ETH)</span>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Manual:</span>
                  <span className="text-white font-mono">{ethAmount}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Or enter exact amount:</span>
                  <span className="text-sm text-gray-500">Max: {Math.min(ethBalance * 0.99, 0.005).toFixed(4)} ETH</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={ethAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.000"
                    className="flex-1 bg-black/50 border-gray-600 text-white text-right font-mono"
                    step="0.001"
                    min="0"
                    max={ethBalance}
                  />
                  <span className="text-gray-400 font-bold">ETH</span>
                </div>

                {/* Percentage Slider and Buttons */}
                <div className="space-y-3">
                  <div className="text-sm text-gray-400">Use slider for quick selection:</div>
                  
                  {/* Visual Slider */}
                  <div className="relative">
                    <div className="h-2 bg-gradient-to-r from-gray-700 via-pink-500 to-[#ff0066] rounded-full relative">
                      <div className="absolute right-4 top-[-8px] text-xs text-gray-400">
                        195% of balance
                      </div>
                      <div className="absolute left-0 bottom-[-20px] text-xs text-gray-400">
                        0.001 ETH
                      </div>
                      <div className="absolute left-1/2 bottom-[-20px] text-xs text-[#ff0066] font-bold">
                        {ethAmount} ETH
                      </div>
                      <div className="absolute right-0 bottom-[-20px] text-xs text-gray-400">
                        0.005 ETH
                      </div>
                    </div>
                  </div>

                  {/* Percentage Buttons */}
                  <div className="grid grid-cols-4 gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePercentageClick(25)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      25%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePercentageClick(50)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      50%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePercentageClick(75)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      75%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePercentageClick(100)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      100%
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Swap Direction Arrow */}
            <div className="flex justify-center">
              <div className="p-2 bg-gradient-to-r from-[#ff0066] to-pink-600 rounded-full">
                <ArrowUpDown className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* You Receive (KILT) */}
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-400 mb-3">You Receive (KILT)</div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-white font-mono">
                  {quoteLoading ? 'Calculating...' : 
                   parseFloat(kiltOutput) > 0 ? parseFloat(kiltOutput).toLocaleString(undefined, {maximumFractionDigits: 2}) : '0.00'}
                </div>
                <span className="text-gray-400 font-bold">KILT</span>
              </div>
              
              {priceImpact > 0 && (
                <div className="mt-2 flex items-center gap-1 text-sm">
                  <TrendingUp className="h-3 w-3 text-orange-400" />
                  <span className="text-orange-400">Price Impact: {priceImpact.toFixed(2)}%</span>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <Button
              disabled={!ethAmount || parseFloat(ethAmount) <= 0}
              onClick={async () => {
                try {
                  // Check if user is connected
                  if (typeof window.ethereum === 'undefined') {
                    // Fallback to Uniswap redirect if no wallet
                    const swapUrl = `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8&chain=base&exactAmount=${ethAmount}&exactField=input`;
                    window.open(swapUrl, '_blank');
                    onClose();
                    return;
                  }

                  // Get user address
                  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                  const userAddress = accounts[0];

                  if (!userAddress) {
                    // Fallback to Uniswap if no address
                    const swapUrl = `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8&chain=base&exactAmount=${ethAmount}&exactField=input`;
                    window.open(swapUrl, '_blank');
                    onClose();
                    return;
                  }

                  // Prepare in-app swap (DexScreener style)
                  const response = await fetch('/api/swap/prepare', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress, ethAmount, slippageTolerance: 0.5 })
                  });

                  if (!response.ok) throw new Error('Failed to prepare swap');

                  const { swapData } = await response.json();

                  // Execute the swap transaction
                  console.log('Sending transaction with data:', swapData);
                  
                  const txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [swapData]
                  });

                  console.log('Swap transaction sent:', txHash);
                  onClose();
                  
                } catch (error) {
                  console.error('Swap error:', error);
                  // Fallback to Uniswap redirect on any error
                  const swapUrl = `https://app.uniswap.org/#/swap?inputCurrency=ETH&outputCurrency=0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8&chain=base&exactAmount=${ethAmount}&exactField=input`;
                  window.open(swapUrl, '_blank');
                  onClose();
                }
              }}
              className="w-full bg-gradient-to-r from-[#ff0066] to-pink-600 hover:from-[#ff0066]/90 hover:to-pink-600/90 text-white font-bold py-4 text-lg transition-all duration-200 shadow-lg hover:shadow-pink-500/25 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
            >
              {parseFloat(ethAmount) <= 0 ? 'Enter Amount' : 
               `Swap ETH → ${parseFloat(kiltOutput) > 0 ? parseFloat(kiltOutput).toLocaleString(undefined, {maximumFractionDigits: 0}) : '0'} KILT`}
            </Button>

            {/* DexScreener-Style Integration Notice */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="text-purple-400 font-semibold mb-1">DexScreener-Style Swap</div>
                  <div className="text-gray-300">
                    Executes swaps directly in-app like DexScreener. Uses DexScreener API for quotes with Uniswap execution. Seamless experience with $0.02 gas fees.
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="space-y-2">
            <Button 
              onClick={onClose}
              variant="outline" 
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};