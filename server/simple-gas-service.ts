// Simple real-time Base network gas estimation service
interface GasEstimate {
  approve: { gasLimit: string; gasPrice: string; cost: string; costUSD: string };
  mint: { gasLimit: string; gasPrice: string; cost: string; costUSD: string };
  total: { gasLimit: string; gasPrice: string; cost: string; costUSD: string };
}

interface BaseRPCGasResponse {
  result: string;
}

class SimpleGasService {
  private cachedGasPrice: string | null = null;
  private lastUpdate = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly BASE_RPC_URL = 'https://mainnet.base.org';

  async getCurrentGasPrice(): Promise<string> {
    const now = Date.now();
    
    // Force fresh data for testing (remove cache check temporarily)
    // if (this.cachedGasPrice && (now - this.lastUpdate) < this.CACHE_DURATION) {
    //   return this.cachedGasPrice;
    // }

    try {
      // Fetch real-time gas price from Base RPC
      const response = await fetch(this.BASE_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1
        })
      });

      const data: BaseRPCGasResponse = await response.json();
      
      console.log('Base RPC response:', JSON.stringify(data));
      
      if (data.result) {
        // Convert hex to decimal (Wei)
        const gasPriceWei = parseInt(data.result, 16);
        console.log('Gas price in Wei:', gasPriceWei);
        
        // Base network typically has very low gas prices, but not zero
        // Use realistic Base network gas pricing
        let finalGasPriceGwei;
        
        if (gasPriceWei === 0 || gasPriceWei < 100000) {
          // Base typically has 0.001-0.01 Gwei gas prices (extremely cheap L2)
          finalGasPriceGwei = 0.01; // Use 0.01 Gwei as realistic Base gas price
          console.log(`Base RPC returned ${gasPriceWei} Wei - using realistic Base fallback: ${finalGasPriceGwei} Gwei`);
        } else {
          // Use actual fetched price if reasonable
          finalGasPriceGwei = gasPriceWei / 1e9;
          console.log(`Using actual Base gas price: ${finalGasPriceGwei.toFixed(6)} Gwei`);
        }
        
        const finalGasPriceWei = finalGasPriceGwei * 1e9;
        const gasPriceETH = finalGasPriceWei / 1e18;
        
        this.cachedGasPrice = gasPriceETH.toFixed(12);
        this.lastUpdate = now;
        
        console.log(`Final Base gas price: ${finalGasPriceGwei} Gwei (${this.cachedGasPrice} ETH per gas)`);
        return this.cachedGasPrice;
      }
      
      throw new Error('Invalid RPC response');
    } catch (error) {
      console.error('Failed to fetch Base gas price:', error);
      
      // Use intelligent fallback based on Base network characteristics
      // Base typically has very low gas prices (much lower than mainnet)
      const fallbackGasPrice = '0.000000001'; // 1 gwei in ETH
      
      if (!this.cachedGasPrice) {
        this.cachedGasPrice = fallbackGasPrice;
        console.warn('PRODUCTION ALERT: Using hardcoded Base gas price. RPC connection failed.');
      }
      
      return this.cachedGasPrice;
    }
  }

  async getETHPrice(): Promise<number> {
    try {
      // Get real-time ETH price from CoinGecko
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum?.usd || 3500; // Fallback to reasonable ETH price
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
      return 3500; // Conservative fallback
    }
  }

  async estimateTransactionCosts(): Promise<GasEstimate> {
    try {
      const [gasPrice, ethPrice] = await Promise.all([
        this.getCurrentGasPrice(),
        this.getETHPrice()
      ]);

      const gasPriceFloat = parseFloat(gasPrice);

      // Realistic gas limits for Base network operations
      const approveGasLimit = 50000;  // Standard ERC20 approve
      const mintGasLimit = 200000;    // Uniswap V3 NFT position mint
      const totalGasLimit = approveGasLimit + mintGasLimit;

      // Calculate costs in ETH
      const approveCostETH = (approveGasLimit * gasPriceFloat);
      const mintCostETH = (mintGasLimit * gasPriceFloat);
      const totalCostETH = (totalGasLimit * gasPriceFloat);

      // Calculate costs in USD
      const approveCostUSD = approveCostETH * ethPrice;
      const mintCostUSD = mintCostETH * ethPrice;
      const totalCostUSD = totalCostETH * ethPrice;

      return {
        approve: {
          gasLimit: approveGasLimit.toString(),
          gasPrice: gasPrice,
          cost: approveCostETH.toFixed(8),
          costUSD: `$${approveCostUSD.toFixed(2)}`
        },
        mint: {
          gasLimit: mintGasLimit.toString(),
          gasPrice: gasPrice,
          cost: mintCostETH.toFixed(8),
          costUSD: `$${mintCostUSD.toFixed(2)}`
        },
        total: {
          gasLimit: totalGasLimit.toString(),
          gasPrice: gasPrice,
          cost: totalCostETH.toFixed(8),
          costUSD: `$${totalCostUSD.toFixed(2)}`
        }
      };
    } catch (error) {
      console.error('Gas estimation calculation error:', error);
      throw error;
    }
  }
}

export const simpleGasService = new SimpleGasService();