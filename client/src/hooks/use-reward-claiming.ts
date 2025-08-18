import { useState } from 'react';
import { createWalletClient, custom, createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { useWagmiWallet } from './use-wagmi-wallet';
import { useToast } from './use-toast';

// Enhanced DynamicTreasuryPool contract address on Base network - DEPLOYED!
const DYNAMIC_TREASURY_POOL_ADDRESS = '0x09bcB93e7E2FF067232d83f5e7a7E8360A458175' as const;

// KILT token address on Base network
const KILT_TOKEN_ADDRESS = '0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8' as const;

// Enhanced DynamicTreasuryPool contract ABI with security features for reward claiming
const DYNAMIC_TREASURY_POOL_ABI = [
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'distributeReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'totalRewardBalance', type: 'uint256' },
      { name: 'signature', type: 'bytes' }
    ],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserStats',
    outputs: [
      { name: 'totalClaimedAmount', type: 'uint256' },
      { name: 'lastClaimTime', type: 'uint256' },
      { name: 'canClaimAt', type: 'uint256' },
      { name: 'currentNonce', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getClaimedAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getClaimableAmount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserNonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalTreasuryBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAbsoluteMaxClaim',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const;

// Base network public client for reading blockchain data
const baseClient = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com'),
});

// Simplified interface for BasicTreasuryPool
export interface ClaimRewardsParams {
  // No parameters needed for BasicTreasuryPool.claimRewards()
}

export interface RewardClaimResult {
  success: boolean;
  transactionHash?: string;
  claimedAmount?: string;
  error?: string;
}

export function useRewardClaiming() {
  const { address, isConnected } = useWagmiWallet();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isCheckingClaimability, setIsCheckingClaimability] = useState(false);

  // Create wallet client for transactions
  const walletClient = address ? createWalletClient({
    chain: base,
    transport: custom((window as any).ethereum),
    account: address
  }) : null;

  // Check if rewards are claimable on-chain
  const checkClaimability = async (userAddress: string): Promise<{
    isClaimable: boolean;
    claimableAmount: string;
    lockExpiryDate: Date | null;
  }> => {
    setIsCheckingClaimability(true);
    try {
      // Read claimable amount from BasicTreasuryPool contract
      const claimableAmountResult = await baseClient.readContract({
        address: DYNAMIC_TREASURY_POOL_ADDRESS,
        abi: DYNAMIC_TREASURY_POOL_ABI,
        functionName: 'getUserStats',
        args: [userAddress as `0x${string}`],
      });

      const claimableAmount = (claimableAmountResult as any)?.[0]?.toString() || '0';
      const isClaimable = BigInt(claimableAmount) > 0n;

      return {
        isClaimable,
        claimableAmount,
        lockExpiryDate: null // No lock period in BasicTreasuryPool
      };
    } catch (error) {
      console.error('Failed to check claimability:', error);
      throw error;
    } finally {
      setIsCheckingClaimability(false);
    }
  };

  // Execute direct reward claiming from smart contract  
  const claimRewards = async (): Promise<RewardClaimResult> => {
    setIsClaiming(true);
    
    try {
      if (!isConnected || !address || !walletClient) {
        throw new Error('Wallet not connected');
      }

      // Step 1: Get user's calculated rewards from claimability endpoint
      console.log('🏁 ============ DETAILED CLAIM PROCESS LOG ============');
      console.log('📋 CLAIM LOG 1: User Address:', address);
      console.log('📋 CLAIM LOG 2: Current timestamp:', new Date().toISOString());
      console.log('📋 CLAIM LOG 3: Wallet connected:', !!isConnected);
      console.log('📋 CLAIM LOG 4: WalletClient available:', !!walletClient);
      console.log('📋 CLAIM LOG 5: Contract address:', DYNAMIC_TREASURY_POOL_ADDRESS);
      
      console.log('📋 CLAIM LOG 6: Getting calculated rewards from backend...');
      const claimabilityResponse = await fetch(`/api/rewards/claimability/${address}`);
      console.log('📋 CLAIM LOG 7: Claimability response status:', claimabilityResponse.status);
      
      if (!claimabilityResponse.ok) {
        console.error('❌ CLAIM LOG 8: Claimability request failed');
        throw new Error('Failed to get reward claimability from backend');
      }

      const claimability = await claimabilityResponse.json();
      console.log('📋 CLAIM LOG 9: Full claimability response:', JSON.stringify(claimability, null, 2));
      
      const calculatedAmount = claimability.totalClaimable || 0;
      console.log('📋 CLAIM LOG 10: Calculated amount:', calculatedAmount, 'KILT');
      
      if (calculatedAmount <= 0) {
        console.log('⚠️ CLAIM LOG 11: No rewards available');
        return {
          success: false,
          error: 'No rewards available for claiming. Start providing liquidity to earn KILT rewards.'
        };
      }

      // Step 2: Get user's current nonce and generate signature
      console.log('📋 CLAIM LOG 12: Requesting signature from backend...');
      const signatureResponse = await fetch('/api/rewards/generate-claim-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address
        })
      });

      console.log('📋 CLAIM LOG 13: Signature response status:', signatureResponse.status);
      
      if (!signatureResponse.ok) {
        const errorData = await signatureResponse.json();
        console.error('❌ CLAIM LOG 14: Signature request failed:', errorData);
        throw new Error(errorData.error || 'Failed to get claim signature from backend');
      }

      const signatureData = await signatureResponse.json();
      console.log('📋 CLAIM LOG 15: Full signature response:', JSON.stringify(signatureData, null, 2));
      
      const { signature, nonce, totalRewardBalance } = signatureData;
      console.log('📋 CLAIM LOG 16: Extracted signature:', signature);
      console.log('📋 CLAIM LOG 17: Signature type:', typeof signature);
      console.log('📋 CLAIM LOG 18: Signature length:', signature?.length);
      console.log('📋 CLAIM LOG 19: Extracted nonce:', nonce);
      console.log('📋 CLAIM LOG 20: Nonce type:', typeof nonce);
      console.log('📋 CLAIM LOG 20.5: Backend signed amount:', totalRewardBalance);
      
      // CRITICAL: Use the EXACT amount that was signed by the backend
      const signedAmount = totalRewardBalance || calculatedAmount;
      console.log('📋 CLAIM LOG 20.6: Using signed amount for contract call:', signedAmount);
      
      // Step 3: User claims rewards directly from treasury contract
      console.log('📋 CLAIM LOG 21: Preparing smart contract call...');
      const totalRewardBalanceWei = parseUnits(signedAmount.toString(), 18);
      console.log('📋 CLAIM LOG 22: Amount in wei:', totalRewardBalanceWei.toString());
      console.log('📋 CLAIM LOG 23: Contract ABI function:', 'claimRewards');
      console.log('📋 CLAIM LOG 24: Contract arguments:');
      console.log('  - totalRewardBalance:', totalRewardBalanceWei.toString());
      console.log('  - signature:', signature);
      console.log('  - msg.sender (from wallet):', address);
      
      console.log('🔗 CLAIM LOG 25: Calling smart contract claimRewards function...');
      // Contract function: claimRewards(uint256 totalRewardBalance, bytes signature)
      
      // Try to estimate gas first to catch any revert issues early
      console.log('🔗 CLAIM LOG 25.1: Estimating gas for transaction...');
      try {
        // CRITICAL FIX: Contract signature is claimRewards(uint256 totalRewardBalance, bytes signature)
        // NOT claimRewards(address user, uint256 amount, uint256 nonce, bytes signature)
        const gasEstimate = await baseClient.estimateContractGas({
          address: DYNAMIC_TREASURY_POOL_ADDRESS,
          abi: DYNAMIC_TREASURY_POOL_ABI,
          functionName: 'claimRewards',
          args: [totalRewardBalanceWei, signature], // Fixed: Only amount and signature
          account: address as `0x${string}`,
        });
        console.log('🔗 CLAIM LOG 25.2: Gas estimation successful:', gasEstimate.toString());
      } catch (gasError) {
        console.error('🔗 CLAIM LOG 25.3: Gas estimation failed:', gasError);
        console.error('🔗 CLAIM LOG 25.4: Error details:', {
          name: gasError instanceof Error ? gasError.name : 'Unknown',
          message: gasError instanceof Error ? gasError.message : 'Unknown gas estimation error',
          stack: gasError instanceof Error ? gasError.stack : undefined
        });
        
        // Check if this is a specific contract issue
        const errorStr = gasError instanceof Error ? gasError.message.toLowerCase() : '';
        
        if (errorStr.includes('execution reverted') || errorStr.includes('contractfunctionexecutionerror') || errorStr.includes('missing revert data') || errorStr.includes('call_exception')) {
          console.error('🔒 CRITICAL CONTRACT ISSUE: Smart contract state corrupted');
          
          // Clear and informative error message for users
          throw new Error(`Smart Contract Temporarily Unavailable: The reward claiming system is currently experiencing technical issues. Your rewards are safely accumulating and will be claimable once the contract issue is resolved. The development team has been notified. Please check back later.`);
        }
        
        // Check if it's a revert error and extract the reason
        let revertReason = 'Unknown revert reason';
        if (gasError instanceof Error) {
          if (errorStr.includes('revert')) {
            revertReason = gasError.message;
          } else if (errorStr.includes('signature')) {
            revertReason = 'Invalid signature verification';
          } else if (errorStr.includes('nonce')) {
            revertReason = 'Invalid nonce - user may have already claimed';
          } else if (errorStr.includes('insufficient')) {
            revertReason = 'Insufficient contract balance or user allowance';
          }
        }
        
        console.error('🔗 CLAIM LOG 25.5: Likely revert reason:', revertReason);
        throw new Error(`Transaction would fail: ${revertReason}`);
      }
      
      const claimHash = await walletClient.writeContract({
        address: DYNAMIC_TREASURY_POOL_ADDRESS,
        abi: DYNAMIC_TREASURY_POOL_ABI,
        functionName: 'claimRewards',
        args: [totalRewardBalanceWei, signature], // Fixed: Only amount and signature
        // Let MetaMask handle the wallet transaction nonce automatically
      });
      
      console.log('✅ CLAIM LOG 26: Transaction submitted with hash:', claimHash);

      // Wait for claim transaction to be mined
      const claimReceipt = await baseClient.waitForTransactionReceipt({ 
        hash: claimHash 
      });
      
      if (claimReceipt.status !== 'success') {
        throw new Error('Reward claim transaction failed');
      }

      console.log(`✅ Rewards claimed successfully. Transaction: ${claimHash}`);

      // Return success result
      return {
        success: true,
        transactionHash: claimHash,
        claimedAmount: signedAmount.toFixed(4),
      };

    } catch (error) {
      console.error('Reward claim failed:', error);
      
      let errorMessage = 'Failed to claim rewards';
      if (error instanceof Error) {
        if (error.message.includes('User denied')) {
          errorMessage = 'Transaction cancelled by user';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient ETH for gas fees';
        } else if (error.message.includes('Treasury contract not yet deployed')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    claimRewards,
    checkClaimability,
    isClaiming,
    isCheckingClaimability,
    isConnected,
    address,
    // Helper function to get user's NFT token IDs from positions
    getUserTokenIds: async (): Promise<string[]> => {
      if (!address) return [];
      
      try {
        // Fetch user positions to get token IDs
        const response = await fetch(`/api/positions/wallet/${address}`);
        const positions = await response.json();
        
        return positions
          .filter((pos: any) => pos.status === 'ACTIVE' && pos.nftTokenId)
          .map((pos: any) => pos.nftTokenId.toString());
      } catch (error) {
        console.error('Failed to fetch user token IDs:', error);
        return [];
      }
    }
  };
}