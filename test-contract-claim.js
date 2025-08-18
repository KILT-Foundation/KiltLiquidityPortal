// Direct contract claim testing script
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175';
const CALCULATOR_PRIVATE_KEY = '0x0d24569d1fcac6b371a80c6ee53b9ad021ab33742ad6465365c88508d08300df';
const USER_ADDRESS = '0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e';
const BASE_RPC_URL = 'https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA';

// Test amount (small amount for testing)
const TEST_AMOUNT = ethers.parseUnits('1.0', 18); // 1 KILT

const CONTRACT_ABI = [
  'function nonces(address) external view returns (uint256)',
  'function userClaimedAmounts(address) external view returns (uint256)', 
  'function claimRewards(address user, uint256 amount, uint256 nonce, bytes signature) external',
  'function authorizedCalculators(address) external view returns (bool)',
  'event RewardClaimed(address indexed user, uint256 amount, uint256 nonce)'
];

async function testContractClaim() {
  console.log('🧪 TESTING DIRECT CONTRACT CLAIM');
  console.log('=================================');

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    // Create calculator wallet
    const calculatorWallet = new ethers.Wallet(CALCULATOR_PRIVATE_KEY, provider);
    console.log(`🔐 Calculator wallet: ${calculatorWallet.address}`);

    // Get user nonce
    const userNonce = await contract.nonces(USER_ADDRESS);
    console.log(`🔢 User nonce: ${userNonce.toString()}`);

    // Check calculator authorization
    const isAuthorized = await contract.authorizedCalculators(calculatorWallet.address);
    console.log(`✅ Calculator authorized: ${isAuthorized}`);

    if (!isAuthorized) {
      console.log('❌ Calculator not authorized - cannot proceed with test');
      return;
    }

    // Create message hash (match contract implementation exactly)
    const messageHash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256'],
      [USER_ADDRESS, TEST_AMOUNT, userNonce]
    );
    console.log(`📝 Message hash: ${messageHash}`);

    // Sign the message hash (with Ethereum signed message prefix)
    const signature = await calculatorWallet.signMessage(ethers.getBytes(messageHash));
    console.log(`✍️  Signature: ${signature}`);

    // Test gas estimation first
    console.log('⛽ Testing gas estimation...');
    try {
      const gasEstimate = await contract.claimRewards.estimateGas(
        USER_ADDRESS,
        TEST_AMOUNT,
        userNonce,
        signature
      );
      console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);
      
      // If gas estimation succeeds, the transaction should work
      console.log('🎯 SUCCESS: Transaction should work - gas estimation passed');
      console.log('💡 The issue might be in the frontend signature generation or parameter passing');
      
    } catch (gasError) {
      console.log(`❌ Gas estimation failed: ${gasError.message}`);
      
      // Try alternative approach - check if the issue is with the signature format
      console.log('🔄 Testing alternative signature format...');
      
      // Try raw signature without prefix (some contracts expect this)
      const rawSignature = await calculatorWallet.signMessage(messageHash);
      console.log(`✍️  Raw signature: ${rawSignature}`);
      
      try {
        const gasEstimate2 = await contract.claimRewards.estimateGas(
          USER_ADDRESS,
          TEST_AMOUNT,
          userNonce,
          rawSignature
        );
        console.log(`✅ Raw signature gas estimate: ${gasEstimate2.toString()}`);
        console.log('🎯 SUCCESS: Raw signature format works');
      } catch (rawError) {
        console.log(`❌ Raw signature also failed: ${rawError.message}`);
        
        // Check if the issue is with the amount or nonce
        console.log('🔍 Checking if issue is with claimed amounts...');
        try {
          const claimedAmount = await contract.userClaimedAmounts(USER_ADDRESS);
          console.log(`📊 User claimed amount: ${ethers.formatUnits(claimedAmount, 18)} KILT`);
        } catch (claimedError) {
          console.log(`❌ Cannot read claimed amounts: ${claimedError.message}`);
          console.log('💡 This suggests a contract implementation issue with state reading');
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Export for direct usage
if (typeof module !== 'undefined') {
  module.exports = { testContractClaim };
}

// Auto-run
testContractClaim();