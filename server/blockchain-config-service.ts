import { db } from './db';
import { blockchainConfig, type BlockchainConfig, type InsertBlockchainConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class BlockchainConfigService {
  private static instance: BlockchainConfigService;
  private configCache: Map<string, string> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  static getInstance(): BlockchainConfigService {
    if (!BlockchainConfigService.instance) {
      BlockchainConfigService.instance = new BlockchainConfigService();
    }
    return BlockchainConfigService.instance;
  }

  // Initialize with default blockchain configuration
  async initializeDefaults(): Promise<void> {
    try {
      const defaults = [
        {
          configKey: 'KILT_TOKEN_ADDRESS',
          configValue: '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8',
          description: 'KILT Protocol token contract address on Base mainnet',
          category: 'token'
        },
        {
          configKey: 'KILT_ETH_POOL_ADDRESS', 
          configValue: '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E',
          description: 'KILT/ETH Uniswap V3 pool contract address on Base mainnet',
          category: 'pool'
        },
        {
          configKey: 'WETH_TOKEN_ADDRESS',
          configValue: '0x4200000000000000000000000000000000000006',
          description: 'Wrapped Ethereum token contract address on Base mainnet',
          category: 'token'
        },
        {
          configKey: 'BASE_NETWORK_CHAIN_ID',
          configValue: '8453',
          description: 'Base mainnet chain ID',
          category: 'network'
        },
        {
          configKey: 'UNISWAP_V3_FEE_TIER',
          configValue: '3000',
          description: 'Default Uniswap V3 fee tier (0.3%)',
          category: 'pool'
        }
      ];

      for (const config of defaults) {
        await this.upsertConfig(config);
      }
    } catch (error) {
      console.error('Failed to initialize blockchain config defaults:', error);
    }
  }

  // Get configuration value with caching
  async getConfig(key: string): Promise<string | null> {
    try {
      // Check cache first
      const now = Date.now();
      if (now - this.lastCacheUpdate < this.CACHE_DURATION && this.configCache.has(key)) {
        return this.configCache.get(key) || null;
      }

      // Query database
      const [config] = await db
        .select()
        .from(blockchainConfig)
        .where(eq(blockchainConfig.configKey, key));

      if (config) {
        this.configCache.set(key, config.configValue);
        return config.configValue;
      }

      return null;
    } catch (error) {
      console.error(`Failed to get config for key ${key}:`, error);
      return null;
    }
  }

  // Get all configurations
  async getAllConfigs(): Promise<BlockchainConfig[]> {
    try {
      return await db.select().from(blockchainConfig);
    } catch (error) {
      console.error('Failed to get all blockchain configs:', error);
      return [];
    }
  }

  // Update configuration
  async updateConfig(key: string, value: string): Promise<boolean> {
    try {
      const result = await db
        .update(blockchainConfig)
        .set({ 
          configValue: value, 
          updatedAt: new Date() 
        })
        .where(eq(blockchainConfig.configKey, key));

      // Update cache
      this.configCache.set(key, value);
      this.lastCacheUpdate = Date.now();

      return true;
    } catch (error) {
      console.error(`Failed to update config for key ${key}:`, error);
      return false;
    }
  }

  // Upsert configuration (update or insert)
  async upsertConfig(config: Omit<InsertBlockchainConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const existing = await this.getConfig(config.configKey);
      
      if (existing) {
        return await this.updateConfig(config.configKey, config.configValue);
      } else {
        await db.insert(blockchainConfig).values({
          ...config,
          isActive: config.isActive ?? true
        });
        
        // Update cache
        this.configCache.set(config.configKey, config.configValue);
        this.lastCacheUpdate = Date.now();
        
        return true;
      }
    } catch (error) {
      console.error('Failed to upsert blockchain config:', error);
      return false;
    }
  }

  // Convenience methods for common configurations
  async getKiltTokenAddress(): Promise<string> {
    const address = await this.getConfig('KILT_TOKEN_ADDRESS');
    return address || '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8'; // Fallback
  }

  async getKiltEthPoolAddress(): Promise<string> {
    const address = await this.getConfig('KILT_ETH_POOL_ADDRESS');
    return address || '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E'; // Fallback
  }

  async getWethTokenAddress(): Promise<string> {
    const address = await this.getConfig('WETH_TOKEN_ADDRESS');
    return address || '0x4200000000000000000000000000000000000006'; // Fallback
  }

  async getBaseChainId(): Promise<number> {
    const chainId = await this.getConfig('BASE_NETWORK_CHAIN_ID');
    return parseInt(chainId || '8453', 10);
  }

  async getUniswapV3FeeTier(): Promise<number> {
    const feeTier = await this.getConfig('UNISWAP_V3_FEE_TIER');
    return parseInt(feeTier || '3000', 10);
  }

  // Get pool address (CRITICAL METHOD MISSING - add it here)
  async getPoolAddress(): Promise<string> {
    const address = await this.getConfig('KILT_ETH_POOL_ADDRESS');
    return address || '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E'; // Fallback to known pool address
  }

  // Get token addresses (method that was missing and causing the error)
  async getTokenAddresses(): Promise<{
    kilt: string;
    weth: string;
  }> {
    const [kilt, weth] = await Promise.all([
      this.getKiltTokenAddress(),
      this.getWethTokenAddress()
    ]);
    
    return {
      kilt,
      weth
    };
  }

  // Clear cache (useful for testing or forced refresh)
  clearCache(): void {
    this.configCache.clear();
    this.lastCacheUpdate = 0;
  }
}

// Export singleton instance
export const blockchainConfigService = BlockchainConfigService.getInstance();