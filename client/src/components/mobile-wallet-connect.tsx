import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useBaseNetwork } from '@/hooks/use-base-network';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Wallet, Smartphone, Monitor, ExternalLink, Loader2, CheckCircle, ChevronDown, RefreshCw, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { MOBILE_WALLET_LINKS, isMobileDevice, openMobileWallet, getRecommendedWallets } from '@/utils/mobile-wallet-links';



export function MobileWalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { isOnBase, shouldSwitchToBase, switchToBase } = useBaseNetwork();
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMobileWalletConnect = async (wallet: any) => {
    try {
      // Find the matching connector
      const connector = connectors.find(c => 
        c.id === wallet.id || 
        c.name.toLowerCase().includes(wallet.name.toLowerCase()) ||
        c.id === 'walletConnect' // Always try WalletConnect for mobile
      );

      if (wallet.id === 'walletConnect') {
        // WalletConnect: Always use WalletConnect connector
        const wcConnector = connectors.find(c => c.id === 'walletConnect' || c.name === 'WalletConnect');
        if (wcConnector) {
          connect({ connector: wcConnector });
          setShowModal(false);
          toast({
            title: "Connecting Wallet",
            description: "Scan QR code or approve connection in your wallet app",
          });
        }
      } else if (isMobile && wallet.id !== 'walletConnect') {
        // Mobile deep link for specific wallets
        console.log(`Attempting mobile wallet connection: ${wallet.name} (${wallet.id})`);
        
        const success = openMobileWallet(wallet.id);
        setShowModal(false);
        
        if (success) {
          toast({
            title: "Opening Wallet App",
            description: `Redirecting to ${wallet.name}. If the app doesn't open, try WalletConnect instead.`,
          });
          
          // If app doesn't open after 4 seconds, suggest WalletConnect
          setTimeout(() => {
            if (!isConnected && document.visibilityState === 'visible') {
              toast({
                title: "App Not Opening?",
                description: "Try the WalletConnect option instead - it works with any wallet.",
                variant: "default",
              });
            }
          }, 4000);
        } else {
          // Immediate fallback to WalletConnect
          toast({
            title: "Deep Link Failed",
            description: `Couldn't open ${wallet.name}. Please use WalletConnect or install the app.`,
            variant: "destructive",
          });
        }
      } else if (!isMobile && connector) {
        // Desktop: use direct connector
        connect({ connector });
        setShowModal(false);
      } else {
        // Fallback to WalletConnect
        const wcConnector = connectors.find(c => c.id === 'walletConnect');
        if (wcConnector) {
          connect({ connector: wcConnector });
          setShowModal(false);
        }
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      toast({
        title: "Connection Failed",
        description: `Could not connect to ${wallet.name}. Try WalletConnect instead.`,
        variant: "destructive",
      });
      
      // Fallback to WalletConnect on error
      const wcConnector = connectors.find(c => c.id === 'walletConnect');
      if (wcConnector) {
        connect({ connector: wcConnector });
        setShowModal(false);
      }
    }
  };

  const handleDesktopConnect = (connector: any) => {
    connect({ connector });
    setShowModal(false);
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

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {shouldSwitchToBase ? (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 cursor-pointer" onClick={switchToBase}>
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
            Switch to Base
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
            Connected • Base
          </Badge>
        )}
        <div className="mobile-wallet-display flex items-center gap-1 sm:gap-2 bg-black/40 backdrop-blur-xl border border-[#ff0066]/20 rounded-xl px-2 sm:px-4 py-2">
          <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-[#ff0066]" />
          <span className="font-mono text-xs sm:text-sm text-white">
            <span className="sm:hidden">{address.slice(0, 4)}...{address.slice(-3)}</span>
            <span className="hidden sm:inline">{address.slice(0, 6)}...{address.slice(-4)}</span>
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mobile-button-small ml-1 sm:ml-2 h-5 sm:h-6 px-1 sm:px-2 text-xs hover:bg-white/10 hover:text-white"
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
        className="mobile-button-fix inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] shadow-medium-modern hover:shadow-strong-modern hover:-translate-y-0.5 h-10 sm:h-11 py-2 sm:py-2.5 bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff1a75] hover:to-[#e60059] text-white border-0 shadow-lg hover:shadow-xl shadow-[#ff0066]/20 transition-all duration-300 px-4 sm:px-6"
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
        <DialogContent className="mobile-dialog-fix bg-black border border-gray-800 max-w-[95vw] sm:max-w-md w-full mx-auto my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl sm:text-2xl font-bold flex items-center gap-3 mb-4 sm:mb-6">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
              Connect Your Wallet
            </DialogTitle>
          </DialogHeader>

          
          {/* Mobile Section */}
          {isMobile ? (
            <div className="space-y-3 px-1">
              <div className="flex items-center gap-3 text-gray-400 mb-3">
                <Smartphone className="h-4 w-4" />
                <span className="text-sm">Mobile Wallets</span>
              </div>
              
              {/* WalletConnect First - Works with 200+ wallets */}
              <Button
                onClick={() => handleMobileWalletConnect({ id: 'walletConnect', name: 'WalletConnect (200+ wallets)' })}
                disabled={isPending}
                className="w-full bg-gradient-to-r from-[#3b9df8] to-[#2b7fd8] hover:from-[#4daef9] hover:to-[#3b9df8] text-white border-0 h-12 sm:h-14 text-sm sm:text-lg font-medium justify-start px-4 sm:px-6 rounded-lg transition-all duration-200"
              >
                <div className="flex items-center gap-3 sm:gap-4 w-full">
                  <svg className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.65 7.65c4.7-4.7 12.3-4.7 17 0L22.5 9.8c.4.4.4 1 0 1.4l-1.9 1.9c-.2.2-.5.2-.7 0l-2.2-2.2c-3.3-3.3-8.6-3.3-11.9 0l-2.4 2.4c-.2.2-.5.2-.7 0L1.5 11.2c-.4-.4-.4-1 0-1.4L7.65 7.65zM12 15c1.5 0 2.8 1.3 2.8 2.8s-1.3 2.8-2.8 2.8-2.8-1.3-2.8-2.8S10.5 15 12 15z"/>
                  </svg>
                  <span className="font-medium text-left">WalletConnect (Recommended)</span>
                </div>
              </Button>
              
              {/* Specific wallet options */}
              {getRecommendedWallets().filter(w => w.id !== 'walletConnect').map((wallet) => (
                <Button
                  key={wallet.id}
                  onClick={() => handleMobileWalletConnect(wallet)}
                  disabled={isPending}
                  className="w-full bg-gradient-to-r from-[#ff0066] to-[#cc0052] hover:from-[#ff3385] hover:to-[#ff0066] text-white border-0 h-11 sm:h-12 text-sm sm:text-md font-medium justify-start px-4 sm:px-6 rounded-lg transition-all duration-200"
                >
                  <div className="flex items-center gap-3 sm:gap-4 w-full">
                    <Wallet className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium text-left">{wallet.name}</span>
                  </div>
                </Button>
              ))}


            </div>
          ) : (
            // Desktop Section
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
                  onClick={() => handleDesktopConnect(connector)}
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
                      handleDesktopConnect(binanceConnector);
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
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error.message}</p>
            </div>
          )}

          <div className="text-xs sm:text-sm text-gray-500 text-center mt-4 sm:mt-6 px-2">
            By connecting, you agree to the Terms of Service and Privacy Policy
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}