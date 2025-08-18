import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Wallet, AlertTriangle, Loader2, ChevronDown, LogOut, Monitor } from 'lucide-react';
import { useState } from 'react';
import { base } from 'wagmi/chains';



export function WagmiWalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [showModal, setShowModal] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async (connector: any) => {
    try {
      // Clear any previous wallet connections first
      if (isConnected) {
        disconnect();
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief delay
      }
      
      // Clear localStorage cache for wallet connections
      localStorage.removeItem('wagmi.connected');
      localStorage.removeItem('wagmi.store');
      
      // Connect to the selected wallet
      connect({ connector });
      setShowModal(false);
    } catch (error) {
      console.error('Wallet connection error:', error);
    }
  };

  const handleSwitchAccount = async () => {
    setIsSwitchingAccount(true);
    try {
      // Use wallet_requestPermissions to force account selection dialog
      if ((window as any).ethereum) {
        await (window as any).ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      }
    } catch (error) {
      console.error('Account switch error:', error);
    } finally {
      setIsSwitchingAccount(false);
    }
  };

  const isWrongNetwork = chainId !== base.id;

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {isWrongNetwork && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">CRITICAL: Wrong Network Detected</span>
            </div>
            <p className="text-xs text-red-300 mb-2">
              You're connected to <strong>chain {chainId}</strong> but KILT Portal requires <strong>Base network (8453)</strong>.
            </p>
            <p className="text-xs text-red-300 mb-3">
              All transactions will fail until you switch networks. Click below to switch automatically.
            </p>
            <Button
              onClick={async () => {
                console.log(`🚨 URGENT: Manual switch triggered - User on chain ${chainId}, need Base (8453)`);
                try {
                  await switchChain({ chainId: base.id });
                } catch (error: any) {
                  console.error('Manual switch failed:', error);
                  // Try direct MetaMask method
                  try {
                    await window.ethereum?.request({
                      method: 'wallet_switchEthereumChain',
                      params: [{ chainId: '0x2105' }], // Base chain ID in hex
                    });
                  } catch (metaMaskError) {
                    alert('CRITICAL: Please manually switch to Base network in your wallet settings. You are currently on the wrong network and transactions will fail.');
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-500 text-white text-sm h-8 px-4 w-full"
            >
              Fix Network Issue - Switch to Base (8453)
            </Button>
          </div>
        )}

        {!isWrongNetwork && (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Base Network
          </Badge>
        )}

        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-[#ff0066]/20 rounded-xl px-4 py-2">
          <Wallet className="h-4 w-4 text-[#ff0066]" />
          <span className="font-mono text-sm text-white">{formatAddress(address)}</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 px-2 text-xs hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black/90 backdrop-blur-md border border-white/10 text-white">
              <DropdownMenuItem 
                onClick={() => {
                  // Clear all wallet-related localStorage when disconnecting
                  localStorage.removeItem('wagmi.connected');
                  localStorage.removeItem('wagmi.store');
                  localStorage.removeItem('wagmi.cache');
                  localStorage.removeItem('wagmi.injected.shimDisconnect');
                  
                  // Clear Phantom-specific storage
                  if ((window as any).phantom?.ethereum) {
                    try {
                      (window as any).phantom.ethereum.disconnect?.();
                    } catch (error) {
                      console.log('Phantom disconnect not available');
                    }
                  }
                  
                  disconnect();
                }}
                className="hover:bg-red-500/20 focus:bg-red-500/20 hover:text-red-400 focus:text-red-400 cursor-pointer"
              >
                <LogOut className="mr-2 h-3 w-3" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff1a75] hover:to-[#e60059] text-white border-0 shadow-lg hover:shadow-xl shadow-[#ff0066]/20 transition-all duration-300 px-6"
      >
        {isPending ? (
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
        <DialogContent className="bg-black border border-gray-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl font-bold flex items-center gap-3 mb-6">
              <Wallet className="h-6 w-6" />
              Connect Your Wallet
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-gray-400 mb-4">
              <Monitor className="h-4 w-4" />
              <span className="text-sm">Available Wallets</span>
            </div>
            
            {/* Filter out unwanted wallets and remove duplicates */}
            {connectors
              .filter((connector, index, array) => 
                connector.name !== 'Injected' && 
                !connector.name.includes('Binance') && // Remove any duplicate Binance entries
                !connector.name.toLowerCase().includes('keplr') && // Remove Keplr
                array.findIndex(c => c.name === connector.name) === index // Remove duplicates
              )
              .map((connector) => (
              <Button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                disabled={isPending}
                className="w-full bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff3385] hover:to-[#ff0066] text-white border-0 h-14 text-lg font-medium justify-start px-6 rounded-lg transition-all duration-200"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-4 h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-4 h-5 w-5" />
                    {connector.name === 'WalletConnect' ? 'WalletConnect (200+ wallets)' : connector.name}
                  </>
                )}
              </Button>
            ))}
            
            {/* Single Binance Wallet Button */}
            <Button
              onClick={() => {
                if (window.ethereum?.isBinance) {
                  const binanceConnector = connectors.find(c => c.id === 'binance' || c.name.includes('Binance'));
                  if (binanceConnector) {
                    handleConnect(binanceConnector);
                  }
                } else {
                  window.open('https://www.binance.com/en/web3wallet', '_blank');
                }
              }}
              disabled={isPending}
              className="w-full bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff3385] hover:to-[#ff0066] text-white border-0 h-14 text-lg font-medium justify-start px-6 rounded-lg transition-all duration-200"
            >
              <Wallet className="mr-4 h-5 w-5" />
              Binance Wallet
            </Button>
          </div>

          <div className="text-sm text-gray-500 text-center mt-6">
            By connecting, you agree to the Terms of Service and Privacy Policy
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}