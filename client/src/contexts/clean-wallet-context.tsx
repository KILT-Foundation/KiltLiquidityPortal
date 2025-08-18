import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

interface CleanWalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBase: () => Promise<boolean>;
}

const CleanWalletContext = createContext<CleanWalletContextType | undefined>(undefined);

interface CleanWalletProviderProps {
  children: ReactNode;
}

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_HEX = '0x2105';

export function CleanWalletProvider({ children }: CleanWalletProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

  const connect = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask to connect your wallet');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      const web3Provider = new BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const userAddress = await web3Signer.getAddress();
      
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
      setIsConnected(true);
      
      console.log('Wallet connected:', userAddress);
      
      // Check if on Base network
      const chainId = await web3Provider.getNetwork();
      if (Number(chainId.chainId) !== BASE_CHAIN_ID) {
        await switchToBase();
      }
      
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setIsConnected(false);
    setProvider(null);
    setSigner(null);
    console.log('Wallet disconnected');
  };

  const switchToBase = async (): Promise<boolean> => {
    if (!window.ethereum) return false;

    try {
      // Try to switch to Base network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_HEX }],
      });
      return true;
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_CHAIN_HEX,
                chainName: 'Base',
                rpcUrls: ['https://mainnet.base.org'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Base network:', addError);
          return false;
        }
      } else {
        console.error('Failed to switch network:', switchError);
        return false;
      }
    }
  };

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0] !== address) {
          setAddress(accounts[0]);
          console.log('Account changed to:', accounts[0]);
        }
      };

      const handleChainChanged = (chainId: string) => {
        console.log('Chain changed to:', chainId);
        // Reload the page on network change as recommended by MetaMask
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [address]);

  // Auto-connect on page load if previously connected
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const web3Provider = new BrowserProvider(window.ethereum);
            const web3Signer = await web3Provider.getSigner();
            
            setProvider(web3Provider);
            setSigner(web3Signer);
            setAddress(accounts[0]);
            setIsConnected(true);
          }
        } catch (error) {
          console.error('Failed to check existing connection:', error);
        }
      }
    };

    checkConnection();
  }, []);

  const value: CleanWalletContextType = {
    address,
    isConnected,
    isConnecting,
    provider,
    signer,
    connect,
    disconnect,
    switchToBase,
  };

  return (
    <CleanWalletContext.Provider value={value}>
      {children}
    </CleanWalletContext.Provider>
  );
}

export function useCleanWallet(): CleanWalletContextType {
  const context = useContext(CleanWalletContext);
  if (context === undefined) {
    throw new Error('useCleanWallet must be used within a CleanWalletProvider');
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}