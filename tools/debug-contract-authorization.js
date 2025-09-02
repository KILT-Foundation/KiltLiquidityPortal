// Direct contract investigation script
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175';
const CALCULATOR_ADDRESS = '0x352c7eb64249334d8249f3486A664364013bEeA9';
const USER_ADDRESS = '0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e';
const BASE_RPC_URL = 'https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA';

// Contract ABI for debugging
const CONTRACT_ABI = [
  'function authorizedCalculators(address) external view returns (bool)',
  'function nonces(address) external view returns (uint256)',
  'function owner() external view returns (address)',
  'function getAbsoluteMaxClaim() external view returns (uint256)',
  'function userClaimedAmounts(address) external view returns (uint256)',
  'function getUserClaimedAmount(address) external view returns (uint256)',
  'function claimRewards(address user, uint256 amount, uint256 nonce, bytes signature) external'
];

async function debugContract() {
  console.log('🔍 DEBUGGING CONTRACT AUTHORIZATION STATUS');
  console.log('===========================================');

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    // Check contract deployment
    const code = await provider.getCode(CONTRACT_ADDRESS);
    console.log(`✅ Contract deployed: ${code.length > 2 ? 'YES' : 'NO'} (code length: ${code.length})`);

    // Check contract owner
    const owner = await contract.owner();
    console.log(`📋 Contract owner: ${owner}`);

    // Check calculator authorization
    const isAuthorized = await contract.authorizedCalculators(CALCULATOR_ADDRESS);
    console.log(`🔐 Calculator authorized: ${isAuthorized ? 'YES ✅' : 'NO ❌'}`);

    // Check user nonce
    const userNonce = await contract.nonces(USER_ADDRESS);
    console.log(`🔢 User nonce: ${userNonce.toString()}`);

    // Check max claim limit
    const maxClaim = await contract.getAbsoluteMaxClaim();
    const maxClaimFormatted = Number(ethers.formatUnits(maxClaim, 18));
    console.log(`💰 Max claim limit: ${maxClaimFormatted} KILT`);

    // Check user's claimed amount
    try {
      const claimedAmount = await contract.getUserClaimedAmount(USER_ADDRESS);
      const claimedFormatted = Number(ethers.formatUnits(claimedAmount, 18));
      console.log(`📊 User claimed amount: ${claimedFormatted} KILT`);
    } catch (error) {
      console.log(`📊 User claimed amount: ERROR - ${error.message}`);
    }

    console.log('\n🎯 DIAGNOSIS:');
    if (!isAuthorized) {
      console.log('❌ ISSUE FOUND: Calculator wallet is NOT authorized!');
      console.log('📋 SOLUTION: Contract owner must authorize calculator:');
      console.log(`   1. Go to https://basescan.org/address/${CONTRACT_ADDRESS}#writeContract`);
      console.log(`   2. Connect owner wallet (${owner})`);
      console.log(`   3. Call setPendingCalculatorAuthorization(${CALCULATOR_ADDRESS})`);
      console.log(`   4. Wait 24 hours`);
      console.log(`   5. Call activatePendingCalculator(${CALCULATOR_ADDRESS})`);
    } else {
      console.log('✅ Calculator is properly authorized');
      console.log('🔍 Issue might be in signature validation or other contract logic');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

// Export for direct usage
if (typeof module !== 'undefined') {
  module.exports = { debugContract };
}

// Auto-run
debugContract();