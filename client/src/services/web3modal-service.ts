// Simple Web3Modal v3-style service without complex dependencies
export interface WalletOption {
  id: string;
  name: string;
  icon: string;
  rdns?: string;
  injected?: boolean;
  downloadUrls?: {
    [key: string]: string;
  };
}

export class Web3ModalService {
  private walletOptions: WalletOption[] = [
    {
      id: 'metamask',
      name: 'MetaMask',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMCAzMCI+PC9zdmc+',
      rdns: 'io.metamask',
      injected: true,
      downloadUrls: {
        chrome: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/',
        edge: 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm'
      }
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMCAzMCI+PC9zdmc+',
      rdns: 'com.coinbase.wallet',
      injected: true,
      downloadUrls: {
        chrome: 'https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad',
        mobile: 'https://www.coinbase.com/wallet/downloads'
      }
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMCAzMCI+PC9zdmc+',
      injected: false
    },
    {
      id: 'trust',
      name: 'Trust Wallet',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMCAzMCI+PC9zdmc+',
      downloadUrls: {
        ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
        android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp'
      }
    },
    {
      id: 'phantom',
      name: 'Phantom',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAzMCAzMCI+PC9zdmc+',
      rdns: 'app.phantom',
      injected: true,
      downloadUrls: {
        chrome: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa'
      }
    }
  ];

  private isInjectedWalletDetected(rdns: string): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for MetaMask specifically
    if (rdns === 'io.metamask') {
      const ethereum = (window as any).ethereum;
      return !!(ethereum && (ethereum.isMetaMask || ethereum._metamask));
    }
    
    // Check for Coinbase Wallet
    if (rdns === 'com.coinbase.wallet') {
      const ethereum = (window as any).ethereum;
      return !!(ethereum && (ethereum.isCoinbaseWallet || ethereum.selectedProvider?.isCoinbaseWallet));
    }
    
    // Check for Phantom
    if (rdns === 'app.phantom') {
      return !!(window as any).phantom?.ethereum;
    }
    
    // Generic check for other wallets
    const ethereum = (window as any).ethereum;
    if (!ethereum) return false;
    
    // Check if it's an array of providers
    if (Array.isArray(ethereum.providers)) {
      return ethereum.providers.some((provider: any) => provider.isMetaMask || provider.isCoinbaseWallet);
    }
    
    return false;
  }

  private isMobile(): boolean {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  getAvailableWallets(): WalletOption[] {
    const mobile = this.isMobile();
    
    return this.walletOptions.map(wallet => ({
      ...wallet,
      detected: wallet.injected ? this.isInjectedWalletDetected(wallet.rdns || '') : false,
      recommended: mobile ? !wallet.injected : wallet.injected
    }));
  }

  async connectWallet(walletId: string): Promise<string | null> {
    console.log(`Web3Modal: Connecting to ${walletId}`);
    
    switch (walletId) {
      case 'metamask':
        return this.connectMetaMask();
      case 'coinbase':
        return this.connectCoinbaseWallet();
      case 'walletconnect':
        return this.connectWalletConnect();
      case 'trust':
        return this.connectTrustWallet();
      case 'phantom':
        return this.connectPhantom();
      default:
        throw new Error(`Wallet ${walletId} not supported`);
    }
  }

  private async connectMetaMask(): Promise<string | null> {
    const ethereum = (window as any).ethereum;
    if (!ethereum || !ethereum.isMetaMask) {
      if (this.isMobile()) {
        // Deep link to MetaMask app
        window.open(`https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`, '_blank');
        return null;
      } else {
        // Redirect to extension installation
        window.open('https://metamask.io/download/', '_blank');
        throw new Error('MetaMask not installed. Please install the extension.');
      }
    }

    try {
      // First try to request account access
      const accounts = await ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts && accounts.length > 0) {
        const connectedAddress = accounts[0];
        console.log(`Connected to metamask:`, connectedAddress);
        
        // Dispatch account change event to update wallet context
        if (ethereum.isMetaMask) {
          // Trigger the accountsChanged event manually to sync wallet context
          window.dispatchEvent(new CustomEvent('wallet-connected', {
            detail: { address: connectedAddress, wallet: 'metamask' }
          }));
        }
        
        return connectedAddress;
      }
      
      return null;
    } catch (error) {
      console.error('MetaMask connection error:', error);
      throw error;
    }
  }

  private async connectCoinbaseWallet(): Promise<string | null> {
    const ethereum = (window as any).ethereum;
    
    // Check for Coinbase Wallet
    const coinbaseProvider = ethereum?.providers?.find((p: any) => p.isCoinbaseWallet) || 
                           (ethereum?.isCoinbaseWallet ? ethereum : null);
    
    if (!coinbaseProvider) {
      if (this.isMobile()) {
        window.open('https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(window.location.href), '_blank');
        return null;
      } else {
        window.open('https://www.coinbase.com/wallet/downloads', '_blank');
        throw new Error('Coinbase Wallet not installed');
      }
    }

    try {
      const accounts = await coinbaseProvider.request({ method: 'eth_requestAccounts' });
      return accounts[0] || null;
    } catch (error) {
      console.error('Coinbase Wallet connection error:', error);
      throw error;
    }
  }

  private async connectWalletConnect(): Promise<string | null> {
    // For now, we'll use the existing WalletConnect service from the context
    console.log('WalletConnect: Using existing service');
    throw new Error('Use connectWithWalletConnect from wallet context');
  }

  private async connectTrustWallet(): Promise<string | null> {
    if (this.isMobile()) {
      const encodedUrl = encodeURIComponent(window.location.href);
      window.open(`https://link.trustwallet.com/open_url?coin_id=60&url=${encodedUrl}`, '_blank');
      return null;
    } else {
      // Desktop - use WalletConnect
      throw new Error('Use connectWithWalletConnect for Trust Wallet on desktop');
    }
  }

  private async connectPhantom(): Promise<string | null> {
    const phantom = (window as any).phantom?.ethereum;
    
    if (!phantom) {
      window.open('https://phantom.app/download', '_blank');
      throw new Error('Phantom not installed');
    }

    try {
      const accounts = await phantom.request({ method: 'eth_requestAccounts' });
      return accounts[0] || null;
    } catch (error) {
      console.error('Phantom connection error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const web3ModalService = new Web3ModalService();