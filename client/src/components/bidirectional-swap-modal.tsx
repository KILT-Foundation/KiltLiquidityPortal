import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ExternalLink } from 'lucide-react';
import { useKiltTokenData } from '@/hooks/use-kilt-data';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useState, useEffect } from 'react';
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

interface BidirectionalSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  kiltBalance: string;
  ethBalance: string;
  formatTokenAmount: (amount: string, token: string) => string;
  onPurchaseComplete?: () => void;
}

export const BidirectionalSwapModal = ({ 
  isOpen, 
  onClose, 
  kiltBalance: propKiltBalance, 
  ethBalance: propEthBalance,
  formatTokenAmount,
  onPurchaseComplete 
}: BidirectionalSwapModalProps) => {
  const { data: kiltData } = useKiltTokenData();
  const { address, isConnected } = useWagmiWallet();
  
  const [activeTab, setActiveTab] = useState<'widget' | 'fallback'>('fallback');

  // Reset modal state when closing
  const handleClose = () => {
    onClose();
  };

  // Uniswap Widget URL for KILT/ETH pair on Base
  const getUniswapWidgetUrl = () => {
    const baseUrl = 'https://app.uniswap.org/swap';
    const params = new URLSearchParams({
      chain: 'base',
      inputCurrency: 'ETH', 
      outputCurrency: '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8', // KILT token address
      theme: 'dark'
    });
    
    if (address) {
      params.append('recipient', address);
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  // Handle opening external Uniswap
  const openUniswapExternal = () => {
    window.open(getUniswapWidgetUrl(), '_blank');
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-black/40 backdrop-blur-xl border border-white/10 text-white p-0 overflow-hidden">
        {/* Modal Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff0066]/10 to-transparent blur-xl"></div>
          <div className="relative bg-black/30 backdrop-blur-sm border-b border-white/10 p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <ArrowUpDown className="h-5 w-5 text-[#ff0066]" />
                  <span>Swap ETH ⇄ KILT</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    onClick={() => setActiveTab('widget')}
                    variant={activeTab === 'widget' ? 'default' : 'ghost'}
                    size="sm"
                    className={`text-xs transition-all duration-300 ${
                      activeTab === 'widget' 
                        ? 'bg-[#ff0066] text-white' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Uniswap
                  </Button>
                  <Button
                    onClick={() => setActiveTab('fallback')}
                    variant={activeTab === 'fallback' ? 'default' : 'ghost'}
                    size="sm"
                    className={`text-xs transition-all duration-300 ${
                      activeTab === 'fallback' 
                        ? 'bg-[#ff0066] text-white' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    External
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {activeTab === 'widget' ? (
            <>
              {/* Widget Blocked Notice */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange/10 to-transparent rounded-xl blur-sm"></div>
                <div className="relative bg-black/30 backdrop-blur-sm border border-orange-500/20 rounded-xl p-6 text-center">
                  <div className="text-orange-400 mb-4">
                    <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h3 className="text-lg font-semibold mb-2">Widget Blocked</h3>
                    <p className="text-sm text-white/70 mb-4">
                      Embedded trading widgets are blocked by security policies. Use the "External" tab for full Uniswap access.
                    </p>
                  </div>
                  
                  <Button
                    onClick={() => setActiveTab('fallback')}
                    className="bg-gradient-to-r from-[#ff0066] to-[#ff3385] hover:from-[#cc0052] hover:to-[#e6005c] text-white font-medium rounded-xl transition-all duration-300"
                  >
                    Switch to External Trading
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* External Link Option */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl blur-sm"></div>
                <div className="relative bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center">
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <EthereumLogo className="w-8 h-8" />
                      <ArrowUpDown className="h-5 w-5 text-[#ff0066]" />
                      <img src={kiltLogo} alt="KILT" className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Swap on Uniswap</h3>
                    <p className="text-sm text-white/70">
                      Open the official Uniswap interface in a new tab with KILT/ETH pair pre-selected
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={openUniswapExternal}
                      className="w-full h-12 bg-gradient-to-r from-[#ff0066] to-[#ff3385] hover:from-[#cc0052] hover:to-[#e6005c] text-white font-medium rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Uniswap Interface
                    </Button>

                    <div className="text-xs text-white/50 space-y-1">
                      <div>• Opens app.uniswap.org with KILT token pre-configured</div>
                      <div>• Connects with your wallet automatically</div>
                      <div>• Base network and KILT/ETH pair pre-selected</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Trading Info */}
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                <div className="text-sm text-white/70">
                  <div className="flex items-center gap-2 mb-3">
                    <img src={kiltLogo} alt="KILT" className="w-4 h-4" />
                    <span className="font-medium">KILT Trading Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-white/50 mb-1">Token Address</div>
                      <div className="font-mono text-white/80">0x5D0D...2d8</div>
                    </div>
                    <div>
                      <div className="text-white/50 mb-1">Network</div>
                      <div className="text-white/80">Base</div>
                    </div>
                    <div>
                      <div className="text-white/50 mb-1">Pool Fee</div>
                      <div className="text-white/80">0.3%</div>
                    </div>
                    <div>
                      <div className="text-white/50 mb-1">Current Price</div>
                      <div className="text-white/80">${kiltData?.price?.toFixed(6) || '...'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Close Button */}
          <Button 
            onClick={handleClose}
            variant="outline" 
            className="w-full border-white/20 bg-black/30 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/30 rounded-xl transition-all duration-300"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};