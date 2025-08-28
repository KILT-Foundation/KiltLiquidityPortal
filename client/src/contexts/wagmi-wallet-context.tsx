import { createConfig, http, WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { metaMask, walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';
import { ReactNode } from 'react';

// Create WalletConnect singleton to prevent double initialization
let walletConnectConnector: ReturnType<typeof walletConnect> | null = null;

function getWalletConnectConnector() {
  if (!walletConnectConnector) {
    walletConnectConnector = walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'KILT Liquidity Portal',
        description: 'KILT token liquidity incentive program on Base',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://kilt-portal.replit.app',
        icons: ['https://avatars.githubusercontent.com/u/37784886']
      },
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
        themeVariables: {
          '--wcm-z-index': '999999'
        }
      }
    });
  }
  return walletConnectConnector;
}

// Enhanced Wagmi configuration optimized for Base chain with mobile deep linking support
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    // MetaMask with enhanced mobile detection
    metaMask({
      dappMetadata: {
        name: 'KILT Liquidity Portal',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://kilt-portal.replit.app'
      }
    }),
    // Coinbase Wallet with Base-optimized mobile support
    coinbaseWallet({
      appName: 'KILT Liquidity Portal',
      appLogoUrl: 'https://avatars.githubusercontent.com/u/37784886',
      enableMobileWalletLink: true
    }),
    // WalletConnect singleton
    getWalletConnectConnector(),
    // Binance Wallet via injected provider (only if detected)
    injected({
      shimDisconnect: true,
      target() {
        return {
          id: 'binance',
          name: 'Binance Wallet',
          provider: typeof window !== 'undefined' && window.ethereum?.isBinance ? window.ethereum : undefined
        };
      }
    })
  ],
  // Disable auto-reconnection to prevent unwanted wallet connections
  ssr: false,
  transports: {
    // Base-optimized RPC with batching and retry logic
    [base.id]: http('https://mainnet.base.org', {
      batch: true,
      retryCount: 3,
      retryDelay: 150
    }),
  },
});

interface WagmiWalletProviderProps {
  children: ReactNode;
}

export function WagmiWalletProvider({ children }: WagmiWalletProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
    </WagmiProvider>
  );
}

export { wagmiConfig };