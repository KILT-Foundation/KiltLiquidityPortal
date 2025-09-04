#!/usr/bin/env node
/**
 * Production Deployment Script for DynamicTreasuryPool
 * Network: Base (Chain ID: 8453)
 * 
 * Prerequisites:
 * - Set PRIVATE_KEY environment variable
 * - Ensure sufficient ETH for gas on Base network
 * - Verify KILT token address and owner address
 */

const { ethers } = require('hardhat');

async function main() {
  console.log('🚀 Deploying DynamicTreasuryPool to Base Network...');
  
  // Deployment parameters
  const KILT_TOKEN = '0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8';
  const OWNER_ADDRESS = '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a';
  
  // Validate parameters
  if (!ethers.isAddress(KILT_TOKEN)) {
    throw new Error('Invalid KILT token address');
  }
  if (!ethers.isAddress(OWNER_ADDRESS)) {
    throw new Error('Invalid owner address');
  }
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deployer address:', deployer.address);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('💰 Deployer balance:', ethers.formatEther(balance), 'ETH');
  
  if (balance < ethers.parseEther('0.01')) {
    throw new Error('Insufficient ETH balance for deployment');
  }
  
  // Deploy contract
  console.log('⚡ Deploying DynamicTreasuryPool...');
  const DynamicTreasuryPool = await ethers.getContractFactory('DynamicTreasuryPool');
  
  const contract = await DynamicTreasuryPool.deploy(
    KILT_TOKEN,
    OWNER_ADDRESS
  );
  
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log('✅ DynamicTreasuryPool deployed successfully!');
  console.log('📍 Contract address:', contractAddress);
  console.log('🔗 KILT token:', KILT_TOKEN);
  console.log('👤 Owner:', OWNER_ADDRESS);
  
  // Verify deployment
  console.log('🔍 Verifying deployment...');
  const kiltToken = await contract.kiltToken();
  const owner = await contract.owner();
  
  if (kiltToken.toLowerCase() !== KILT_TOKEN.toLowerCase()) {
    throw new Error('KILT token address mismatch!');
  }
  if (owner.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    throw new Error('Owner address mismatch!');
  }
  
  console.log('✅ Deployment verification successful!');
  
  // Output deployment summary
  console.log('\n📋 DEPLOYMENT SUMMARY:');
  console.log('='.repeat(50));
  console.log(`Contract: DynamicTreasuryPool`);
  console.log(`Address: ${contractAddress}`);
  console.log(`Network: Base (Chain ID: 8453)`);
  console.log(`KILT Token: ${KILT_TOKEN}`);
  console.log(`Owner: ${OWNER_ADDRESS}`);
  console.log(`Gas Used: ~2.5M (estimated)`);
  console.log(`Deploy Cost: ~$0.02 (Base network)`);
  console.log('='.repeat(50));
  
  // Next steps
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Verify contract on Basescan');
  console.log('2. Authorize backend calculator addresses');
  console.log('3. Fund contract with initial KILT tokens');
  console.log('4. Update frontend with contract address');
  console.log('5. Test signature generation and validation');
  
  return contractAddress;
}

// Execute deployment
if (require.main === module) {
  main()
    .then((address) => {
      console.log(`\n🎉 Deployment completed: ${address}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

module.exports = main;