/**
 * RPC Fallback Service - Handle Cloudflare Rate Limiting
 * Implements multiple Base network RPC endpoints for reliability
 */

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export class RPCFallbackService {
  private static rpcEndpoints = [
    'https://mainnet.base.org',
    'https://base.gateway.tenderly.co',
    'https://base.drpc.org',
    'https://base-rpc.publicnode.com',
    'https://1rpc.io/base',
    'https://base.meowrpc.com'
  ];

  private static currentEndpointIndex = 0;
  private static rateLimitedEndpoints = new Set<string>();

  /**
   * Get next available RPC endpoint
   */
  static getNextRPC(): string {
    const availableEndpoints = this.rpcEndpoints.filter(
      endpoint => !this.rateLimitedEndpoints.has(endpoint)
    );

    if (availableEndpoints.length === 0) {
      // Reset rate limited endpoints after 5 minutes
      console.log('🔄 All RPC endpoints rate limited, resetting...');
      this.rateLimitedEndpoints.clear();
      this.currentEndpointIndex = 0;
      return this.rpcEndpoints[0];
    }

    const endpoint = availableEndpoints[this.currentEndpointIndex % availableEndpoints.length];
    this.currentEndpointIndex++;
    
    return endpoint;
  }

  /**
   * Mark endpoint as rate limited
   */
  static markRateLimited(endpoint: string): void {
    console.log(`⚠️ Marking ${endpoint} as rate limited`);
    this.rateLimitedEndpoints.add(endpoint);
    
    // Auto-remove after 5 minutes
    setTimeout(() => {
      this.rateLimitedEndpoints.delete(endpoint);
      console.log(`✅ Restored ${endpoint} after rate limit timeout`);
    }, 5 * 60 * 1000);
  }

  /**
   * Create resilient public client with automatic failover
   */
  static createResilientClient() {
    const rpcUrl = this.getNextRPC();
    
    return createPublicClient({
      chain: base,
      transport: http(rpcUrl, {
        timeout: 30000, // 30 second timeout
        retryCount: 3,
        retryDelay: 1000
      })
    });
  }

  /**
   * Execute blockchain call with automatic RPC switching
   */
  static async executeWithFallback<T>(
    operation: (client: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const client = this.createResilientClient();
        const result = await operation(client);
        
        if (attempt > 0) {
          console.log(`✅ RPC recovery successful on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check for Cloudflare rate limiting
        if (error.message?.includes('1015') || 
            error.message?.includes('rate limit') ||
            error.message?.includes('banned')) {
          
          const currentRPC = this.rpcEndpoints[this.currentEndpointIndex - 1];
          this.markRateLimited(currentRPC);
          
          console.log(`🔄 RPC attempt ${attempt + 1} failed (rate limited), trying next endpoint...`);
          continue;
        }
        
        // For other errors, still try next endpoint
        console.log(`⚠️ RPC attempt ${attempt + 1} failed:`, error.message);
        
        if (attempt === maxRetries - 1) {
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    
    throw new Error(`All RPC endpoints failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Get current RPC status
   */
  static getStatus() {
    return {
      totalEndpoints: this.rpcEndpoints.length,
      rateLimitedCount: this.rateLimitedEndpoints.size,
      availableEndpoints: this.rpcEndpoints.filter(ep => !this.rateLimitedEndpoints.has(ep)),
      currentIndex: this.currentEndpointIndex,
      rateLimitedEndpoints: Array.from(this.rateLimitedEndpoints)
    };
  }
}