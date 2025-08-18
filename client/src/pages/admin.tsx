import { useState, useEffect } from "react";
import { useWagmiWallet } from "@/hooks/use-wagmi-wallet";
import { CyberpunkAdminPanel } from "@/components/cyberpunk-admin-panel";

export default function AdminPage() {
  const { isConnected, address, connect, connectors } = useWagmiWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Authorized admin wallets (hidden from UI for security)
  const authorizedWallets = [
    '0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e',
    '0x861722f739539CF31d86F1221460Fa96C9baB95C',
    '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a',  // Contract owner wallet
    '0xD117738595dfAFe4c2f96bcF63Ed381788E08d39'   // User-requested admin access
  ];

  const handleMetaMaskLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // First connect wallet if not connected
      if (!isConnected) {
        const metaMaskConnector = connectors.find(connector => 
          connector.name.toLowerCase().includes('metamask') || 
          connector.name.toLowerCase().includes('injected')
        );
        
        if (!metaMaskConnector) {
          setError('MetaMask connector not found. Please install MetaMask.');
          return;
        }
        
        await connect({ connector: metaMaskConnector });
        // Wait a moment for wallet connection to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Check if wallet is now connected and authorized
      if (!address) {
        setError('Wallet connection failed. Please try again.');
        return;
      }

      // Debug: Show the actual connected address
      console.log('Connected address:', address);
      console.log('Authorized wallets:', authorizedWallets);
      
      // Check authorization with case-insensitive comparison
      const normalizedAddress = address.toLowerCase();
      const normalizedAuthorizedWallets = authorizedWallets.map(addr => addr.toLowerCase());
      
      if (!normalizedAuthorizedWallets.includes(normalizedAddress)) {
        setError(`Access denied. Connected wallet: ${address.slice(0, 6)}...${address.slice(-4)} is not authorized for admin access.`);
        return;
      }

      // Authenticate with backend
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_wallet', address);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('MetaMask authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-authenticate if wallet is already connected and authorized
  const checkAutoAuth = async () => {
    if (isConnected && address && authorizedWallets.includes(address)) {
      const existingToken = localStorage.getItem('admin_token');
      const existingWallet = localStorage.getItem('admin_wallet');
      
      if (existingToken && existingWallet === address) {
        setIsAuthenticated(true);
      }
    }
  };

  // Check for auto-authentication on component mount and wallet changes
  useEffect(() => {
    checkAutoAuth();
  }, [isConnected, address]);

  if (isAuthenticated) {
    return <CyberpunkAdminPanel />;
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono overflow-hidden relative">
      {/* Matrix Rain Background */}
      <div className="fixed inset-0 opacity-10">
        <div className="matrix-rain"></div>
      </div>
      
      {/* Cyberpunk Grid */}
      <div className="fixed inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 102, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 102, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="bg-black/90 border border-green-400 rounded-lg p-8 w-full max-w-md shadow-2xl shadow-green-400/20">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#ff0066] mb-2 tracking-wider">
              ◢◤ ADMIN TERMINAL ◥◣
            </h1>
            <div className="text-green-400 text-sm">
              [METAMASK_AUTHENTICATION_REQUIRED]
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 border border-red-500 bg-red-500/10 text-red-400 text-sm font-mono">
              [ERROR] {error}
            </div>
          )}

          {/* MetaMask Login */}
          <div className="space-y-4">
            <div className="text-center text-sm text-green-400 font-mono mb-4">
              Connect with your authorized MetaMask wallet to access admin controls
            </div>
            
            {isConnected && address ? (
              <div className="p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono text-sm">
                <div className="flex items-center justify-between">
                  <span>WALLET:</span>
                  <span>{address.slice(0, 6)}...{address.slice(-4)}</span>
                </div>
                {authorizedWallets.map(addr => addr.toLowerCase()).includes(address.toLowerCase()) ? (
                  <div className="text-green-400 text-xs mt-1">✓ AUTHORIZED ADMIN WALLET</div>
                ) : (
                  <div className="text-red-400 text-xs mt-1">✗ UNAUTHORIZED WALLET</div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 font-mono text-sm text-center">
                [METAMASK_NOT_CONNECTED]
              </div>
            )}

            <button
              onClick={handleMetaMaskLogin}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-[#ff0066] to-[#ff0066]/80 text-white font-mono font-bold rounded hover:from-[#ff0066]/90 hover:to-[#ff0066]/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed cyberpunk-pink-glow"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>[AUTHENTICATING...]</span>
                </div>
              ) : isConnected && address ? (
                '[VERIFY_ADMIN_ACCESS]'
              ) : (
                '[CONNECT_METAMASK]'
              )}
            </button>

            <div className="text-center text-xs text-green-400/50 font-mono">
              Only authorized admin wallets can access this terminal
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-green-400/50 font-mono">
            KILT_PROTOCOL_ADMIN_v2.0
          </div>
        </div>
      </div>
    </div>
  );
}