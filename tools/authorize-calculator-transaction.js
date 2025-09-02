// Script to help authorize calculator through secure transaction method
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175';
const BASE_RPC_URL = 'https://mainnet.base.org';

// Contract ABI for authorization functions
const CONTRACT_ABI = [
  'function setPendingCalculatorAuthorization(address calculator) external',
  'function activatePendingCalculator(address calculator) external',
  'function authorizedCalculators(address) external view returns (bool)',
  'function pendingCalculatorActivation(address) external view returns (uint256)',
  'function owner() external view returns (address)'
];

async function checkAuthorizationStatus(calculatorAddress) {
  try {
    console.log('🔍 Checking authorization status...');
    
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    const isAuthorized = await contract.authorizedCalculators(calculatorAddress);
    const pendingTime = await contract.pendingCalculatorActivation(calculatorAddress);
    const owner = await contract.owner();
    
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Owner: ${owner}`);
    console.log(`Calculator: ${calculatorAddress}`);
    console.log(`Currently Authorized: ${isAuthorized}`);
    console.log(`Pending Activation: ${pendingTime > 0 ? new Date(Number(pendingTime) * 1000) : 'None'}`);
    
    if (isAuthorized) {
      console.log('✅ Calculator is already authorized!');
    } else if (pendingTime > 0) {
      const now = Math.floor(Date.now() / 1000);
      const canActivateAt = Number(pendingTime) + 24 * 60 * 60; // 24 hours later
      
      if (now >= canActivateAt) {
        console.log('⏰ Calculator can now be activated!');
        console.log('Call activatePendingCalculator on BaseScan');
      } else {
        const remainingHours = Math.ceil((canActivateAt - now) / 3600);
        console.log(`⏳ Wait ${remainingHours} more hours before activation`);
      }
    } else {
      console.log('📝 Next step: Set pending authorization');
      console.log('Go to BaseScan and call setPendingCalculatorAuthorization');
    }
    
  } catch (error) {
    console.error('Failed to check authorization:', error.message);
  }
}

// Get calculator address from command line or use example
const calculatorAddress = process.argv[2] || '0x0d16cbcf28fdc69cc44fc7a7a6a1a3bc75a8b82c';

checkAuthorizationStatus(calculatorAddress);