import { useState } from 'react';
import { useCleanWallet } from '@/contexts/clean-wallet-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wallet, ExternalLink, Shield } from 'lucide-react';

export function CleanWalletConnect() {
  const { address, isConnected, isConnecting, connect, disconnect } = useCleanWallet();
  const [showModal, setShowModal] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="bg-[#ff0066]/10 text-[#ff0066] border-[#ff0066]/30">
          <div className="w-2 h-2 bg-[#ff0066] rounded-full mr-2 animate-pulse"></div>
          Base Network
        </Badge>
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-[#ff0066]/20 rounded-xl px-4 py-2">
          <Wallet className="h-4 w-4 text-[#ff0066]" />
          <span className="font-mono text-sm text-white">{formatAddress(address)}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnect}
            className="ml-2 h-6 px-2 text-xs hover:bg-red-500/20 hover:text-red-400"
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        disabled={isConnecting}
        className="bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff1a75] hover:to-[#e60059] text-white border-0 shadow-lg hover:shadow-xl shadow-[#ff0066]/20 transition-all duration-300 px-6"
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </>
        )}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md bg-black/95 backdrop-blur-xl border border-gray-800/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#ff0066]" />
              Connect Your Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-[#ff0066]/10 to-purple-500/10 border border-[#ff0066]/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 flex-shrink-0">
                  <span className="text-2xl">🦊</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">MetaMask</h3>
                  <p className="text-gray-400 text-sm mb-3">
                    Most popular Ethereum wallet with browser extension
                  </p>
                  <Button
                    onClick={() => {
                      setShowModal(false);
                      connect();
                    }}
                    className="w-full bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff1a75] hover:to-[#e60059] text-white border-0 shadow-lg hover:shadow-xl shadow-[#ff0066]/20"
                  >
                    Connect MetaMask
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Security Notice</span>
              </div>
              <p className="text-gray-400 text-xs">
                We'll automatically switch you to the Base network. Your wallet will be used to interact with KILT liquidity pools.
              </p>
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-xs">
                Don't have MetaMask?{' '}
                <button
                  onClick={() => window.open('https://metamask.io/download/', '_blank')}
                  className="text-[#ff0066] hover:text-[#ff1a75] underline"
                >
                  Download here <ExternalLink className="h-3 w-3 inline ml-1" />
                </button>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}