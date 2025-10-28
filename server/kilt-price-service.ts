/**
 * KILT Price Service - Real-time price fetching with background updates
 * Fetches KILT price from CoinGecko API every 30 seconds for accurate calculations
 */

class KiltPriceService {
  private static instance: KiltPriceService;
  private currentPrice: number = 0.01757; // Current price from CoinGecko for migrated token
  private lastSuccessfulPrice: number = 0.01757; // Last known good price
  private lastUpdate: number = 0;
  private fetchInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 10000; // 10 seconds for real-time updates
  private readonly INITIAL_FALLBACK_PRICE = 0.01757; // Updated price from CoinGecko
  private readonly MAX_PRICE_CHANGE_THRESHOLD = 0.5; // 50% max change per update (circuit breaker)

  private constructor() {
    this.loadPersistedPrice();
    this.startBackgroundFetching();
  }

  /**
   * Load last persisted price from environment or database
   */
  private loadPersistedPrice(): void {
    // In a production environment, this could load from database or Redis
    // For now, we'll just use the initial fallback
    // Load persisted price from storage
  }

  /**
   * Persist current price for server restarts
   */
  private async persistPrice(price: number): Promise<void> {
    // In production, this would save to database or Redis
    // For now, we just store in memory
    this.lastSuccessfulPrice = price;
    // Price persisted successfully
  }

  static getInstance(): KiltPriceService {
    if (!KiltPriceService.instance) {
      KiltPriceService.instance = new KiltPriceService();
    }
    return KiltPriceService.instance;
  }

  /**
   * Start background fetching of KILT price every 30 seconds
   */
  private startBackgroundFetching(): void {
    // Fetch immediately on startup
    this.fetchKiltPrice();
    
    // Set up recurring fetch every 30 seconds
    this.fetchInterval = setInterval(() => {
      this.fetchKiltPrice();
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Fetch KILT price from CoinGecko API with intelligent fallback
   */
  private async fetchKiltPrice(): Promise<void> {
    try {
      // Use GeckoTerminal API for real-time DEX pricing - more accurate for Base network
      const geckoTerminalUrl = 'https://api.geckoterminal.com/api/v2/simple/networks/base/token_price/0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8';
      
      let newPrice = 0;
      
      // Try GeckoTerminal first (real-time DEX data)
      try {
        const response = await fetch(geckoTerminalUrl);
        const data = await response.json();
        
        if (data && data.data && data.data.attributes && data.data.attributes.token_prices) {
          const tokenPrices = data.data.attributes.token_prices;
          const kiltAddress = '0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8';
          if (tokenPrices[kiltAddress]) {
            newPrice = parseFloat(tokenPrices[kiltAddress]);
          }
        }
      } catch (error: unknown) {
        console.warn('GeckoTerminal API failed:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      // Fallback to CoinGecko if GeckoTerminal fails
      if (newPrice === 0) {
        try {
          const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=kilt-protocol&vs_currencies=usd');
          const data = await response.json();
          
          if (data && data['kilt-protocol'] && data['kilt-protocol'].usd) {
            newPrice = data['kilt-protocol'].usd;
          }
        } catch (error: unknown) {
          console.warn('CoinGecko fallback failed:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      if (newPrice > 0) {
        // Circuit breaker: Detect unrealistic price changes
        if (this.lastSuccessfulPrice > 0) {
          const priceChange = Math.abs(newPrice - this.lastSuccessfulPrice) / this.lastSuccessfulPrice;
          
          if (priceChange > this.MAX_PRICE_CHANGE_THRESHOLD) {
            // Price change too large, using last successful price
            this.currentPrice = this.lastSuccessfulPrice;
            return;
          }
        }
        
        // Valid price update
        this.currentPrice = newPrice;
        this.lastUpdate = Date.now();
        await this.persistPrice(newPrice);
        // KILT price updated successfully
      } else {
        // Invalid price data, using fallback
        this.currentPrice = this.getIntelligentFallbackPrice();
      }
    } catch (error: unknown) {
      console.warn('All price APIs failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      this.currentPrice = this.getIntelligentFallbackPrice();
    }
  }

  /**
   * Get intelligent fallback price - production-safe implementation
   */
  private getIntelligentFallbackPrice(): number {
    // Always use last successful price from CoinGecko, only use initial fallback if never fetched successfully
    if (this.lastSuccessfulPrice > 0) {
      console.warn('Using last successful KILT price:', this.lastSuccessfulPrice);
      return this.lastSuccessfulPrice;
    }
    
    // For production: Log this critical issue since we shouldn't rely on hardcoded prices
    console.error('PRODUCTION ALERT: Using hardcoded KILT price fallback. External APIs are failing.');
    return this.INITIAL_FALLBACK_PRICE;
  }

  /**
   * Get current KILT price (always returns cached value for performance)
   */
  getCurrentPrice(): number {
    return this.currentPrice;
  }

  /**
   * Get price info with metadata
   */
  getPriceInfo(): {
    price: number;
    lastUpdate: number;
    timeSinceUpdate: number;
    isStale: boolean;
    lastSuccessfulPrice: number;
    priceSource: 'live' | 'last-fetched' | 'circuit-breaker';
  } {
    const now = Date.now();
    const timeSinceUpdate = now - this.lastUpdate;
    const isStale = timeSinceUpdate > this.UPDATE_INTERVAL * 2; // Stale if more than 1 minute old
    
    let priceSource: 'live' | 'last-fetched' | 'circuit-breaker' = 'live';
    if (this.lastUpdate > 0 && this.currentPrice === this.lastSuccessfulPrice) {
      priceSource = 'live';
    } else if (this.lastUpdate === 0 && this.currentPrice === this.lastSuccessfulPrice) {
      priceSource = 'last-fetched';
    } else if (this.currentPrice === this.lastSuccessfulPrice) {
      priceSource = 'circuit-breaker';
    }

    return {
      price: this.currentPrice,
      lastUpdate: this.lastUpdate,
      timeSinceUpdate,
      isStale,
      lastSuccessfulPrice: this.lastSuccessfulPrice,
      priceSource
    };
  }

  /**
   * Force immediate price update (for testing or manual refresh)
   */
  async forceUpdate(): Promise<number> {
    await this.fetchKiltPrice();
    return this.currentPrice;
  }

  /**
   * Stop background fetching (for cleanup)
   */
  stopBackgroundFetching(): void {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.fetchInterval = null;
    }
  }
}

export const kiltPriceService = KiltPriceService.getInstance();