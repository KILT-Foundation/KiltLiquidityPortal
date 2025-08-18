// Script to analyze real LP positions in KILT/ETH Uniswap V3 pool
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const KILT_ETH_POOL = '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E';
const UNISWAP_V3_POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BF5d56b2B3b2f7C5BB2f4f'; // Base network

// Uniswap V3 Pool ABI (minimal)
const POOL_ABI = [
  {
    "inputs": [],
    "name": "liquidity",
    "outputs": [{"internalType": "uint128", "name": "", "type": "uint128"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      {"internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"},
      {"internalType": "int24", "name": "tick", "type": "int24"},
      {"internalType": "uint16", "name": "observationIndex", "type": "uint16"},
      {"internalType": "uint16", "name": "observationCardinality", "type": "uint16"},
      {"internalType": "uint16", "name": "observationCardinalityNext", "type": "uint16"},
      {"internalType": "uint8", "name": "feeProtocol", "type": "uint8"},
      {"internalType": "bool", "name": "unlocked", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Position Manager ABI (minimal)
const POSITION_MANAGER_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "positions",
    "outputs": [
      {"internalType": "uint96", "name": "nonce", "type": "uint96"},
      {"internalType": "address", "name": "operator", "type": "address"},
      {"internalType": "address", "name": "token0", "type": "address"},
      {"internalType": "address", "name": "token1", "type": "address"},
      {"internalType": "uint24", "name": "fee", "type": "uint24"},
      {"internalType": "int24", "name": "tickLower", "type": "int24"},
      {"internalType": "int24", "name": "tickUpper", "type": "int24"},
      {"internalType": "uint128", "name": "liquidity", "type": "uint128"},
      {"internalType": "uint256", "name": "feeGrowthInside0LastX128", "type": "uint256"},
      {"internalType": "uint256", "name": "feeGrowthInside1LastX128", "type": "uint256"},
      {"internalType": "uint128", "name": "tokensOwed0", "type": "uint128"},
      {"internalType": "uint128", "name": "tokensOwed1", "type": "uint128"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function analyzeRealLPs() {
  try {
    console.log('🔍 Analyzing real LP positions in KILT/ETH pool...');
    console.log(`Pool Address: ${KILT_ETH_POOL}`);

    const client = createPublicClient({
      chain: base,
      transport: http('https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA')
    });

    // Get pool info
    console.log('\n📊 Getting pool information...');
    const [poolLiquidity, slot0] = await Promise.all([
      client.readContract({
        address: KILT_ETH_POOL,
        abi: POOL_ABI,
        functionName: 'liquidity'
      }),
      client.readContract({
        address: KILT_ETH_POOL,
        abi: POOL_ABI,
        functionName: 'slot0'
      })
    ]);

    console.log(`Total Pool Liquidity: ${poolLiquidity.toString()}`);
    console.log(`Current Tick: ${slot0[1]}`);
    console.log(`Current Price (sqrtPriceX96): ${slot0[0].toString()}`);

    // Try to get some NFT positions (we'll check a range of token IDs)
    console.log('\n🔍 Scanning for active NFT positions...');
    const activePositions = [];
    const uniqueOwners = new Set();
    
    // Check known token IDs from our app + wider range
    const knownTokenIds = [3573708, 3591292, 3583999, 3583979, 3573740]; // From our app
    const startTokenId = 3570000; // Wider range 
    const endTokenId = 3600000;
    
    // First check known positions from our app
    console.log('🎯 Checking known positions from our app...');
    for (const tokenId of knownTokenIds) {
      try {
        const result = await checkSinglePosition(client, tokenId);
        if (result) {
          activePositions.push(result.position);
          uniqueOwners.add(result.owner);
          console.log(`✅ Found active position ${tokenId}: ${result.owner}`);
        }
      } catch (error) {
        console.log(`❌ Position ${tokenId} not found or inactive`);
      }
    }

    // Now scan for other positions in smaller batches
    console.log('\n🔍 Scanning for additional positions...');
    const checkPromises = [];
    for (let tokenId = startTokenId; tokenId < endTokenId; tokenId += 100) { // Check every 100th for speed
      checkPromises.push(checkPositionBatch(client, tokenId, Math.min(tokenId + 99, endTokenId)));
      if (checkPromises.length >= 5) { // Smaller batches to avoid timeout
        const batchResults = await Promise.allSettled(checkPromises);
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            activePositions.push(...result.value.positions);
            result.value.owners.forEach(owner => uniqueOwners.add(owner));
          }
        }
        checkPromises.length = 0;
        console.log(`Checked up to token ID ${tokenId}, found ${activePositions.length} active positions...`);
      }
    }

    // Process remaining batch
    if (checkPromises.length > 0) {
      const batchResults = await Promise.allSettled(checkPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          activePositions.push(...result.value.positions);
          result.value.owners.forEach(owner => uniqueOwners.add(owner));
        }
      }
    }

    console.log('\n📈 REAL LP ANALYSIS RESULTS:');
    console.log(`Active Positions Found: ${activePositions.length}`);
    console.log(`Unique LP Owners: ${uniqueOwners.size}`);
    
    if (activePositions.length > 0) {
      const totalActiveLiquidity = activePositions.reduce((sum, pos) => sum + BigInt(pos.liquidity), 0n);
      console.log(`Total Active Liquidity: ${totalActiveLiquidity.toString()}`);
      console.log(`Pool Utilization: ${(Number(totalActiveLiquidity) / Number(poolLiquidity) * 100).toFixed(2)}%`);
      
      // Show top 10 positions
      const sortedPositions = activePositions
        .sort((a, b) => Number(BigInt(b.liquidity) - BigInt(a.liquidity)))
        .slice(0, 10);
      
      console.log('\n🏆 Top 10 Active Positions:');
      sortedPositions.forEach((pos, i) => {
        console.log(`${i + 1}. Token ID: ${pos.tokenId}, Owner: ${pos.owner}, Liquidity: ${pos.liquidity}`);
      });

      // Calculate APR with real data
      const DAILY_BUDGET_KILT = 33333.33;
      const KILT_PRICE = 0.0182;
      const ANNUAL_BUDGET_USD = DAILY_BUDGET_KILT * KILT_PRICE * 365;
      
      console.log('\n💰 REAL APR CALCULATION:');
      console.log(`Treasury Annual Budget: $${ANNUAL_BUDGET_USD.toFixed(0)}`);
      
      if (uniqueOwners.size > 0) {
        const avgLiquidityPerLP = Number(totalActiveLiquidity) / uniqueOwners.size;
        const estimatedTVLPerLP = avgLiquidityPerLP * 0.0001; // Rough TVL estimation
        const totalEstimatedTVL = estimatedTVLPerLP * uniqueOwners.size;
        
        const realAPR = (ANNUAL_BUDGET_USD / totalEstimatedTVL) * 100;
        
        console.log(`Estimated Total TVL from Active LPs: $${totalEstimatedTVL.toFixed(0)}`);
        console.log(`Real APR (based on active LPs): ${realAPR.toFixed(1)}%`);
        console.log(`Average LP Position Value: $${estimatedTVLPerLP.toFixed(0)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error analyzing real LPs:', error.message);
  }
}

async function checkSinglePosition(client, tokenId) {
  try {
    const [position, owner] = await Promise.all([
      client.readContract({
        address: UNISWAP_V3_POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positions',
        args: [BigInt(tokenId)]
      }),
      client.readContract({
        address: UNISWAP_V3_POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)]
      })
    ]);

    // Check if this is a KILT/ETH position with liquidity
    if (position[7] > 0n && // has liquidity
        position[2].toLowerCase() === '0x4200000000000000000000000000000000000006' && // WETH
        position[3].toLowerCase() === '0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8') { // KILT
      
      return {
        position: {
          tokenId: tokenId.toString(),
          owner: owner.toLowerCase(),
          liquidity: position[7].toString(),
          tickLower: position[5],
          tickUpper: position[6],
          fee: position[4]
        },
        owner: owner.toLowerCase()
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function checkPositionBatch(client, startId, endId) {
  const positions = [];
  const owners = new Set();
  
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    const result = await checkSinglePosition(client, tokenId);
    if (result) {
      positions.push(result.position);
      owners.add(result.owner);
    }
  }
  
  return { positions, owners };
}

analyzeRealLPs();