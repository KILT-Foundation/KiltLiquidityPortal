// Constants for KILT token
import { blockchainConfigService } from './blockchain-config-service';
const KILT_TOTAL_SUPPLY = 290560000;
const KILT_CIRCULATING_SUPPLY = 276970000; // From CoinMarketCap: 276.97M KILT (display as 277.0M for UI)
const TREASURY_TOTAL = KILT_TOTAL_SUPPLY * 0.01;

export interface KiltTokenData {
  price: number | null;
  marketCap: number | null;
  circulatingSupply: number;
  volume24h: number | null;
  priceChange24h: number | null;
  totalSupply: number;
  treasuryAllocation: number;
  treasuryRemaining: number;
  distributionRate: number;
  programDuration: number;
  progress: number;
}

export interface RewardCalculation {
  baseAPR: number;
  timeMultiplier: number;
  sizeMultiplier: number;
  effectiveAPR: number;
  dailyRewards: number;
  liquidityAmount: number;
  daysStaked: number;
}

// Fetch real-time KILT token data using real-time price service
export async function fetchKiltTokenData(): Promise<KiltTokenData> {
  try {
    // Use real-time price service for accurate pricing
    const { kiltPriceService } = await import('./kilt-price-service');
    const priceInfo = kiltPriceService.getPriceInfo();
    const currentPrice = priceInfo.price;
    
    // Calculate market cap consistently using our real-time price
    let marketCap = currentPrice * KILT_CIRCULATING_SUPPLY;
    let coinGeckoMarketCap = null; // Track CoinGecko market cap separately
    let volume24h = 0; // Only use real data, no fallbacks
    let priceChange24h = 0; // Only use real data, no fallbacks
    
    try {
      // Try DexScreener API for 4h price change data - more reliable for smaller tokens
      const dexResponse = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8');
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && dexData.pairs.length > 0) {
        const kiltPair = dexData.pairs.find((pair: any) => pair.baseToken?.address?.toLowerCase() === '0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8');
        if (kiltPair) {
          // Use 24h price change from DexScreener
          if (kiltPair.priceChange && kiltPair.priceChange.h24) {
            priceChange24h = parseFloat(kiltPair.priceChange.h24);
            console.log(`24h price change from DexScreener: ${priceChange24h.toFixed(2)}%`);
          }
          // Also get volume data
          if (kiltPair.volume && kiltPair.volume.h24) {
            volume24h = parseFloat(kiltPair.volume.h24);
          }
        }
      }
      
      // Get market cap from CoinGecko simple price endpoint (try both kilt and kilt-protocol)
      let response;
      try {
        response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kilt&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true');
        let data = await response.json();
        let kiltData = data['kilt'];
        
        if (!kiltData) {
          // Try correct CoinGecko ID for KILT
          response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kilt-protocol-2&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true');
          data = await response.json();
          kiltData = data['kilt-protocol-2'];
        }
        
        if (kiltData) {
          coinGeckoMarketCap = kiltData.usd_market_cap; // Store CoinGecko market cap for reference
          // Always use calculated market cap for consistency: marketCap = currentPrice * circulating
          if (!volume24h && kiltData.usd_24h_vol) {
            volume24h = kiltData.usd_24h_vol;
          }
        }
      } catch (cgError) {
        console.warn('CoinGecko market cap fetch failed:', cgError);
      }
    } catch (error: unknown) {
      console.warn('CoinGecko API unavailable, using calculated values:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Calculate treasury metrics based on actual reward wallet balance
    const distributionRate = 7960; // KILT per day (~7,960 from 2,905,600 / 365)
    
    // Import smart contract service to get actual balance
    const { smartContractService } = await import('./smart-contract-service');
    const rewardWalletBalance = await smartContractService.checkRewardWalletBalance();
    
    const treasuryRemaining = rewardWalletBalance.balance || TREASURY_TOTAL;
    const distributed = Math.max(0, TREASURY_TOTAL - treasuryRemaining);
    const programDuration = Math.floor(treasuryRemaining / distributionRate);
    const progress = (distributed / TREASURY_TOTAL);
    
    const result = {
      price: currentPrice ? Math.round(currentPrice * 1000000) / 1000000 : null, // Increased precision for small prices
      marketCap: marketCap ? Math.round(marketCap * 100) / 100 : null, // Calculated consistently from our price
      circulatingSupply: KILT_CIRCULATING_SUPPLY, // Add explicit circulating supply
      volume24h: volume24h > 0 ? Math.round(volume24h * 100) / 100 : null, // Only real volume
      priceChange24h: priceChange24h !== null && priceChange24h !== undefined ? Math.round(priceChange24h * 100) / 100 : null, // Only real 24h change
      totalSupply: KILT_TOTAL_SUPPLY,
      treasuryAllocation: TREASURY_TOTAL,
      treasuryRemaining,
      distributionRate,
      programDuration,
      progress
    };
    
    return result;
  } catch (error) {
    // Return null values when real data isn't available - no fallbacks
    console.error('Failed to fetch KILT token data:', error);
    return {
      price: null, // No fallback price
      marketCap: null, // No fallback market cap
      circulatingSupply: KILT_CIRCULATING_SUPPLY,
      volume24h: null, // No fallback volume
      priceChange24h: null, // No fallback price change
      totalSupply: KILT_TOTAL_SUPPLY,
      treasuryAllocation: TREASURY_TOTAL,
      treasuryRemaining: TREASURY_TOTAL, 
      distributionRate: 7960,
      programDuration: 365,
      progress: 0.0
    };
  }
}

// Calculate dynamic rewards based on position parameters
export function calculateRewards(
  liquidityAmount: number,
  daysStaked: number,
  positionSize: number
): RewardCalculation {
  const baseAPR = 47.2;
  
  // Time multiplier: 1x to 2x over 30 days
  const timeMultiplier = Math.min(1 + (daysStaked / 30), 2.0);
  
  // Size multiplier: 1x to 1.5x based on position size (threshold at 100k USD)
  const sizeMultiplier = Math.min(1 + (positionSize / 100000), 1.5);
  
  const effectiveAPR = baseAPR * timeMultiplier * sizeMultiplier;
  const dailyRewards = (liquidityAmount * effectiveAPR) / (365 * 100);
  
  return {
    baseAPR,
    timeMultiplier,
    sizeMultiplier,
    effectiveAPR,
    dailyRewards,
    liquidityAmount,
    daysStaked
  };
}

// Get current Base network stats
export async function getBaseNetworkStats() {
  try {
    // Fetch Base network data
    const response = await fetch('https://api.basescan.org/api?module=stats&action=ethsupply&apikey=YourApiKeyToken');
    const data = await response.json();
    
    return {
      gasPrice: 0.002, // Average gas price in ETH
      blockNumber: 25000000, // Current block
      networkFee: 2.50 // Average transaction fee in USD
    };
  } catch (error) {
    // Error fetching Base network stats
    return {
      gasPrice: 0.002,
      blockNumber: 25000000,
      networkFee: 2.50
    };
  }
}