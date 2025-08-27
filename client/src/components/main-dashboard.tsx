import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, 
  Zap, 
  Coins, 
  Award,
  Wallet,
  Plus,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  BarChart3,
  TrendingUp as ChartIcon,
  ShoppingCart // Add this import
} from 'lucide-react';

// Lazy-loaded components for faster initial load
import { lazy, Suspense, useMemo } from 'react';

// Hooks and contexts
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { useKiltTokenData } from '@/hooks/use-kilt-data';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard';
// Removed use-optimized-queries - cleaned up during optimization
// Removed blazing fast hooks - cleaned up during optimization
import { useAppSession } from '@/hooks/use-app-session';
// Removed deprecated hooks - consolidated into unified dashboard
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

// Lightweight components
import { UserPersonalAPR } from './user-personal-apr';
import { MobileWalletConnect } from './mobile-wallet-connect';

// Removed gas estimation card - consolidated into main interface
import { PositionRegistration } from './position-registration';
import { LoadingScreen } from './loading-screen';

import { useWalletClient } from 'wagmi';

// Lazy load heavy components
const LiquidityMint = lazy(() => import('./liquidity-mint').then(m => ({ default: m.LiquidityMint })));
const RewardsTracking = lazy(() => import('./rewards-tracking').then(m => ({ default: m.RewardsTracking })));
const UserPositions = lazy(() => import('./user-positions').then(m => ({ default: m.UserPositions })));


// Removed tab loading spinner - using built-in loading states

// Optimized loading component for heavy tabs
const OptimizedLoadingFallback = ({ height = "400px" }) => (
  <div className="w-full flex items-center justify-center animate-pulse" style={{ height }}>
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div className="text-white/60 text-sm">Loading...</div>
    </div>
  </div>
);

// Assets and icons
import kiltLogo from '@assets/KILT_400x400_transparent_1751723574123.png';
import backgroundVideo from '@assets/Untitled design (22)_1752822331413.mp4';
import { SiX, SiGithub, SiDiscord, SiTelegram, SiMedium } from 'react-icons/si';

// Services
import { LiquidityService } from '@/services/liquidity-service';
import { useEthPrice } from '@/hooks/use-eth-price';

// Universal logo components
import { TokenLogo, KiltLogo, EthLogo } from '@/components/ui/token-logo';
import { CyberpunkKiltLogo } from './cyberpunk-kilt-logo';

// Viem utilities for token amount parsing
import { createWalletClient, custom, parseUnits } from 'viem';
import { BuyKilt } from './buy-kilt';
import { base } from 'viem/chains';

// Token contract addresses
const WETH_TOKEN = '0x4200000000000000000000000000000000000006'; // Base WETH
const KILT_TOKEN = '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8';



