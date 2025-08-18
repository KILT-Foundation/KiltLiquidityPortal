import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Info,
  ExternalLink,
  ArrowUpDown,
  Coins
} from 'lucide-react';
import { BidirectionalSwapModal } from './bidirectional-swap-modal';

interface BuyKiltProps {
  kiltBalance: string;
  ethBalance: string;
  wethBalance: string;
  formatTokenAmount: (amount: string, token: string) => string;
  onPurchaseComplete?: () => void;
}

export function BuyKilt({ 
  kiltBalance, 
  ethBalance, 
  wethBalance, 
  formatTokenAmount,
  onPurchaseComplete 
}: BuyKiltProps) {
  const [showSwapModal, setShowSwapModal] = useState(false);

  return (
    <div className="space-y-6 tab-content-safe">
      {/* Balance Cards Row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* ETH Balance Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff0066]/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-[#ff0066]/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-[#ff0066]/30 group-hover:shadow-lg group-hover:shadow-[#ff0066]/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-2">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#ff0066]/20 to-[#ff0066]/10 border border-[#ff0066]/30 flex items-center justify-center flex-shrink-0">
                <Coins className="h-3 w-3 text-[#ff0066]" />
              </div>
              <span className="text-white/70 text-xs font-medium">Your ETH</span>
            </div>
            <div className="text-white text-base font-bold mb-1 numeric-large">
              {ethBalance}
            </div>
            <div className="text-white/50 text-xs font-medium">
              Available Balance
            </div>
          </div>
        </div>

        {/* KILT Balance Card */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-emerald-400/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-emerald-400/30 group-hover:shadow-lg group-hover:shadow-emerald-400/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-2">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-400/20 to-emerald-400/10 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              </div>
              <span className="text-white/70 text-xs font-medium">Your KILT</span>
            </div>
            <div className="text-white text-base font-bold mb-1 numeric-large">
              {kiltBalance}
            </div>
            <div className="text-white/50 text-xs font-medium">
              Available Balance
            </div>
          </div>
        </div>
      </div>

      {/* Market Information Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Pool TVL */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-blue-400/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-20 transition-all duration-300 group-hover:border-blue-400/30 group-hover:shadow-lg group-hover:shadow-blue-400/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-blue-400/20 to-blue-400/10 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-2.5 w-2.5 text-blue-400" />
              </div>
              <span className="text-white/70 text-xs font-medium">Pool TVL</span>
            </div>
            <div className="text-white text-sm font-bold numeric-large">$99,171</div>
          </div>
        </div>

        {/* 24h Volume */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-purple-400/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-20 transition-all duration-300 group-hover:border-purple-400/30 group-hover:shadow-lg group-hover:shadow-purple-400/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-purple-400/20 to-purple-400/10 border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                <ArrowUpDown className="h-2.5 w-2.5 text-purple-400" />
              </div>
              <span className="text-white/70 text-xs font-medium">24h Volume</span>
            </div>
            <div className="text-white text-sm font-bold numeric-large">$12,485</div>
          </div>
        </div>

        {/* KILT Price */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-green-400/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-20 transition-all duration-300 group-hover:border-green-400/30 group-hover:shadow-lg group-hover:shadow-green-400/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-400/20 to-green-400/10 border border-green-400/30 flex items-center justify-center flex-shrink-0">
                <Coins className="h-2.5 w-2.5 text-green-400" />
              </div>
              <span className="text-white/70 text-xs font-medium">KILT Price</span>
            </div>
            <div className="text-white text-sm font-bold numeric-large">$0.0168</div>
          </div>
        </div>

        {/* 24h Change */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-emerald-400/30"></div>
          <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-20 transition-all duration-300 group-hover:border-emerald-400/30 group-hover:shadow-lg group-hover:shadow-emerald-400/10 flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-emerald-400/20 to-emerald-400/10 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
              </div>
              <span className="text-white/70 text-xs font-medium">24h Change</span>
            </div>
            <div className="text-emerald-400 text-sm font-bold numeric-large">+1.70%</div>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Swap Button */}
        <Button 
          onClick={() => setShowSwapModal(true)}
          className="h-12 bg-gradient-to-r from-[#ff0066] to-[#ff3385] hover:from-[#cc0052] hover:to-[#e6005c] text-white font-medium text-sm rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl border-0"
        >
          <ArrowUpDown className="w-4 h-4 mr-2" />
          Open Swap Interface
        </Button>

        {/* DexScreener Button */}
        <Button
          variant="outline"
          className="h-12 border-white/20 bg-black/30 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/30 rounded-xl px-4 text-xs transition-all duration-300"
          onClick={() => window.open('https://dexscreener.com/base/0x82da478b1382b951cbad01beb9ed459cdb16458e', '_blank')}
        >
          <ExternalLink className="w-3 h-3 mr-2" />
          View on DexScreener
        </Button>
      </div>

      {/* Bidirectional Swap Modal */}
      <BidirectionalSwapModal 
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        kiltBalance={kiltBalance}
        ethBalance={ethBalance}
        formatTokenAmount={formatTokenAmount}
        onPurchaseComplete={onPurchaseComplete}
      />
    </div>
  );
}