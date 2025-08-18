import { kiltPriceService } from './kilt-price-service';

/**
 * Real-time Price Service - Get current token prices for accurate fee calculations
 */
export class PriceService {
  private static ethPriceCache: { price: number; timestamp: number } | null = null;
  private static kiltPriceCache: { price: number; timestamp: number } | null = null;
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get current ETH price in USD
   */
  static async getETHPrice(): Promise<number> {
    // Check cache first
    if (this.ethPriceCache && Date.now() - this.ethPriceCache.timestamp < this.CACHE_DURATION) {
      return this.ethPriceCache.price;
    }

    try {
      // Get ETH price from CoinGecko
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      const ethPrice = data.ethereum?.usd || 3800; // Fallback to 3800 if API fails

      // Cache the result
      this.ethPriceCache = {
        price: ethPrice,
        timestamp: Date.now()
      };

      return ethPrice;
    } catch (error) {
      console.error('❌ Failed to fetch ETH price:', error);
      return 3800; // Fallback price
    }
  }

  /**
   * Get current KILT price in USD
   */
  static async getKILTPrice(): Promise<number> {
    // Check cache first
    if (this.kiltPriceCache && Date.now() - this.kiltPriceCache.timestamp < this.CACHE_DURATION) {
      return this.kiltPriceCache.price;
    }

    try {
      // Get KILT price from our existing service
      const kiltPrice = kiltPriceService.getCurrentPrice() || 0.018; // Fallback to 0.018 if API fails

      // Cache the result
      this.kiltPriceCache = {
        price: kiltPrice,
        timestamp: Date.now()
      };

      return kiltPrice;
    } catch (error) {
      console.error('❌ Failed to fetch KILT price:', error);
      return 0.018; // Fallback price
    }
  }

  /**
   * Convert raw fee amounts to USD using real-time prices
   */
  static async convertFeesToUSD(token0Amount: string, token1Amount: string): Promise<{
    ethUSD: number;
    kiltUSD: number;
    totalUSD: number;
    ethPrice: number;
    kiltPrice: number;
  }> {
    // Get current prices
    const [ethPrice, kiltPrice] = await Promise.all([
      this.getETHPrice(),
      this.getKILTPrice()
    ]);

    // Convert raw amounts to readable amounts
    const ethAmount = parseFloat(token0Amount) / 1e18; // WETH has 18 decimals
    const kiltAmount = parseFloat(token1Amount) / 1e18; // KILT has 18 decimals

    // Calculate USD values
    const ethUSD = ethAmount * ethPrice;
    const kiltUSD = kiltAmount * kiltPrice;
    const totalUSD = ethUSD + kiltUSD;

    console.log(`💰 Fee conversion: ${ethAmount.toFixed(6)} WETH ($${ethUSD.toFixed(2)}) + ${kiltAmount.toFixed(2)} KILT ($${kiltUSD.toFixed(2)}) = $${totalUSD.toFixed(2)}`);

    return {
      ethUSD,
      kiltUSD,
      totalUSD,
      ethPrice,
      kiltPrice
    };
  }
}