// STREAMLINED APR Components using single API endpoint
function StreamlinedAPRData() {
  const { data: aprData, isLoading, error } = useQuery<{
    programAPR: number;
    tradingAPR: number;
    totalAPR: number;
  }>({
    queryKey: ['/api/apr/streamlined'],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  return { aprData, isLoading, error };
}

function PoolWideProgramAPR() {
  const { aprData, isLoading, error } = StreamlinedAPRData();

  if (isLoading) return <span className="text-white/50">--</span>;
  if (error) return <span className="text-red-400">Error</span>;
  
  return (
    <span>
      {aprData?.programAPR ? `${aprData.programAPR}%` : '--'}
    </span>
  );
}

function TradingFeesAPR() {
  const { aprData, isLoading, error } = StreamlinedAPRData();

  if (isLoading) return <span className="text-white/50">--</span>;
  if (error) return <span className="text-red-400">Error</span>;
  
  return (
    <span>
      {aprData?.tradingAPR ? `${aprData.tradingAPR}%` : '--'}
    </span>
  );
}

function TotalAPR() {
  const { aprData, isLoading, error } = StreamlinedAPRData();

  if (isLoading) return <span className="text-white/50">--</span>;
  if (error) return <span className="text-red-400">Error</span>;
  
  return (
    <span>
      {aprData?.totalAPR ? `${aprData.totalAPR}%` : '--'}
    </span>
  );
}



export function MainDashboard() {
  const { address, isConnected, isConnecting } = useWagmiWallet();
  const { data: kiltData } = useKiltTokenData();
  const unifiedData = useUnifiedDashboard();
  const appSession = useAppSession();
  const { data: walletClient } = useWalletClient();
  // Uniswap V3 hooks for liquidity provision
  const { mintPosition, isMinting } = useUniswapV3();
  
  // Chart modal state
  const [showChartModal, setShowChartModal] = useState(false);
  const [showBuyKiltModal, setShowBuyKiltModal] = useState(false);
  
  // Removed responsive state - now using pure CSS media queries
  
  // Get optimized queries for real trading fees APR data
  // Removed optimized queries - using unified dashboard instead
  
  // Use balance data from unified dashboard hook
  const { 
    kiltBalance, 
    wethBalance, 
    ethBalance,
    formatTokenAmount
  } = unifiedData;
  

  const [activeTab, setActiveTab] = useState('overview');
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [logoAnimationComplete, setLogoAnimationComplete] = useState(false);
  const [isBaseNetworkConnected, setIsBaseNetworkConnected] = useState(false);
  const [selectedPercentage, setSelectedPercentage] = useState(80);

  const { toast } = useToast();

  // Navigation function for components to use
  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
  };

  // Expose navigation function globally for position registration component
  useEffect(() => {
    (window as unknown as { navigateToTab?: (tab: string) => void }).navigateToTab = navigateToTab;
    
    // Add event listener for modal redirect to Add Liquidity
    const handleNavigateToAddLiquidity = (event: CustomEvent) => {
      const { tab, prefilledAmounts } = event.detail;
      setActiveTab(tab);
      
      // Store prefilled amounts for the Add Liquidity interface
      if (prefilledAmounts) {
        sessionStorage.setItem('prefilledLiquidityAmounts', JSON.stringify(prefilledAmounts));
      }
    };
    
    window.addEventListener('navigateToAddLiquidity', handleNavigateToAddLiquidity as EventListener);
    
    return () => {
      delete (window as unknown as { navigateToTab?: (tab: string) => void }).navigateToTab;
      window.removeEventListener('navigateToAddLiquidity', handleNavigateToAddLiquidity as EventListener);
    };
  }, []);

  // Optimize effects - combine network check and animation
  useEffect(() => {
    // Logo animation timing
    const logoTimer = setTimeout(() => {
      setLogoAnimationComplete(true);
    }, 800);

    // Check Base network connection
    const checkBaseNetwork = async () => {
      const ethereum = (window as unknown as { ethereum?: { request: (params: { method: string }) => Promise<string> } }).ethereum;
      if (ethereum && isConnected) {
        try {
          const chainId = await ethereum.request({ method: 'eth_chainId' });
          const isBase = chainId === '0x2105';
          setIsBaseNetworkConnected(isBase);
        } catch (error: unknown) {
          setIsBaseNetworkConnected(false);
        }
      } else {
        setIsBaseNetworkConnected(false);
      }
    };

    checkBaseNetwork();
    
    // Listen for network changes
    const ethereum = (window as unknown as { ethereum?: { on: (event: string, handler: () => void) => void; removeListener: (event: string, handler: () => void) => void } }).ethereum;
    if (ethereum) {
      const handleChainChanged = () => checkBaseNetwork();
      ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        clearTimeout(logoTimer);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
    
    return () => clearTimeout(logoTimer);
  }, [isConnected]);

  // Helper function to convert wei to human-readable amounts
  const formatTokenBalance = (balance: string | bigint | undefined): string => {
    if (!balance) return '0';
    try {
      // Convert to string if it's a bigint or number
      let balanceStr: string;
      if (typeof balance === 'bigint') {
        balanceStr = balance.toString();
      } else if (typeof balance === 'number') {
        balanceStr = String(balance);
      } else {
        balanceStr = balance;
      }
      
      // Convert wei to ether (both KILT and WETH use 18 decimals)
      // Use BigInt division to avoid precision issues
      const balanceBigInt = BigInt(balanceStr);
      const divisor = BigInt(1e18);
      const wholePart = balanceBigInt / divisor;
      const fractionalPart = balanceBigInt % divisor;
      
      // Convert fractional part to decimal
      const fractionalStr = fractionalPart.toString().padStart(18, '0');
      const trimmedFractional = fractionalStr.slice(0, 4);
      
      return `${wholePart.toString()}.${trimmedFractional}`;
    } catch {
      return '0.0000';
    }
  };

  // Get real-time ETH price
  const { data: ethPriceData } = useEthPrice();

  // Calculate optimal amounts using universal LiquidityService
  const calculateOptimalAmounts = (percentage = selectedPercentage) => {
    return LiquidityService.calculateOptimalAmounts(
      kiltBalance,
      wethBalance,
      ethBalance,
      kiltData?.price || 0.0160,
      percentage,
      formatTokenBalance,
      ethPriceData?.ethPrice // Pass real-time ETH price
    );
  };

  // Quick Add Liquidity with actual token approval and position minting
  const handleQuickAddLiquidity = async () => {
    if (!address || isMinting || !walletClient) return;

    try {
      await walletClient.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base chain ID in hex
      });
    } catch (manualError) {
      console.error('network switch failed:', manualError);
    }
    
    try {
      console.log('🚀 Starting Quick Add Liquidity process...');
      
      const amounts = calculateOptimalAmounts();
      const hasInsufficientBalance = parseFloat(amounts.kiltAmount) <= 0 || parseFloat(amounts.ethAmount) <= 0 || parseFloat(amounts.totalValue) < 2;
      
      if (hasInsufficientBalance) {
        toast({
          title: "Insufficient Balance",
          description: "You need both KILT and ETH tokens to add liquidity",
          variant: "destructive"
        });
        return;
      }
      
      // Convert to BigInt values (18 decimals)
      const amount0Desired = parseUnits(amounts.ethAmount, 18); // WETH
      const amount1Desired = parseUnits(amounts.kiltAmount, 18); // KILT
      
      console.log('💰 Quick Add amounts:', {
        eth: amounts.ethAmount,
        kilt: amounts.kiltAmount,
        amount0Desired: amount0Desired.toString(),
        amount1Desired: amount1Desired.toString()
      });
      
      toast({
        title: "Creating Liquidity Position",
        description: "Processing transaction...",
      });
      
      // Create the position using mintPosition from useUniswapV3
      console.log('🏗️ Creating liquidity position...');
      const txHash = await mintPosition({
        token0: WETH_TOKEN as `0x${string}`,
        token1: KILT_TOKEN as `0x${string}`,
        fee: 3000, // 0.3%
        tickLower: -887220, // Full range
        tickUpper: 887220,  // Full range
        amount0Desired,
        amount1Desired,
        amount0Min: (amount0Desired * 95n) / 100n, // 5% slippage
        amount1Min: (amount1Desired * 95n) / 100n, // 5% slippage
        recipient: address as `0x${string}`,
        deadline: Math.floor(Date.now() / 1000) + 1200, // 20 minutes
        useNativeETH: true
      });
      
      console.log('✅ Position created! Hash:', txHash);
      
      toast({
        title: "Liquidity Added Successfully!",
        description: `Added ${amounts.ethAmount} ETH + ${amounts.kiltAmount} KILT to the pool`,
      });
      
      // Auto-register the new position immediately after successful creation
      console.log('🔄 Auto-registering new position in reward program...');
      
      // Wait briefly for transaction finalization, then register
      setTimeout(async () => {
        try {
          // Invalidate caches to get fresh data
          await queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
          
          // Trigger bulk registration for all eligible positions
          const response = await fetch('/api/positions/register/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Auto-registration completed:', result);
            
            if (result.registeredCount > 0) {
              toast({
                title: "Position Registered!",
                description: `${result.registeredCount} position${result.registeredCount > 1 ? 's' : ''} enrolled in rewards`,
              });
            }
            
            // Refresh all relevant data
            queryClient.invalidateQueries({ queryKey: ['/api/rewards'] });
            queryClient.invalidateQueries({ queryKey: ['/api/positions'] });
          } else {
            console.log('⚠️ Auto-registration failed - user can register manually');
          }
        } catch (autoRegError) {
          console.log('⚠️ Auto-registration error:', autoRegError);
        }
      }, 2000); // Wait 2 seconds for blockchain confirmation
      
      // Switch to positions tab to show the new position
      setActiveTab('positions');
      
    } catch (error: any) {
      console.error('Quick Add Liquidity error:', error);
      
      let errorMessage = "Failed to add liquidity";
      if (error.message?.includes('insufficient funds')) {
        errorMessage = "Insufficient token balance";
      } else if (error.message?.includes('user rejected')) {
        errorMessage = "Transaction rejected";
      } else if (error.message?.includes('slippage')) {
        errorMessage = "Price changed too much during transaction";
      }
      
      toast({
        title: "Quick Add Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Connecting wallet...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen p-6 relative overflow-hidden">
        {/* Background Video */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 1 }}
            onLoadStart={() => console.log('Landing page video loading started')}
            onCanPlay={() => console.log('Landing page video can play')}
            onError={(e) => console.error('Landing page video error:', e)}
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        </div>
        
        {/* Overlay for content readability */}
        <div className="absolute inset-0 bg-black/20" style={{ zIndex: 2 }}></div>
        


        <div className="max-w-5xl mx-auto relative" style={{ zIndex: 10 }}>
          <div className="text-center pt-16 pb-8">
            {/* Hero Section */}
            <div className="mb-12">
              <div className="relative w-32 h-32 mx-auto mb-8">
                {/* Cyberpunk KILT Logo */}
                <CyberpunkKiltLogo size="xl" className="w-full h-full" />
              </div>
              
              {/* Modern Typography - Clean & Professional */}
              <div className="mb-8">
                {/* Main title with subtle gradient */}
                <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight tracking-tight">
                  <span className="block bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">
                    KILT Liquidity
                  </span>
                  <span className="block text-5xl sm:text-6xl lg:text-7xl mt-2 text-white/90 font-normal">
                    Incentive Program
                  </span>
                </h1>
              </div>
              
              {/* Clean Description */}
              <div className="relative max-w-4xl mx-auto mb-8">
                <p className="text-xl sm:text-2xl text-white/90 font-medium leading-relaxed text-center">
                  Earn <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">{unifiedData.programAnalytics?.programAPR ? `${Math.round(unifiedData.programAnalytics.programAPR)}%` : '...'} APR</span> from the <span className="text-pink-400 font-bold bg-pink-400/10 px-2 py-1 rounded">{unifiedData.programAnalytics?.treasuryTotal ? (unifiedData.programAnalytics.treasuryTotal >= 1000000 ? `${(unifiedData.programAnalytics.treasuryTotal / 1000000).toFixed(1)}M` : `${(unifiedData.programAnalytics.treasuryTotal / 1000).toFixed(0)}K`) : '...'} KILT treasury</span> by providing liquidity to Uniswap V3 pools on Base network.
                </p>
              </div>
            </div>

            {/* Connection Section */}
            <div className="mb-16 flex flex-col items-center">
              <div className="mb-4">
                <MobileWalletConnect />
              </div>
            </div>

            {/* Clean Feature Grid */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* KILT/ETH Pool */}
              <div className="group relative animate-fade-in animate-delay-100">
                <div className="relative bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:border-emerald-500/30 hover:bg-black/60 h-[180px] flex flex-col">
                  <div className="flex items-center mb-4">
                    <TrendingUp className="h-6 w-6 text-emerald-400 mr-3" />
                    <h3 className="text-white font-bold text-lg">KILT/ETH Pool</h3>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Deploy capital efficiently with concentrated liquidity positions and advanced range strategies.
                    </p>
                  </div>
                </div>
              </div>

              {/* Treasury Rewards */}
              <div className="group relative animate-fade-in animate-delay-200">
                <div className="relative bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:border-pink-500/30 hover:bg-black/60 h-[180px] flex flex-col">
                  <div className="flex items-center mb-4">
                    <Award className="h-6 w-6 text-pink-400 mr-3" />
                    <h3 className="text-white font-bold text-lg">Treasury Rewards</h3>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Receive attractive rewards from <span className="text-pink-400 font-semibold">{unifiedData?.programAnalytics?.treasuryTotal ? (unifiedData.programAnalytics.treasuryTotal >= 1000000 ? `${(unifiedData.programAnalytics.treasuryTotal / 1000000).toFixed(1)}M KILT` : `${(unifiedData.programAnalytics.treasuryTotal / 1000).toFixed(0)}K KILT`) : '500K KILT'}</span> treasury allocation with secure smart contract distribution.
                    </p>
                  </div>
                </div>
              </div>

              {/* Program Analytics */}
              <div className="group relative animate-fade-in animate-delay-300">
                <div className="relative bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:border-blue-500/30 hover:bg-black/60 h-[180px] flex flex-col">
                  <div className="flex items-center mb-4">
                    <BarChart3 className="h-6 w-6 text-blue-400 mr-3" />
                    <h3 className="text-white font-bold text-lg">Program Analytics</h3>
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      Track your position performance, rewards earned, and program progress with detailed analytics.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Join the KILT Ecosystem
              </h2>
              <p className="text-white/80 text-lg font-medium max-w-2xl mx-auto mb-6 leading-relaxed">
                Connect with the KILT Protocol community and stay updated on the latest developments.
              </p>
            </div>

            {/* Clean Social Media Links */}
            <div className="flex justify-center items-center gap-3">
              <a 
                href="https://x.com/kiltprotocol" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-black/40 hover:bg-[#ff0066]/10 border border-gray-800 hover:border-[#ff0066]/30 rounded-lg transition-all duration-300 backdrop-blur-sm"
              >
                <SiX className="h-5 w-5 text-white/80 hover:text-[#ff0066] transition-colors duration-300" />
              </a>
              <a 
                href="https://github.com/KILTprotocol" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-black/40 hover:bg-[#ff0066]/10 border border-gray-800 hover:border-[#ff0066]/30 rounded-lg transition-all duration-300 backdrop-blur-sm"
              >
                <SiGithub className="h-5 w-5 text-white/80 hover:text-[#ff0066] transition-colors duration-300" />
              </a>
              <a 
                href="https://discord.gg/kiltprotocol" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-black/40 hover:bg-[#ff0066]/10 border border-gray-800 hover:border-[#ff0066]/30 rounded-lg transition-all duration-300 backdrop-blur-sm"
              >
                <SiDiscord className="h-5 w-5 text-white/80 hover:text-[#ff0066] transition-colors duration-300" />
              </a>
              <a 
                href="https://t.me/KILTProtocolChat" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-black/40 hover:bg-[#ff0066]/10 border border-gray-800 hover:border-[#ff0066]/30 rounded-lg transition-all duration-300 backdrop-blur-sm"
              >
                <SiTelegram className="h-5 w-5 text-white/80 hover:text-[#ff0066] transition-colors duration-300" />
              </a>
              <a 
                href="https://kilt-protocol.medium.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-black/40 hover:bg-[#ff0066]/10 border border-gray-800 hover:border-[#ff0066]/30 rounded-lg transition-all duration-300 backdrop-blur-sm"
              >
                <SiMedium className="h-5 w-5 text-white/80 hover:text-[#ff0066] transition-colors duration-300" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden relative">
      {/* Background Video - Testing higher z-index */}
      <video 
        autoPlay 
        muted 
        loop 
        playsInline
        preload="auto"
        className="fixed top-0 left-0 w-full h-full object-cover"
        style={{ zIndex: 1 }}
        onLoadStart={() => console.log('Video loading started')}
        onCanPlay={() => console.log('Video can play')}
        onError={(e) => console.error('Video error:', e)}
      >
        <source src={backgroundVideo} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* Transparent overlay for content readability */}
      <div className="absolute inset-0 bg-black/30" style={{ zIndex: 2 }}></div>
      <div className="max-w-7xl mx-auto px-4 relative" style={{ zIndex: 10 }}>
        {/* Clean Professional Header */}
        <div className="w-full mb-8 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Logo and Title Section - aligned with tabs/cards */}
          <div className="flex items-center gap-6 flex-1">
            <div className="relative w-8 h-8 flex items-center justify-center ml-1">
              <CyberpunkKiltLogo size="sm" className="w-full h-full" />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                KILT Liquidity Portal
              </h1>
            </div>
          </div>
          
          {/* Wallet Connection Section */}
          <div className="flex-shrink-0 self-start sm:self-center">
            <MobileWalletConnect />
          </div>
        </div>

        {/* Enhanced Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          // Invalidate positions cache when switching to positions tab
          if (value === 'positions') {
            queryClient.invalidateQueries({ queryKey: ['wallet-positions'] });
            if (address) {
              queryClient.invalidateQueries({ queryKey: ['/api/positions/wallet', address] });
            }
          }
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-black/40 backdrop-blur-xl border border-white/10 p-1 rounded-2xl mb-6 sm:mb-8 h-10 sm:h-12 gap-1 shadow-2xl">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70 hover:text-white/90 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center min-w-0 hover:bg-white/5 group"
            >
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0 transition-colors duration-300 group-data-[state=active]:text-white group-hover:text-[#ff0066]" />
              <span className="text-xs sm:text-sm font-medium">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="liquidity" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70 hover:text-white/90 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center min-w-0 hover:bg-white/5 group"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0 transition-colors duration-300 group-data-[state=active]:text-white group-hover:text-[#ff0066]" />
              <span className="text-xs sm:text-sm font-medium">
                <span className="sm:hidden">Add</span>
                <span className="hidden sm:inline">Add Liquidity</span>
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="rewards" 
              className="mobile-tab-trigger data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70 hover:text-white/90 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center min-w-0 hover:bg-white/5 group"
            >
              <Award className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0 transition-colors duration-300 group-data-[state=active]:text-white group-hover:text-[#ff0066]" />
              <span className="text-xs sm:text-sm font-medium">Rewards</span>
            </TabsTrigger>
            <TabsTrigger 
              value="positions" 
              className="mobile-tab-trigger data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70 hover:text-white/90 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center min-w-0 hover:bg-white/5 group"
            >
              <Wallet className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0 transition-colors duration-300 group-data-[state=active]:text-white group-hover:text-[#ff0066]" />
              <span className="text-xs sm:text-sm font-medium">
                <span className="sm:hidden">Positions</span>
                <span className="hidden sm:inline">Positions</span>
              </span>
            </TabsTrigger>
            <button
              onClick={() => {
                const uniswapUrl = `https://app.uniswap.org/swap?outputCurrency=0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8&chain=base&inputCurrency=ETH`;
                window.open(uniswapUrl, '_blank');
              }}
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-white/15 data-[state=active]:to-white/10 data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70 hover:text-white/90 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-center min-w-0 hover:bg-white/5 group cursor-pointer"
            >
              <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0 transition-colors duration-300 group-hover:text-[#ff0066]" />
              <span className="text-xs sm:text-sm font-medium">
                <span className="sm:hidden">Buy</span>
                <span className="hidden sm:inline">Buy KILT</span>
              </span>
            </button>

          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 tab-content-safe">
            {/* Metrics Cards - Single Row */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
              {/* KILT Price Card */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff0066]/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-[#ff0066]/30"></div>
                <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-[#ff0066]/30 group-hover:shadow-lg group-hover:shadow-[#ff0066]/10 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#ff0066]/20 to-[#ff0066]/10 border border-[#ff0066]/30 flex items-center justify-center flex-shrink-0">
                        <img src={kiltLogo} alt="KILT" className="w-3 h-3" />
                      </div>
                      <span className="text-white/70 text-xs font-medium">KILT Price</span>
                    </div>
                    <button
                      onClick={() => setShowChartModal(true)}
                      className="w-5 h-5 rounded-md bg-[#ff0066]/10 border border-[#ff0066]/30 flex items-center justify-center hover:bg-[#ff0066]/20 transition-all duration-200 group flex-shrink-0"
                      title="View KILT/WETH Chart"
                    >
                      <BarChart3 className="h-3 w-3 text-[#ff0066] group-hover:text-white" />
                    </button>
                  </div>
                  <div className="text-white text-base font-bold mb-1 numeric-large">
                    {kiltData?.price ? `$${kiltData.price.toFixed(4)}` : (
                      <div className="h-5 w-16 bg-slate-700 animate-pulse rounded"></div>
                    )}
                  </div>
                  <div className={`text-xs font-medium numeric-mono ${
                    (kiltData?.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {kiltData?.priceChange24h !== null && kiltData?.priceChange24h !== undefined ? 
                      `${kiltData.priceChange24h >= 0 ? '+' : ''}${kiltData.priceChange24h.toFixed(2)}% (24h)` : 
                      <div className="h-3 w-12 bg-slate-700 animate-pulse rounded"></div>
                    }
                  </div>
                </div>
              </div>

              {/* Market Cap Card */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-green-400/30"></div>
                <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-green-400/30 group-hover:shadow-lg group-hover:shadow-green-400/10 flex flex-col justify-between">
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-green-400/20 to-green-400/10 border border-green-400/30 flex items-center justify-center flex-shrink-0">
                      <Coins className="h-3 w-3 text-green-400" />
                    </div>
                    <span className="text-white/70 text-xs font-medium">Market Cap</span>
                  </div>
                  <div className="text-white text-base font-bold mb-1 numeric-large">
                    {kiltData?.marketCap ? `$${(kiltData.marketCap / 1000000).toFixed(1)}M` : (
                      <div className="h-5 w-12 bg-slate-700 animate-pulse rounded"></div>
                    )}
                  </div>
                  <div className="text-white/50 text-xs font-medium">
                    277.0M circulating
                  </div>
                </div>
              </div>

              {/* Trading Fees APR Card - Using Real Data */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-emerald-400/30"></div>
                <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-emerald-400/30 group-hover:shadow-lg group-hover:shadow-emerald-400/10 flex flex-col justify-between">
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-400/20 to-emerald-400/10 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                    </div>
                    <span className="text-white/70 text-xs font-medium">Trading Fees APR</span>
                  </div>
                  <div className="text-white text-base font-bold mb-1 numeric-large">
                    <TradingFeesAPR />
                  </div>
                  <div className="text-white/50 text-xs font-medium">
                    DexScreener API
                  </div>
                </div>
              </div>

              {/* Program APR Card */}
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent rounded-xl blur-xl transition-all duration-300 group-hover:from-green-500/30"></div>
                <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-28 transition-all duration-300 group-hover:border-green-500/30 group-hover:shadow-lg group-hover:shadow-green-500/10 flex flex-col justify-between">
                  <div className="flex items-center gap-1 mb-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                      <Award className="h-3 w-3 text-green-500" />
                    </div>
                    <span className="text-white/70 text-xs font-medium">Program APR</span>
                  </div>
                  <div className="text-white text-base font-bold mb-1 numeric-large">
                    <PoolWideProgramAPR />
                  </div>
                  <div className="text-white/50 text-xs font-medium">
                    Treasury rewards
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout - Mobile Stack, Desktop Side-by-Side */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6">
              {/* Left Column - Position Registration */}
              <div className="space-y-4 order-2 lg:order-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <Plus className="h-4 w-4" style={{ color: '#ff0066' }} />
                  <span>Register Positions</span>
                </h2>
                <div className="min-h-[300px] sm:min-h-[350px] lg:h-[520px] flex flex-col">
                  <PositionRegistration />
                </div>
              </div>

              {/* Right Column - Quick Add Liquidity */}
              <div className="space-y-4 order-1 lg:order-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4" style={{ color: '#ff0066' }} />
                  <span>Quick Add Liquidity</span>
                </h2>
                <Card className="mobile-card-fix bg-black/40 backdrop-blur-sm border border-gray-800 rounded-lg flex flex-col cluely-card">
                  <CardContent className="mobile-card-content p-3 sm:p-4 flex flex-col gap-4">
                    <div className="space-y-3">
                      {/* Balance Display */}
                      <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-lg p-2 sm:p-3 cluely-card">
                        <h4 className="text-white font-bold text-sm sm:text-base mb-2 sm:mb-3">Wallet Balance</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {/* KILT Balance Card */}
                          <div className="mobile-balance-card bg-black/20 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/10">
                            {/* Logo and Token Name - Horizontal */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="mobile-balance-icon flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'rgba(255, 0, 102, 0.3)', borderColor: 'rgba(255, 0, 102, 0.5)' }}>
                                <img 
                                  src={kiltLogo} 
                                  alt="KILT" 
                                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4"
                                  style={{ 
                                    filter: 'brightness(1.5) contrast(1.2) drop-shadow(0 0 3px rgba(255,255,255,0.3))'
                                  }}
                                />
                              </div>
                              <div className="mobile-balance-label text-white text-xs font-medium">KILT</div>
                            </div>
                            {/* Balance Value */}
                            <div 
                              className="mobile-balance-value text-[#ff0066] font-bold text-xs sm:text-sm numeric-display" 
                              style={{ textShadow: '0 0 10px rgba(255, 0, 102, 0.4)' }}
                              title={kiltBalance ? `Exact balance: ${parseFloat(kiltBalance).toFixed(4)} KILT` : 'No KILT balance'}
                            >
                              {kiltBalance 
                                ? parseFloat(kiltBalance).toFixed(4)
                                : '0.0000'}
                            </div>
                          </div>
                          
                          {/* ETH Balance Card */}
                          <div className="mobile-balance-card bg-black/20 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/10">
                            {/* Logo and Token Name - Horizontal */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="mobile-balance-icon flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'rgba(255, 0, 102, 0.3)', borderColor: 'rgba(255, 0, 102, 0.5)' }}>
                                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'brightness(1.5) contrast(1.2) drop-shadow(0 0 3px rgba(255,255,255,0.3))' }}>
                                  <path d="M127.961 0L125.44 8.55656V285.168L127.961 287.688L255.922 212.32L127.961 0Z" fill="#8A92B2"/>
                                  <path d="M127.962 0L0 212.32L127.962 287.688V153.864V0Z" fill="#62688F"/>
                                  <path d="M127.961 312.187L126.385 314.154V415.484L127.961 417L255.922 237.832L127.961 312.187Z" fill="#8A92B2"/>
                                  <path d="M127.962 417V312.187L0 237.832L127.962 417Z" fill="#62688F"/>
                                  <path d="M127.961 287.688L255.922 212.32L127.961 153.864V287.688Z" fill="#454A75"/>
                                  <path d="M0 212.32L127.962 287.688V153.864L0 212.32Z" fill="#8A92B2"/>
                                </svg>
                              </div>
                              <div className="mobile-balance-label text-white text-xs font-medium">ETH</div>
                            </div>
                            {/* Balance Value */}
                            <div 
                              className="mobile-balance-value text-[#ff0066] font-bold text-xs sm:text-sm numeric-display" 
                              style={{ textShadow: '0 0 10px rgba(255, 0, 102, 0.4)' }}
                              title={ethBalance ? `Exact balance: ${parseFloat(ethBalance).toFixed(8)} ETH` : 'No ETH balance'}
                            >
                              {ethBalance ? (
                                parseFloat(ethBalance) >= 1 
                                  ? parseFloat(ethBalance).toFixed(2)
                                  : parseFloat(ethBalance).toFixed(6)
                              ) : '0.000000'}
                            </div>
                          </div>
                          
                          {/* WETH Balance Card */}
                          <div className="mobile-balance-card bg-black/20 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/10">
                            {/* Logo and Token Name - Horizontal */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="mobile-balance-icon flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center border" style={{ backgroundColor: 'rgba(255, 0, 102, 0.3)', borderColor: 'rgba(255, 0, 102, 0.5)' }}>
                                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'brightness(1.5) contrast(1.2) drop-shadow(0 0 3px rgba(255,255,255,0.3))' }}>
                                  <path d="M127.961 0L125.44 8.55656V285.168L127.961 287.688L255.922 212.32L127.961 0Z" fill="#8A92B2"/>
                                  <path d="M127.962 0L0 212.32L127.962 287.688V153.864V0Z" fill="#62688F"/>
                                  <path d="M127.961 312.187L126.385 314.154V415.484L127.961 417L255.922 237.832L127.961 312.187Z" fill="#8A92B2"/>
                                  <path d="M127.962 417V312.187L0 237.832L127.962 417Z" fill="#62688F"/>
                                  <path d="M127.961 287.688L255.922 212.32L127.961 153.864V287.688Z" fill="#454A75"/>
                                  <path d="M0 212.32L127.962 287.688V153.864L0 212.32Z" fill="#8A92B2"/>
                                </svg>
                              </div>
                              <div className="mobile-balance-label text-white text-xs font-medium">WETH</div>
                            </div>
                            {/* Balance Value */}
                            <div 
                              className="mobile-balance-value text-[#ff0066] font-bold text-xs sm:text-sm numeric-display" 
                              style={{ textShadow: '0 0 10px rgba(255, 0, 102, 0.4)' }}
                              title={wethBalance ? `Exact balance: ${parseFloat(wethBalance).toFixed(8)} WETH` : 'No WETH balance'}
                            >
                              {wethBalance ? (
                                parseFloat(wethBalance) >= 1 
                                  ? parseFloat(wethBalance).toFixed(2)
                                  : parseFloat(wethBalance).toFixed(6)
                              ) : '0.000000'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Percentage Selector */}
                      <div className="bg-black/40 backdrop-blur-sm border border-gray-800 rounded-lg p-3 cluely-card">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white text-sm font-medium">Balance Usage</span>
                          <span className="text-sm text-white/80 numeric-mono">{selectedPercentage}% of wallet</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-3">
                          {LiquidityService.getPercentageOptions().map(({ value, label }) => (
                            <Button
                              key={value}
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPercentage(value)}
                              className={`mobile-button-small text-xs py-1 px-1 h-6 sm:h-7 transition-all duration-200 border ${
                                selectedPercentage === value 
                                  ? 'text-black font-bold border-2' 
                                  : 'border text-white/80 hover:bg-[#ff0066]/10 hover:border-[#ff0066]/50 hover:text-white'
                              }`}
                              style={selectedPercentage === value ? { 
                                backgroundColor: '#ff0066', 
                                borderColor: '#ff0066',
                                color: 'white'
                              } : { 
                                borderColor: 'rgba(255, 255, 255, 0.2)' 
                              }}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        
                        {/* Seek Bar Slider */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-xs">Precise Control</span>
                            <span className="text-white/80 text-xs">{selectedPercentage}%</span>
                          </div>
                          <Slider
                            value={[selectedPercentage]}
                            onValueChange={(value) => setSelectedPercentage(value[0])}
                            max={100}
                            min={0}
                            step={1}
                            className="mobile-slider-fix w-full"
                          />
                        </div>
                      </div>

                      {/* Optimal Amount */}
                      <div className="theme-card p-3 cluely-card">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white text-sm font-medium text-label">Liquidity Amount</span>
                          <span className="text-sm text-white/80 text-body">Balanced strategy</span>
                        </div>
                        {(() => {
                          const amounts = calculateOptimalAmounts();
                          const hasInsufficientBalance = parseFloat(amounts.kiltAmount) <= 0 || parseFloat(amounts.ethAmount) <= 0 || parseFloat(amounts.totalValue) < 2;
                          
                          if (hasInsufficientBalance) {
                            return (
                              <div className="text-center py-2">
                                <div className="text-sm font-medium text-red-400 mb-1 text-label">Insufficient Balance</div>
                                <p className="text-white/60 text-xs text-body">Fund wallet to continue</p>
                              </div>
                            );
                          }
                          
                          return (
                            <div>
                              <div className="text-2xl font-bold text-[#ff0066] text-numbers mb-2" style={{ textShadow: '0 0 20px rgba(255, 0, 102, 0.6)' }}>
                                ~${amounts.totalValue}
                              </div>
                              <div className="flex items-center justify-center space-x-4 text-white text-sm text-body">
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-gradient-to-br from-[#ff0066]/30 to-[#ff0066]/30 rounded-full flex items-center justify-center border border-[#ff0066]/50">
                                    <KiltLogo size="sm" showBackground={false} />
                                  </div>
                                  <span className="font-medium text-[#ff0066]">{amounts.kiltAmount} KILT</span>
                                </div>
                                <span className="text-[#ff0066] text-lg">+</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-gradient-to-br from-[#ff0066]/30 to-[#ff0066]/30 rounded-full flex items-center justify-center border border-[#ff0066]/50">
                                    <EthLogo size="sm" showBackground={false} />
                                  </div>
                                  <span className="font-medium text-[#ff0066]">{amounts.ethAmount} {amounts.useNativeEth ? 'ETH' : 'WETH'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    
                    {/* Action Button - Always at bottom */}
                    <div className="mt-auto pt-2">
                      {/* Action Button */}
                      {(() => {
                        const amounts = calculateOptimalAmounts();
                        const hasInsufficientBalance = parseFloat(amounts.kiltAmount) <= 0 || parseFloat(amounts.ethAmount) <= 0 || parseFloat(amounts.totalValue) < 2;
                        const isDisabled = isMinting || !address || hasInsufficientBalance;
                        
                        return (
                          <Button 
                            onClick={handleQuickAddLiquidity}
                            disabled={isDisabled}
                            className={`mobile-button-fix w-full font-semibold py-1.5 h-8 sm:h-9 rounded-lg transition-all duration-300 text-sm ${
                              hasInsufficientBalance 
                                ? 'theme-badge-danger cursor-not-allowed' 
                                : 'theme-button-primary'
                            }`}
                          >
                            {isMinting ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                Processing...
                              </>
                            ) : hasInsufficientBalance ? (
                              <>
                                <Wallet className="h-3 w-3 mr-1.5" />
                                Fund Wallet
                              </>
                            ) : (
                              <>
                                <Zap className="h-3 w-3 mr-1.5" />
                                Quick Add Liquidity
                                <ArrowRight className="h-3 w-3 ml-1.5" />
                              </>
                            )}
                          </Button>
                        );
                      })()}

                      
                      
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>


          </TabsContent>

          {/* Add Liquidity Tab */}
          <TabsContent value="liquidity">
            <Suspense fallback={<OptimizedLoadingFallback height="600px" />}>
              <LiquidityMint 
                kiltBalance={kiltBalance}
                wethBalance={wethBalance}
                ethBalance={ethBalance}
                formatTokenAmount={formatTokenAmount}
              />
            </Suspense>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards">
            <Suspense fallback={<OptimizedLoadingFallback height="500px" />}>
              <RewardsTracking />
            </Suspense>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions">
            <Suspense fallback={<OptimizedLoadingFallback height="400px" />}>
              <UserPositions />
            </Suspense>
          </TabsContent>
          
          {/* Buy KILT Tab */}


        </Tabs>
      </div>

      {/* KILT/WETH Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 backdrop-blur-xl border border-[#ff0066]/30 rounded-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff0066]/20 to-[#ff0066]/10 border border-[#ff0066]/30 flex items-center justify-center">
                  <img src={kiltLogo} alt="KILT" className="w-5 h-5" />
                </div>
                <h2 className="text-white text-lg font-bold">KILT/WETH Price Chart</h2>
                <Badge className="bg-[#ff0066]/10 text-[#ff0066] border-[#ff0066]/30">
                  Live Data
                </Badge>
              </div>
              <button
                onClick={() => setShowChartModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 group"
              >
                <svg className="w-4 h-4 text-white/70 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Chart Content */}
            <div className="flex-1 p-4">
              <div className="w-full h-full rounded-xl overflow-hidden bg-white/5 border border-white/10">
                <iframe
                  src="https://www.geckoterminal.com/base/pools/0x82da478b1382b951cbad01beb9ed459cdb16458e?embed=1&info=0&swaps=0"
                  className="w-full h-full border-0"
                  title="KILT/WETH Price Chart"
                  allowFullScreen
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="text-white/50 text-sm">
                  Data provided by GeckoTerminal
                </div>
                <button
                  onClick={() => window.open('https://www.geckoterminal.com/base/pools/0x82da478b1382b951cbad01beb9ed459cdb16458e?utm_source=coingecko&utm_medium=referral&utm_campaign=livechart', '_blank')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#ff0066]/10 hover:bg-[#ff0066]/20 border border-[#ff0066]/30 rounded-lg text-[#ff0066] text-sm transition-all duration-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Full Chart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buy KILT Modal */}
      {showBuyKiltModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 backdrop-blur-xl border border-pink-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-pink-400" />
                <h2 className="text-white text-lg font-bold">Buy KILT</h2>
                <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30">
                  Direct Swap
                </Badge>
              </div>
              <button
                onClick={() => setShowBuyKiltModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200 group"
              >
                <svg className="w-4 h-4 text-white/70 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Buy KILT Component */}
            <div className="p-4">
              <BuyKilt 
                kiltBalance={formatTokenAmount(kiltBalance || '0')}
                ethBalance={formatTokenAmount(ethBalance || '0')}
                wethBalance={formatTokenAmount(wethBalance || '0')}
                formatTokenAmount={formatTokenAmount}
                onPurchaseComplete={() => {
                  // Refresh token balances after purchase and close modal
                  queryClient.invalidateQueries({ queryKey: ['/api/positions/wallet', address] });
                  setShowBuyKiltModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}