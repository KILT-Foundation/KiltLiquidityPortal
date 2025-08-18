// Uniswap V3 utilities and constants
import { ethers } from 'ethers';

// Uniswap V3 contract addresses on Base
export const UNISWAP_V3_ADDRESSES = {
  FACTORY: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  POSITION_MANAGER: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
  QUOTER: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481'
};

// Common token addresses on Base
export const BASE_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  KILT: '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8', // KILT token address on Base
  ETH: '0x0000000000000000000000000000000000000000' // Native ETH placeholder
};

// Export alias for backward compatibility
export const TOKENS = BASE_TOKENS;

// Fee tiers
export const FEE_TIERS = {
  LOWEST: 100,   // 0.01%
  LOW: 500,      // 0.05%
  MEDIUM: 3000,  // 0.3%
  HIGH: 10000    // 1%
};

// Pool configuration for KILT/ETH
export const KILT_ETH_POOL = {
  token0: BASE_TOKENS.KILT,
  token1: BASE_TOKENS.WETH,
  fee: FEE_TIERS.MEDIUM,
  address: '' // Will be computed dynamically
};

// Utility functions
export function getPoolAddress(token0: string, token1: string, fee: number): string {
  // This would normally compute the pool address using the factory
  // For now, return a placeholder that matches the expected format
  return ethers.solidityPackedKeccak256(
    ['string', 'address', 'address', 'uint24'],
    ['pool', token0, token1, fee]
  ).slice(0, 42);
}

export function formatTokenAmount(amount: string, decimals: number = 18): string {
  try {
    const formatted = ethers.formatUnits(amount, decimals);
    return parseFloat(formatted).toFixed(6);
  } catch {
    return '0.000000';
  }
}

export function parseTokenAmount(amount: string, decimals: number = 18): string {
  try {
    return ethers.parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
}

// Price utilities
export function calculatePrice(amount0: string, amount1: string, decimals0: number = 18, decimals1: number = 18): number {
  try {
    const amt0 = parseFloat(ethers.formatUnits(amount0, decimals0));
    const amt1 = parseFloat(ethers.formatUnits(amount1, decimals1));
    
    if (amt0 === 0) return 0;
    return amt1 / amt0;
  } catch {
    return 0;
  }
}

export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address); // Updated to use ethers v6 syntax
    return true;
  } catch {
    return false;
  }
}

// Position utilities
export interface PositionData {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
}

export function isKiltPosition(position: PositionData): boolean {
  const kiltAddress = BASE_TOKENS.KILT.toLowerCase();
  return position.token0.toLowerCase() === kiltAddress || 
         position.token1.toLowerCase() === kiltAddress;
}

export function calculatePositionValue(position: PositionData, ethPrice: number = 0): number {
  try {
    const amount0 = parseFloat(formatTokenAmount(position.amount0));
    const amount1 = parseFloat(formatTokenAmount(position.amount1));
    
    // Assuming token1 is WETH, token0 is KILT
    // This is a simplified calculation
    return (amount0 * 0.1) + (amount1 * ethPrice); // Placeholder KILT price
  } catch {
    return 0;
  }
}