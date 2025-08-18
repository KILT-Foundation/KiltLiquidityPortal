// Script to get actual LP count from KILT/ETH Uniswap V3 pool
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const client = createPublicClient({
  chain: base,
  transport: http('https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA')
});

const POOL_ADDRESS = '0x82da478b1382b951cbad01beb9ed459cdb16458e';

// Uniswap V3 Pool ABI (just the events we need)
const POOL_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "sender", type: "address" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "tickLower", type: "int24" },
      { indexed: false, name: "tickUpper", type: "int24" },
      { indexed: false, name: "amount", type: "uint128" },
      { indexed: false, name: "amount0", type: "uint256" },
      { indexed: false, name: "amount1", type: "uint256" }
    ],
    name: "Mint",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "tickLower", type: "int24" },
      { indexed: false, name: "tickUpper", type: "int24" },
      { indexed: false, name: "amount", type: "uint128" },
      { indexed: false, name: "amount0", type: "uint256" },
      { indexed: false, name: "amount1", type: "uint256" }
    ],
    name: "Burn",
    type: "event"
  }
];

async function getActualLPCount() {
  try {
    console.log(`🔍 Analyzing LP count for pool: ${POOL_ADDRESS}`);
    
    // Get pool creation block (approximately)
    const poolCreationBlock = 18500000n; // Pool created around this time on Base
    const latestBlock = await client.getBlockNumber();
    
    console.log(`📊 Scanning from block ${poolCreationBlock} to ${latestBlock}`);
    
    // Get all Mint events
    const mintEvents = await client.getLogs({
      address: POOL_ADDRESS,
      event: {
        type: 'event',
        name: 'Mint',
        inputs: [
          { indexed: true, name: "sender", type: "address" },
          { indexed: true, name: "owner", type: "address" },
          { indexed: true, name: "tickLower", type: "int24" },
          { indexed: false, name: "tickUpper", type: "int24" },
          { indexed: false, name: "amount", type: "uint128" },
          { indexed: false, name: "amount0", type: "uint256" },
          { indexed: false, name: "amount1", type: "uint256" }
        ]
      },
      fromBlock: poolCreationBlock,
      toBlock: latestBlock
    });
    
    // Get all Burn events
    const burnEvents = await client.getLogs({
      address: POOL_ADDRESS,
      event: {
        type: 'event',
        name: 'Burn',
        inputs: [
          { indexed: true, name: "owner", type: "address" },
          { indexed: true, name: "tickLower", type: "int24" },
          { indexed: false, name: "tickUpper", type: "int24" },
          { indexed: false, name: "amount", type: "uint128" },
          { indexed: false, name: "amount0", type: "uint256" },
          { indexed: false, name: "amount1", type: "uint256" }
        ]
      },
      fromBlock: poolCreationBlock,
      toBlock: latestBlock
    });
    
    console.log(`📈 Found ${mintEvents.length} Mint events`);
    console.log(`📉 Found ${burnEvents.length} Burn events`);
    
    // Track net liquidity per address
    const lpBalances = new Map();
    
    // Process Mint events (add liquidity)
    for (const event of mintEvents) {
      const owner = event.args.owner;
      const amount = event.args.amount;
      
      if (!lpBalances.has(owner)) {
        lpBalances.set(owner, 0n);
      }
      lpBalances.set(owner, lpBalances.get(owner) + amount);
    }
    
    // Process Burn events (remove liquidity)
    for (const event of burnEvents) {
      const owner = event.args.owner;
      const amount = event.args.amount;
      
      if (lpBalances.has(owner)) {
        lpBalances.set(owner, lpBalances.get(owner) - amount);
      }
    }
    
    // Count active LPs (those with positive liquidity)
    let activeLPs = 0;
    const lpList = [];
    
    for (const [address, balance] of lpBalances.entries()) {
      if (balance > 0n) {
        activeLPs++;
        lpList.push({
          address,
          liquidity: balance.toString()
        });
      }
    }
    
    console.log(`🏊 RESULT: ${activeLPs} active liquidity providers`);
    console.log(`💧 Total unique addresses that provided liquidity: ${lpBalances.size}`);
    
    return {
      activeLPs,
      totalUniqueAddresses: lpBalances.size,
      lpList: lpList.slice(0, 10), // First 10 for verification
      mintEvents: mintEvents.length,
      burnEvents: burnEvents.length
    };
    
  } catch (error) {
    console.error('❌ Error getting LP count:', error);
    throw error;
  }
}

// Run the analysis
getActualLPCount()
  .then(result => {
    console.log('\n🎯 FINAL RESULT:');
    console.log(`Active LPs: ${result.activeLPs}`);
    console.log(`Total addresses: ${result.totalUniqueAddresses}`);
    console.log(`Mint events: ${result.mintEvents}`);
    console.log(`Burn events: ${result.burnEvents}`);
    
    if (result.lpList.length > 0) {
      console.log('\n📋 Sample active LPs:');
      result.lpList.forEach((lp, i) => {
        console.log(`${i + 1}. ${lp.address} - Liquidity: ${lp.liquidity}`);
      });
    }
  })
  .catch(console.error);