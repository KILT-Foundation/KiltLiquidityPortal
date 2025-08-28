import { useState } from 'react';
import { useWagmiWallet } from './use-wagmi-wallet';
import { useToast } from './use-toast';
import { useWalletClient } from 'wagmi';

// Uniswap V3 Position Manager on Base
const POSITION_MANAGER_ADDRESS = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';

// Simplified ABI for mint function
const MINT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'mint',
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// ERC20 ABI for approvals
const APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function useSimpleUniswapV3() {
  const { address } = useWagmiWallet();
  const { toast } = useToast();
  const [isMinting, setIsMinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  const { data : walletClient } = useWalletClient();

  const approveToken = async (tokenAddress: string, amount?: bigint) => {
    if (!walletClient || !address) throw new Error('Wallet not connected');

    try {
      await walletClient.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base chain ID in hex
      });
    } catch (manualError) {
      console.error('network switch failed:', manualError);
    }
    
    setIsApproving(true);
    try {
      // Use the correct maximum uint256 value
      const approvalAmount = amount || BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      
      const hash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: APPROVE_ABI,
        functionName: 'approve',
        args: [POSITION_MANAGER_ADDRESS as `0x${string}`, approvalAmount],
        account: address as `0x${string}`,
      });

      toast({
        title: "Token Approved",
        description: "Token approved for position manager",
      });

      return hash;
    } finally {
      setIsApproving(false);
    }
  };

  const mintPosition = async (params: {
    token0: string;
    token1: string;
    fee: number;
    tickLower: number;
    tickUpper: number;
    amount0Desired: bigint;
    amount1Desired: bigint;
    recipient: string;
    deadline: number;
    useNativeETH?: boolean;
  }) => {
    if (!walletClient || !address) throw new Error('Wallet not connected');
    
    setIsMinting(true);
    try {
      // Use 20% slippage tolerance to avoid STF error
      const amount0Min = (params.amount0Desired * 80n) / 100n;
      const amount1Min = (params.amount1Desired * 80n) / 100n;

      const mintParams = {
        token0: params.token0 as `0x${string}`,
        token1: params.token1 as `0x${string}`,
        fee: params.fee,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min,
        amount1Min,
        recipient: params.recipient as `0x${string}`,
        deadline: BigInt(params.deadline),
      };

      // Calculate ETH value for native ETH conversion to WETH
      // When using ETH (native), send the ETH amount as transaction value
      const value = params.useNativeETH ? params.amount0Desired : 0n;

      const hash = await walletClient.writeContract({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: MINT_ABI,
        functionName: 'mint',
        args: [mintParams],
        account: address as `0x${string}`,
        value,
      });

      toast({
        title: "Position Created",
        description: "Successfully created liquidity position",
      });

      return hash;
    } catch (error: any) {
      let errorMessage = "Position creation failed";
      
      if (error.message?.includes('STF')) {
        errorMessage = "Slippage tolerance failed - market conditions changed";
      } else if (error.message?.includes('insufficient')) {
        errorMessage = "Insufficient token balance";
      } else if (error.message?.includes('user rejected')) {
        errorMessage = "Transaction rejected by user";
      }

      toast({
        title: "Position Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsMinting(false);
    }
  };

  return {
    approveToken,
    mintPosition,
    isMinting,
    isApproving
  };
}