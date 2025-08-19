import { createPublicClient, http, PublicClient } from 'viem';
import { base } from 'viem/chains';

interface RpcEndpoint {
  url: string;
  priority: number;
  lastError?: Date;
  errorCount: number;
  rateLimited: boolean;
  rateLimitResetTime?: Date;
}

class RpcConnectionManager {
  private endpoints: RpcEndpoint[] = [
    { url: 'https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA', priority: 1, errorCount: 0, rateLimited: false },
    { url: 'https://mainnet.base.org', priority: 2, errorCount: 0, rateLimited: false },
    { url: 'https://base.drpc.org', priority: 3, errorCount: 0, rateLimited: false },
    { url: 'https://base-mainnet.g.alchemy.com/v2/demo', priority: 4, errorCount: 0, rateLimited: false },
    { url: 'https://1rpc.io/base', priority: 5, errorCount: 0, rateLimited: false },
    { url: 'https://base.blockpi.network/v1/rpc/public', priority: 6, errorCount: 0, rateLimited: false }
  ];
  
  private clients: Map<string, PublicClient> = new Map();
  private currentEndpointIndex = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second base delay
  private rateLimitCooldown = 60000; // 1 minute cooldown for rate limited endpoints

  constructor() {
    this.initializeClients();
    // Reset rate limits periodically
    setInterval(() => this.resetRateLimits(), this.rateLimitCooldown);
  }

  private initializeClients() {
    this.endpoints.forEach(endpoint => {
      const client = createPublicClient({
        chain: base,
        transport: http(endpoint.url, {
          timeout: 15000, // 15 second timeout
          retryCount: 0, // We handle retries manually
          batch: false // Disable batching to avoid complexity
        })
      }) as any; 
      
      this.clients.set(endpoint.url, client);
    });
  }

  private resetRateLimits() {
    const now = new Date();
    this.endpoints.forEach(endpoint => {
      if (endpoint.rateLimited && endpoint.rateLimitResetTime && now > endpoint.rateLimitResetTime) {
        console.log(`🔄 Resetting rate limit for ${endpoint.url}`);
        endpoint.rateLimited = false;
        endpoint.errorCount = Math.max(0, endpoint.errorCount - 1);
        delete endpoint.rateLimitResetTime;
      }
    });
  }

  private getAvailableEndpoints(): RpcEndpoint[] {
    const now = new Date();
    return this.endpoints
      .filter(endpoint => {
        // Skip rate limited endpoints that haven't reset yet
        if (endpoint.rateLimited) {
          if (!endpoint.rateLimitResetTime || now < endpoint.rateLimitResetTime) {
            return false;
          }
        }
        // Skip endpoints with too many recent errors
        return endpoint.errorCount < 5;
      })
      .sort((a, b) => {
        // Sort by priority, then by error count
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.errorCount - b.errorCount;
      });
  }

  private markEndpointError(url: string, isRateLimit: boolean = false) {
    const endpoint = this.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.lastError = new Date();
      endpoint.errorCount++;
      
      if (isRateLimit) {
        endpoint.rateLimited = true;
        endpoint.rateLimitResetTime = new Date(Date.now() + this.rateLimitCooldown);
        console.log(`⚠️ Rate limit detected for ${url}, cooldown until ${endpoint.rateLimitResetTime.toISOString()}`);
      }
    }
  }

  private markEndpointSuccess(url: string) {
    const endpoint = this.endpoints.find(e => e.url === url);
    if (endpoint) {
      endpoint.errorCount = Math.max(0, endpoint.errorCount - 1);
      endpoint.rateLimited = false;
      delete endpoint.rateLimitResetTime;
    }
  }

  async getClient(): Promise<{ client: PublicClient; url: string }> {
    const availableEndpoints = this.getAvailableEndpoints();
    
    if (availableEndpoints.length === 0) {
      // If no endpoints available, reset all and try the primary one
      console.log('🚨 No RPC endpoints available, resetting all error counts');
      this.endpoints.forEach(endpoint => {
        endpoint.errorCount = 0;
        endpoint.rateLimited = false;
        delete endpoint.rateLimitResetTime;
      });
      const primaryEndpoint = this.endpoints[0];
      const client = this.clients.get(primaryEndpoint.url);
      if (!client) throw new Error('No RPC client available');
      return { client, url: primaryEndpoint.url };
    }

    const selectedEndpoint = availableEndpoints[0];
    const client = this.clients.get(selectedEndpoint.url);
    
    if (!client) {
      throw new Error(`No client found for endpoint ${selectedEndpoint.url}`);
    }

    return { client, url: selectedEndpoint.url };
  }

  async executeWithRetry<T>(
    operation: (client: PublicClient) => Promise<T>,
    operationName: string = 'RPC operation'
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const { client, url } = await this.getClient();
        console.log(`🔄 ${operationName} attempt ${attempt}/${this.maxRetries} using ${url}`);
        
        const result = await operation(client);
        
        // Mark success
        this.markEndpointSuccess(url);
        console.log(`✅ ${operationName} successful on attempt ${attempt} with ${url}`);
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        // Check if it's a rate limit error
        const isRateLimit = errorMessage.includes('429') || 
                           errorMessage.includes('Too many request') || 
                           errorMessage.includes('rate limit');
        
        // Check if it's a timeout
        const isTimeout = errorMessage.includes('timeout') || 
                         errorMessage.includes('timed out');
        
        console.log(`⚠️ ${operationName} attempt ${attempt} failed: ${errorMessage}`);
        
        if (isRateLimit || isTimeout) {
          // Mark the current endpoint as problematic
          const { url } = await this.getClient().catch(() => ({ url: 'unknown' }));
          this.markEndpointError(url, isRateLimit);
        }
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  getStatus() {
    return {
      endpoints: this.endpoints.map(endpoint => ({
        url: endpoint.url,
        priority: endpoint.priority,
        errorCount: endpoint.errorCount,
        rateLimited: endpoint.rateLimited,
        rateLimitResetTime: endpoint.rateLimitResetTime?.toISOString(),
        lastError: endpoint.lastError?.toISOString()
      })),
      availableEndpoints: this.getAvailableEndpoints().length,
      totalEndpoints: this.endpoints.length
    };
  }
}

// Singleton instance
export const rpcManager = new RpcConnectionManager();