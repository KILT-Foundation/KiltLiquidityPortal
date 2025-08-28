import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpDown } from 'lucide-react';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useKiltTokenData } from '@/hooks/use-kilt-data';

// Import centralized token addresses
import { TOKEN_ADDRESSES } from '@/lib/contracts';

import kiltLogo from '@assets/KILT_400x400_transparent_1751723574123.png';

const EthereumLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path d="M11.944 17.97L4.58 13.62L11.943 24L19.31 13.62L11.944 17.97Z" fill="#627EEA"/>
    <path d="M11.943 0L4.58 12.22L11.943 16.616L19.31 12.22L11.943 0Z" fill="#627EEA" fillOpacity="0.602"/>
  </svg>
);

export const FloatingSwapWidget = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { address } = useWagmiWallet();
  const { data: kiltData } = useKiltTokenData();

  // Generate Uniswap URL with KILT pre-configured
  const getUniswapUrl = () => {
    const baseUrl = 'https://app.uniswap.org/swap';
    const params = new URLSearchParams({
      chain: 'base',
      inputCurrency: 'ETH',
      outputCurrency: TOKEN_ADDRESSES.KILT, // KILT token
      theme: 'dark'
    });
    
    if (address) {
      params.append('recipient', address);
    }
    
    return `${baseUrl}?${params.toString()}`;
  };

  const handleSwapClick = () => {
    window.open(getUniswapUrl(), '_blank');
  };

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Expanded Widget */}
      {isExpanded && (
        <div className="absolute bottom-24 right-0 mb-4">
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 min-w-[320px] max-w-[380px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#ff0066] rounded-lg">
                    <ArrowUpDown className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-gray-900 font-bold text-lg">Swap KILT</span>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-bold w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg"
                >
                  ×
                </button>
              </div>

              {/* Swap Preview */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <EthereumLogo className="w-8 h-8" />
                    <span className="text-gray-900 font-semibold text-lg">ETH</span>
                  </div>
                  <div className="p-2 bg-[#ff0066] rounded-full">
                    <ArrowUpDown className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={kiltLogo} alt="KILT" className="w-8 h-8" />
                    <span className="text-gray-900 font-semibold text-lg">KILT</span>
                  </div>
                </div>
                
                {/* Current Price */}
                <div className="text-center p-3 bg-[#ff0066]/10 rounded-lg border border-[#ff0066]/20">
                  <div className="text-gray-900 text-sm font-medium">
                    Current Rate: <span className="text-[#ff0066] font-bold">${kiltData?.price?.toFixed(6) || 'Loading...'}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <Button
                onClick={handleSwapClick}
                className="w-full bg-[#ff0066] hover:bg-[#e6005c] text-white font-bold text-lg rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0 py-4"
              >
                <ExternalLink className="h-5 w-5 mr-3" />
                Open Uniswap Exchange
              </Button>

              {/* Info */}
              <div className="text-xs text-gray-500 text-center mt-4 p-2 bg-gray-50 rounded-lg">
                Trades on Base Network via Uniswap V3 • 0.3% Fee
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button - Larger and More Visible */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative group w-20 h-20 rounded-2xl bg-[#ff0066] hover:bg-[#e6005c] border-4 border-white shadow-2xl transition-all duration-300 hover:scale-105"
      >
        {/* Button content */}
        <div className="relative flex flex-col items-center justify-center z-10">
          {isExpanded ? (
            <span className="text-white text-2xl font-bold">×</span>
          ) : (
            <>
              <span className="text-white font-bold text-lg leading-none mb-1">SWAP</span>
              <div className="flex items-center">
                <span className="text-white font-bold text-sm">ETH</span>
                <ArrowUpDown className="h-4 w-4 text-white mx-1" />
                <span className="text-white font-bold text-sm">KILT</span>
              </div>
            </>
          )}
        </div>

        {/* Subtle pulse animation */}
        <div className="absolute inset-0 rounded-2xl border-4 border-[#ff0066] animate-pulse opacity-50"></div>
      </Button>
    </div>
  );
};