// Alternative authorization script for direct Web3 interaction
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175';
const CALCULATOR_ADDRESS = '0x352c7eb64249334d8249f3486A664364013bEeA9';
const BASE_RPC_URL = 'https://mainnet.base.org';

// Contract ABI (minimal for authorization functions)
const CONTRACT_ABI = [
  'function setPendingCalculatorAuthorization(address calculator) external',
  'function activatePendingCalculator(address calculator) external',
  'function authorizedCalculators(address) external view returns (bool)',
  'function pendingCalculatorActivation(address) external view returns (uint256)',
  'function owner() external view returns (address)'
];

async function authorizeCalculator() {
  try {
    console.log('🔐 Starting calculator authorization process...');
    
    // Check if running in browser with MetaMask
    if (typeof window !== 'undefined' && window.ethereum) {
      console.log('🦊 Using MetaMask provider');
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      console.log('📝 Setting pending calculator authorization...');
      const tx1 = await contract.setPendingCalculatorAuthorization(CALCULATOR_ADDRESS);
      console.log(`Transaction 1 sent: ${tx1.hash}`);
      await tx1.wait();
      console.log('✅ Pending authorization set! Wait 24 hours for step 2.');
      
    } else {
      console.log('⚠️  MetaMask not found. Use Remix IDE or install MetaMask.');
      console.log('📋 Manual steps:');
      console.log('1. Go to https://remix.ethereum.org');
      console.log('2. Load contract at:', CONTRACT_ADDRESS);
      console.log('3. Call setPendingCalculatorAuthorization with:', CALCULATOR_ADDRESS);
      console.log('4. Wait 24 hours, then call activatePendingCalculator');
    }
    
  } catch (error) {
    console.error('❌ Authorization failed:', error.message);
    console.log('💡 Try using Remix IDE instead: https://remix.ethereum.org');
  }
}

// Check current authorization status
async function checkStatus() {
  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const isAuthorized = await contract.authorizedCalculators(CALCULATOR_ADDRESS);
    const pendingTime = await contract.pendingCalculatorActivation(CALCULATOR_ADDRESS);
    
    console.log('📊 Authorization Status:');
    console.log(`Calculator Authorized: ${isAuthorized}`);
    console.log(`Pending Since: ${pendingTime > 0 ? new Date(Number(pendingTime) * 1000) : 'None'}`);
    
    if (pendingTime > 0 && !isAuthorized) {
      const canActivateAt = Number(pendingTime) + 24 * 60 * 60;
      const now = Math.floor(Date.now() / 1000);
      
      if (now >= canActivateAt) {
        console.log('🎯 Ready to activate! Call activatePendingCalculator');
      } else {
        const hoursLeft = Math.ceil((canActivateAt - now) / 3600);
        console.log(`⏰ ${hoursLeft} hours remaining until activation`);
      }
    }
    
  } catch (error) {
    console.error('Failed to check status:', error.message);
  }
}

// Export for use in browser console or Node.js
if (typeof module !== 'undefined') {
  module.exports = { authorizeCalculator, checkStatus };
}

// Auto-run status check
checkStatus();