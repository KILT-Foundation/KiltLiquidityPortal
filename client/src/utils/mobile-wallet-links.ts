// Mobile Wallet Deep Link Utilities
export interface WalletDeepLink {
  name: string;
  id: string;
  deepLink: (url: string) => string;
  installLink: string;
  icon: string;
  description: string;
  isAvailable: () => boolean;
}

export const MOBILE_WALLET_LINKS: WalletDeepLink[] = [
  {
    name: 'MetaMask',
    id: 'metaMask',
    deepLink: (url: string) => {
      const cleanUrl = url.replace(/^https?:\/\//, '');
      return `https://metamask.app.link/dapp/${cleanUrl}`;
    },
    installLink: 'https://metamask.io/download/',
    icon: '🦊',
    description: 'Most popular Ethereum wallet',
    isAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask
  },
  {
    name: 'Coinbase Wallet',
    id: 'coinbaseWallet',
    deepLink: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    installLink: 'https://wallet.coinbase.com/',
    icon: '🔵',
    description: 'Easy-to-use wallet by Coinbase',
    isAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet
  },
  {
    name: 'Trust Wallet',
    id: 'trust',
    deepLink: (url: string) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
    installLink: 'https://trustwallet.com/',
    icon: '🛡️',
    description: 'Secure multi-coin wallet',
    isAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isTrust
  },
  {
    name: 'Rainbow Wallet',
    id: 'rainbow',
    deepLink: (url: string) => `https://rnbwapp.com/deeplink?url=${encodeURIComponent(url)}`,
    installLink: 'https://rainbow.me/',
    icon: '🌈',
    description: 'Beautiful Ethereum wallet',
    isAvailable: () => typeof window !== 'undefined' && !!window.ethereum?.isRainbow
  },
  {
    name: 'WalletConnect',
    id: 'walletConnect',
    deepLink: (url: string) => `wc://`,
    installLink: 'https://walletconnect.com/',
    icon: '🔗',
    description: 'Connect 200+ wallets',
    isAvailable: () => true // Always available as it's a protocol
  }
];

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for mobile user agent
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check for touch capability and small screen
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobileUA || (hasTouchScreen && isSmallScreen);
}

export function openMobileWallet(walletId: string, currentUrl?: string): boolean {
  const url = currentUrl || window.location.href;
  const wallet = MOBILE_WALLET_LINKS.find(w => w.id === walletId);
  
  if (!wallet) {
    console.warn(`Wallet ${walletId} not found`);
    return false;
  }

  try {
    console.log(`Attempting to open wallet: ${wallet.name} with URL: ${url}`);
    
    if (isMobileDevice()) {
      // iOS specific handling
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (isIOS) {
        // For iOS, try the deep link and fallback to app store
        const deepLinkUrl = wallet.deepLink(url);
        console.log(`iOS deep link: ${deepLinkUrl}`);
        
        // Create invisible iframe to attempt deep link
        const iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.src = deepLinkUrl;
        document.body.appendChild(iframe);
        
        // Clean up iframe after attempt
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
        
        // Fallback after delay
        setTimeout(() => {
          if (document.hasFocus()) {
            window.open(wallet.installLink, '_blank');
          }
        }, 1500);
        
        return true;
      } else {
        // Android: try direct navigation
        const deepLinkUrl = wallet.deepLink(url);
        console.log(`Android deep link: ${deepLinkUrl}`);
        
        window.location.href = deepLinkUrl;
        
        // Fallback to install page
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            window.open(wallet.installLink, '_blank');
          }
        }, 2000);
        
        return true;
      }
    } else {
      // Desktop: open install page
      window.open(wallet.installLink, '_blank');
      return false;
    }
  } catch (error) {
    console.error(`Failed to open wallet ${walletId}:`, error);
    window.open(wallet.installLink, '_blank');
    return false;
  }
}

export function getAvailableWallets(): WalletDeepLink[] {
  return MOBILE_WALLET_LINKS.filter(wallet => wallet.isAvailable());
}

export function getRecommendedWallets(): WalletDeepLink[] {
  // Check which wallets are actually available first
  const available = getAvailableWallets();
  
  if (available.length > 0) {
    // Prioritize detected wallets but still include WalletConnect
    const walletConnect = MOBILE_WALLET_LINKS.find(w => w.id === 'walletConnect');
    const filtered = [walletConnect, ...available.filter(w => w.id !== 'walletConnect')];
    return filtered.filter(Boolean) as WalletDeepLink[];
  }
  
  // If no wallets detected, show popular ones plus WalletConnect
  const popular = ['walletConnect', 'metaMask', 'coinbaseWallet', 'trust', 'rainbow'];
  return MOBILE_WALLET_LINKS.filter(w => popular.includes(w.id));
}