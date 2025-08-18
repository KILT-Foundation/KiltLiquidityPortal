import kiltLogo from '@assets/KILT_400x400_transparent_1751723574123.png';

interface TokenLogoProps {
  token: 'KILT' | 'ETH' | 'WETH';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBackground?: boolean;
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4', 
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8'
};

// Ethereum logo component with proper contrast
const EthereumLogo = ({ className = "" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M127.961 0L125.44 8.55656V285.168L127.961 287.688L255.922 212.32L127.961 0Z" fill="#8A92B2"/>
    <path d="M127.962 0L0 212.32L127.962 287.688V153.864V0Z" fill="#62688F"/>
    <path d="M127.961 312.187L126.385 314.154V415.484L127.961 417L255.922 237.832L127.961 312.187Z" fill="#8A92B2"/>
    <path d="M127.962 417V312.187L0 237.832L127.962 417Z" fill="#62688F"/>
    <path d="M127.961 287.688L255.922 212.32L127.961 153.864V287.688Z" fill="#454A75"/>
    <path d="M0 212.32L127.962 287.688V153.864L0 212.32Z" fill="#8A92B2"/>
  </svg>
);

export function TokenLogo({ token, size = 'md', className = '', showBackground = false }: TokenLogoProps) {
  const sizeClass = sizeClasses[size];
  
  const containerClass = `
    ${sizeClass} 
    ${showBackground ? 'bg-white/15 backdrop-blur-sm rounded-full p-1 border border-white/50' : ''}
    ${className}
  `;

  const logoClass = `
    ${showBackground ? 'w-full h-full' : sizeClass}
    object-contain
  `;

  if (token === 'KILT') {
    return (
      <div className={containerClass}>
        <img 
          src={kiltLogo} 
          alt="KILT" 
          className={logoClass}
          style={{ 
            filter: 'brightness(1.3) contrast(1.1) drop-shadow(0 1px 3px rgba(0,0,0,0.8)) drop-shadow(0 0 8px rgba(255,255,255,0.3))'
          }}
        />
      </div>
    );
  }

  if (token === 'ETH' || token === 'WETH') {
    return (
      <div className={containerClass}>
        <EthereumLogo 
          className={logoClass}
        />
      </div>
    );
  }

  return null;
}

// Convenience components for common use cases
export const KiltLogo = ({ size = 'md', className = '', showBackground = false }: Omit<TokenLogoProps, 'token'>) => (
  <TokenLogo token="KILT" size={size} className={className} showBackground={showBackground} />
);

export const EthLogo = ({ size = 'md', className = '', showBackground = false }: Omit<TokenLogoProps, 'token'>) => (
  <TokenLogo token="ETH" size={size} className={className} showBackground={showBackground} />
);

export const WethLogo = ({ size = 'md', className = '', showBackground = false }: Omit<TokenLogoProps, 'token'>) => (
  <TokenLogo token="WETH" size={size} className={className} showBackground={showBackground} />
);