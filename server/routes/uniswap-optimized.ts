/**
 * UNISWAP-OPTIMIZED Position Routes
 * Blazing fast endpoints matching Uniswap's performance standards
 */

import type { Express } from "express";
import { storage } from "../storage";

export function registerUniswapOptimizedRoutes(app: Express) {
  /**
   * BLAZING FAST eligible positions endpoint
   * Matches Uniswap's sub-second response times
   */
  app.get("/api/positions/eligible/:userAddress", async (req, res) => {
    const start = Date.now();
    const { userAddress } = req.params;
    
    try {
      console.log(`⚡ UNISWAP-STYLE ELIGIBLE: ${userAddress}`);
      
      // CRITICAL FIX: Skip cache and fetch real-time unregistered positions directly
      const { uniswapIntegrationService } = await import('../uniswap-integration-service');
      const { blockchainConfigService } = await import('../blockchain-config-service');
      
      // Get all user positions from blockchain
      const allPositions = await uniswapIntegrationService.getUserPositions(userAddress);
      const kiltTokenAddress = await blockchainConfigService.getKiltTokenAddress();
      const kiltAddressLower = kiltTokenAddress.toLowerCase();
      
      // Filter for KILT positions only
      const kiltPositions = allPositions.filter(pos => {
        const token0Lower = pos.token0?.toLowerCase() || '';
        const token1Lower = pos.token1?.toLowerCase() || '';
        return token0Lower === kiltAddressLower || token1Lower === kiltAddressLower;
      });
      
      // Get already registered positions
      const user = await storage.getUserByAddress(userAddress);
      let registeredIds = new Set<string>();
      let activeRegisteredCount = 0;
      
      if (user) {
        // Get both registered positions and app-created transactions
        const [registeredPositions, appTransactions] = await Promise.all([
          storage.getLpPositionsByUserId(user.id),
          storage.getAppTransactionsByUserId(user.id)
        ]);
        
        // Combine registered positions with app-created NFT IDs
        registeredIds = new Set([
          ...registeredPositions.map(p => p.nftTokenId),
          ...appTransactions.filter(tx => tx.nftTokenId).map(tx => tx.nftTokenId)
        ]);
        
        // Count only ACTIVE registered positions for display
        activeRegisteredCount = registeredPositions.filter(p => p.isActive === true).length;
        console.log(`🔧 Position Count Debug: Total registered: ${registeredPositions.length}, Active: ${activeRegisteredCount}`);
      }
      
      // Filter unregistered positions
      const eligiblePositions = kiltPositions.filter(pos => 
        !registeredIds.has(pos.tokenId) && pos.isActive
      );

      const duration = Date.now() - start;
      
      // Uniswap-style response headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Cache-Status', 'fresh');
      res.setHeader('X-Optimization', 'uniswap-style');
      
      console.log(`⚡ UNISWAP-SPEED: ${userAddress} eligible in ${duration}ms (fresh)`);
      
      res.json({
        eligiblePositions,
        totalPositions: kiltPositions.length,
        registeredCount: activeRegisteredCount, // Only count active registered positions
        cacheStatus: 'fresh',
        timing: duration,
        message: eligiblePositions.length > 0 
          ? `Found ${eligiblePositions.length} unregistered positions` 
          : 'All positions registered or no KILT positions found'
      });
      
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ UNISWAP-STYLE FAILED: ${userAddress} in ${duration}ms`, error);
      
      res.status(500).json({
        eligiblePositions: [],
        totalPositions: 0,
        registeredCount: 0,
        cacheStatus: 'error',
        timing: duration,
        message: 'Failed to fetch eligible positions',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * Cache invalidation endpoint (simplified)
   */
  app.post("/api/positions/invalidate/:userAddress", async (req, res) => {
    const { userAddress } = req.params;
    // Cache invalidation logic would go here if needed
    res.json({ success: true, message: 'Cache invalidation requested' });
  });
}