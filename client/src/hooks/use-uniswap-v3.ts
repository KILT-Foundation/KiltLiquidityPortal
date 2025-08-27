import { useState, useEffect } from 'react';
import { useWagmiWallet } from './use-wagmi-wallet';
import { useToast } from './use-toast';
import { createPublicClient, createWalletClient, custom, http, formatUnits, parseUnits, maxUint256, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import { useQuery } from '@tanstack/react-query';
import { useWalletClient } from 'wagmi';

// Extend window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Uniswap V3 NonfungiblePositionManager ABI (comprehensive)
const POSITION_MANAGER_ABI = [
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
  {
    inputs: [
      {
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'increaseLiquidity',
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'decreaseLiquidity',
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
        ],
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'collect',
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Add ownerOf function for position ownership verification
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: 'owner', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Add positions function for position data retrieval
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'positions',
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Create Base network client with reliable RPC endpoint
const baseClient = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com'),
});

// Contract addresses on Base network - Updated from official Uniswap docs
const UNISWAP_V3_POSITION_MANAGER = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';

// Custom hook to fetch blockchain configuration from admin panel
function useBlockchainConfig() {
  return useQuery({
    queryKey: ['/api/blockchain-config'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUniswapV3() {
  const { address, isConnected } = useWagmiWallet();
  const { toast } = useToast();
  const { data: walletClient } = useWalletClient();

  
  // Get blockchain configuration from admin panel - MUST be called unconditionally
  const { data: blockchainConfig, isLoading: isConfigLoading } = useBlockchainConfig();
  
  const [isMinting, setIsMinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [kiltBalance, setKiltBalance] = useState('0');
  const [wethBalance, setWethBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Fetch real position data from API
  const { data: positionData = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ['/api/positions/wallet', address],
    queryFn: async () => {
      if (!address) return [];
      
      const response = await fetch(`/api/positions/wallet/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch positions');
      }
      
      const data = await response.json();
      // The API returns the position array directly, not wrapped in an object
      return Array.isArray(data) ? data : [];
    },
    enabled: !!address && isConnected,
    refetchInterval: 120000, // Refresh every 2 minutes for better caching
    staleTime: 60000, // Consider stale after 1 minute
  });

  // Token addresses from admin panel configuration with proper fallbacks
  const blockchainData = Array.isArray(blockchainConfig) ? blockchainConfig : [];
  const kiltTokenConfig = blockchainData.find(config => config.configKey === 'KILT_TOKEN_ADDRESS');
  const poolConfig = blockchainData.find(config => config.configKey === 'KILT_ETH_POOL_ADDRESS');
  
  const KILT_TOKEN = kiltTokenConfig?.configValue || '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8';
  const WETH_TOKEN = '0x4200000000000000000000000000000000000006'; // Base WETH is standard
  const POOL_ADDRESS = poolConfig?.configValue || '0x82Da478b1382B951cBaD01Beb9eD459cDB16458E';

  // Real blockchain balance fetching with proper error handling
  const fetchRealBalances = async () => {
    if (!address || !isConnected) return;

    setIsLoadingBalances(true);
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const balancesPromise = Promise.all([
        // KILT token balance
        baseClient.readContract({
          address: KILT_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
        // WETH token balance
        baseClient.readContract({
          address: WETH_TOKEN as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
        // Native ETH balance
        baseClient.getBalance({
          address: address as `0x${string}`,
        }),
      ]);

      const [kiltBalanceWei, wethBalanceWei, ethBalanceWei] = await balancesPromise;
      
      // Clear timeout
      clearTimeout(timeoutId);

      // Convert wei to readable format
      const kiltBalanceFormatted = formatUnits(kiltBalanceWei, 18);
      const wethBalanceFormatted = formatUnits(wethBalanceWei, 18);
      const ethBalanceFormatted = formatUnits(ethBalanceWei, 18);
      
      setKiltBalance(kiltBalanceFormatted);
      setWethBalance(wethBalanceFormatted);
      setEthBalance(ethBalanceFormatted);
      
    } catch (error) {
      // Only show error if it's not an abort error
      if (error instanceof Error && error.name !== 'AbortError') {
        // Silent fail - just reset to zeros without showing error toast
        setKiltBalance('0');
        setWethBalance('0');
        setEthBalance('0');
      }
    } finally {
      setIsLoadingBalances(false);
    }
  };

  // Fetch balances when wallet connects
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    if (isConnected && address) {
      // Add a small delay to ensure wallet is fully connected
      timeoutId = setTimeout(() => {
        if (isMounted) {
          fetchRealBalances();
        }
      }, 1000);
    } else {
      setKiltBalance('0');
      setWethBalance('0');
      setEthBalance('0');
    }

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [address, isConnected]);

  const formatTokenAmount = (amount: string | bigint) => {
    try {
      const amountStr = typeof amount === 'bigint' ? amount.toString() : amount;
      const parsed = parseFloat(amountStr) / 1e18; // Convert from wei to readable format
      return parsed.toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const parseTokenAmount = (amount: string) => {
    return amount;
  };

  const approveToken = async ({ tokenAddress, amount }: { tokenAddress: `0x${string}`, amount: bigint }) => {
    setIsApproving(true);
    try {
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      // Call the ERC20 approve function
      const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            type: 'function'
          }
        ],
        functionName: 'approve',
        args: [UNISWAP_V3_POSITION_MANAGER as `0x${string}`, amount],
        account: address as `0x${string}`
      });

      // Wait for transaction confirmation
      await baseClient.waitForTransactionReceipt({ hash: txHash });

      toast({
        title: "Token Approved",
        description: `Token approved for position manager`,
      });

      return txHash;
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Failed to approve token';
      toast({
        title: "Approval Failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsApproving(false);
    }
  };

  const mintPosition = async (params: {
    token0: `0x${string}`,
    token1: `0x${string}`,
    fee: number,
    tickLower: number,
    tickUpper: number,
    amount0Desired: bigint,
    amount1Desired: bigint,
    amount0Min: bigint,
    amount1Min: bigint,
    recipient: `0x${string}`,
    deadline: number,
    useNativeETH?: boolean
  }) => {
    setIsMinting(true);
    try {
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      // Calculate ETH value for native ETH transactions on Base network
      // Uniswap V3 Position Manager can handle ETH-to-WETH conversion automatically
      let ethValue = 0n;
      
      if (params.useNativeETH) {
        // For KILT/ETH pool on Base, WETH is always token0, KILT is token1
        // So we need to send ETH equivalent to the WETH amount (token0)
        ethValue = params.amount0Desired; // Always use token0 amount for ETH value
      }
      
      // Enhanced transaction validation and debugging
      const transactionDetails = {
        ethValue: ethValue.toString(),
        useNativeETH: params.useNativeETH,
        token0: params.token0,
        token1: params.token1,
        amount0Desired: params.amount0Desired.toString(),
        amount1Desired: params.amount1Desired.toString(),
        amount0Min: params.amount0Min.toString(),
        amount1Min: params.amount1Min.toString(),
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        fee: params.fee,
        WETH_TOKEN,
        positionManager: UNISWAP_V3_POSITION_MANAGER
      };

      // Validate transaction parameters before execution
      if (params.amount0Desired === 0n && params.amount1Desired === 0n) {
        throw new Error('Both token amounts cannot be zero');
      }

      if (params.tickLower >= params.tickUpper) {
        throw new Error('Invalid tick range: tickLower must be less than tickUpper');
      }

      if (params.deadline < Math.floor(Date.now() / 1000)) {
        throw new Error('Transaction deadline has passed');
      }

      // For Base network, use multicall with refundETH when using native ETH
      let txHash: `0x${string}`;
      
      if (params.useNativeETH) {
        // Use multicall with mint + refundETH for native ETH handling  
        const mintCalldata = encodeFunctionData({
          abi: [
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
                    { name: 'deadline', type: 'uint256' }
                  ],
                  name: 'params',
                  type: 'tuple'
                }
              ],
              name: 'mint',
              outputs: [
                { name: 'tokenId', type: 'uint256' },
                { name: 'liquidity', type: 'uint128' },
                { name: 'amount0', type: 'uint256' },
                { name: 'amount1', type: 'uint256' }
              ],
              type: 'function'
            }
          ],
          functionName: 'mint',
          args: [
            {
              token0: params.token0,
              token1: params.token1,
              fee: params.fee,
              tickLower: params.tickLower,
              tickUpper: params.tickUpper,
              amount0Desired: params.amount0Desired,
              amount1Desired: params.amount1Desired,
              amount0Min: params.amount0Min,
              amount1Min: params.amount1Min,
              recipient: params.recipient,
              deadline: BigInt(params.deadline)
            }
          ]
        });

        const refundETHCalldata = encodeFunctionData({
          abi: [
            {
              inputs: [],
              name: 'refundETH',
              outputs: [],
              type: 'function'
            }
          ],
          functionName: 'refundETH',
          args: []
        });

        // Execute multicall with mint + refundETH
        txHash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: [
            {
              inputs: [
                { name: 'data', type: 'bytes[]' }
              ],
              name: 'multicall',
              outputs: [
                { name: 'results', type: 'bytes[]' }
              ],
              type: 'function'
            }
          ],
          functionName: 'multicall',
          args: [[mintCalldata, refundETHCalldata]],
          value: ethValue,
          account: address as `0x${string}`
        });
      } else {
        // Standard mint call for WETH-only transactions
        txHash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: [
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
                    { name: 'deadline', type: 'uint256' }
                  ],
                  name: 'params',
                  type: 'tuple'
                }
              ],
              name: 'mint',
              outputs: [
                { name: 'tokenId', type: 'uint256' },
                { name: 'liquidity', type: 'uint128' },
                { name: 'amount0', type: 'uint256' },
                { name: 'amount1', type: 'uint256' }
              ],
              type: 'function'
            }
          ],
          functionName: 'mint',
          args: [
            {
              token0: params.token0,
              token1: params.token1,
              fee: params.fee,
              tickLower: params.tickLower,
              tickUpper: params.tickUpper,
              amount0Desired: params.amount0Desired,
              amount1Desired: params.amount1Desired,
              amount0Min: params.amount0Min,
              amount1Min: params.amount1Min,
              recipient: params.recipient,
              deadline: BigInt(params.deadline)
            }
          ],
          value: ethValue,
          account: address as `0x${string}`
        });
      }

      // Wait for transaction confirmation
      const receipt = await baseClient.waitForTransactionReceipt({ hash: txHash });
      
      // Extract NFT token ID from transaction logs for auto-registration
      let tokenId = null;
      if (receipt.logs) {
        for (const log of receipt.logs) {
          // Look for Transfer event from Uniswap V3 NFT contract
          if (log.topics && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            // Transfer(address,address,uint256) - tokenId is in data or topics[3]
            if (log.topics[3]) {
              tokenId = BigInt(log.topics[3]).toString();
              break;
            }
          }
        }
      }

      toast({
        title: "Position Created!",
        description: `Transaction hash: ${txHash}`,
      });

      // Auto-register the position if tokenId was found
      if (tokenId && address) {
        try {
          console.log(`🔄 Auto-registering position ${tokenId} for user ${address}`);
          
          // Optimistic UI update: immediately invalidate eligible positions cache
          // to prevent position from showing in eligible list
          const { queryClient } = await import('@/lib/queryClient');
          queryClient.setQueryData(['/api/positions/eligible', address], (oldData: any) => {
            return oldData ? { ...oldData, eligiblePositions: [] } : oldData;
          });
          
          // Get user ID from storage first
          const userResponse = await fetch(`/api/users/address/${address}`);
          const userData = await userResponse.json();
          
          if (userData.success && userData.user) {
            const registrationData = {
              userId: userData.user.id,
              nftTokenId: tokenId,
              poolAddress: POOL_ADDRESS,
              token0Address: params.token0,
              token1Address: params.token1,
              token0Amount: params.amount0Desired,
              token1Amount: params.amount1Desired,
              tickLower: params.tickLower,
              tickUpper: params.tickUpper,
              feeTier: params.fee,
              liquidity: "0", // Will be updated from blockchain
              currentValueUSD: "0", // Will be calculated
              userAddress: address,
              transactionHash: txHash
            };

            const registerResponse = await fetch('/api/positions/create-app-position', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(registrationData)
            });

            if (registerResponse.ok) {
              const result = await registerResponse.json();
              console.log(`✅ Position ${tokenId} auto-registered successfully:`, result);
              
              // Invalidate all relevant caches immediately to update UI
              const { queryClient } = await import('@/lib/queryClient');
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/positions/wallet', address] }),
                queryClient.invalidateQueries({ queryKey: ['/api/positions/eligible', address] }),
                queryClient.invalidateQueries({ queryKey: [`/api/rewards/user`, userData.user.id, 'stats'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/analytics/user', userData.user.id, 'dashboard'] }),
                queryClient.refetchQueries({ queryKey: ['/api/rewards/program-analytics'] })
              ]);
              
              toast({
                title: "Position Registered!",
                description: `Position ${tokenId} is now earning KILT rewards`,
              });
            } else {
              console.warn(`⚠️ Auto-registration failed for position ${tokenId}`);
            }
          }
        } catch (error) {
          console.error(`❌ Auto-registration error for position ${tokenId}:`, error);
        }
      }

      return txHash;
    } catch (error) {
      const errorMessage = (error as Error)?.message || 'Failed to create position';
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

  // Process position data - API returns array directly
  const processedPositions = Array.isArray(positionData) ? positionData : [];
  const kiltEthPositions = processedPositions.filter(pos => {
    // Only show active positions (liquidity > 0) - API already filters this
    if (!pos.liquidity || pos.liquidity === '0') return false;
    
    // All positions from the API are already KILT positions
    return pos.isKiltPosition === true;
  });

  return {
    // Real blockchain balances
    kiltBalance,
    wethBalance,
    ethBalance,
    preferredEthToken: { type: 'WETH' as const },
    
    // Position data - real blockchain data
    userPositions: processedPositions,
    kiltEthPositions,
    poolData: null,
    poolExists: !isConfigLoading && !!POOL_ADDRESS,  // Pool exists if configuration loaded and pool address is set
    
    // Loading states
    isLoading: isLoadingBalances || isLoadingPositions,
    isIncreasing: false,
    isDecreasing: false,
    isCollecting: false,
    isBurning: false,
    isMinting,
    isApproving,
    
    // Functions
    formatTokenAmount,
    parseTokenAmount: (amount: string) => {
      try {
        return BigInt(Math.floor(parseFloat(amount || '0') * 1e18)).toString();
      } catch {
        return '0';
      }
    },
    // Manual refresh function for balances
    refreshBalances: fetchRealBalances,
    approveToken: async (params: { tokenAddress: string; amount: bigint }) => {
      setIsApproving(true);
      try {
        if (!address) throw new Error('Wallet not connected');
        
        // Check if MetaMask is available
        if (typeof window.ethereum === 'undefined') {
          throw new Error('MetaMask not found');
        }

        // Create wallet client
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });

        // Send approval transaction
        const hash = await walletClient.writeContract({
          address: params.tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [UNISWAP_V3_POSITION_MANAGER as `0x${string}`, params.amount],
          account: address as `0x${string}`,
        });

        // Wait for transaction confirmation
        const receipt = await baseClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
          toast({
            title: "Token Approved",
            description: `Successfully approved ${params.tokenAddress === KILT_TOKEN ? 'KILT' : 'WETH'} for trading`,
          });
        } else {
          throw new Error('Transaction failed');
        }
      } catch (error: any) {
        toast({
          title: "Approval failed",
          description: error.message || "Please try again",
          variant: "destructive",
        });
        throw error;
      } finally {
        setIsApproving(false);
      }
    },
    mintPosition: async (params: any) => {
      setIsMinting(true);
      try {
        if (!address) throw new Error('Wallet not connected');
        if (!walletClient) throw new Error('Wallet client not available');

        // Validate parameters
        if (!params.token0 || !params.token1) {
          throw new Error('Invalid token addresses');
        }

        // Ensure amounts are valid BigInt values
        const amount0Desired = BigInt(params.amount0Desired || '0');
        const amount1Desired = BigInt(params.amount1Desired || '0');
        
        if (amount0Desired <= 0n && amount1Desired <= 0n) {
          throw new Error('Invalid token amounts - both amounts cannot be zero');
        }

        // Check and handle KILT token approval for new users
        // Always need to approve KILT (token1) regardless of using native ETH for WETH (token0)
        if (amount1Desired > 0n) {
          try {
            // Check current KILT allowance
            const allowance = await baseClient.readContract({
              address: KILT_TOKEN as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address as `0x${string}`, UNISWAP_V3_POSITION_MANAGER as `0x${string}`],
            });

            // If allowance is insufficient, request approval
            if (allowance < amount1Desired) {
              console.log('🔐 KILT approval needed - requesting user approval...');
              toast({
                title: "Token Approval Required",
                description: "Please approve KILT spending in your wallet",
              });

              const hash = await walletClient.writeContract({
                address: KILT_TOKEN as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [UNISWAP_V3_POSITION_MANAGER as `0x${string}`, amount1Desired],
                account: address as `0x${string}`,
              });

              // Wait for approval confirmation
              const receipt = await baseClient.waitForTransactionReceipt({ hash });
              if (receipt.status !== 'success') {
                throw new Error('Token approval failed');
              }

              toast({
                title: "Token Approved",
                description: "KILT tokens approved for spending",
              });
            }
          } catch (approvalError: any) {
            throw new Error(`Token approval failed: ${approvalError.message}`);
          }
        }

        // More generous slippage protection (15% tolerance for initial testing)
        const amount0Min = (amount0Desired * 85n) / 100n;
        const amount1Min = (amount1Desired * 85n) / 100n;

        // Calculate ETH value to send (only if using native ETH)
        // For KILT/ETH pool: token0 = WETH, token1 = KILT, so use amount0Desired for ETH
        const ethValue = params.useNativeETH ? amount0Desired : 0n;

        // Create the mint parameters with proper structure
        const mintParams = {
          token0: params.token0 as `0x${string}`,
          token1: params.token1 as `0x${string}`,
          fee: params.fee,
          tickLower: params.tickLower,
          tickUpper: params.tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: params.recipient as `0x${string}`,
          deadline: BigInt(params.deadline),
        };

        console.log('Mint parameters:', {
          ...mintParams,
          amount0Desired: mintParams.amount0Desired.toString(),
          amount1Desired: mintParams.amount1Desired.toString(),
          amount0Min: mintParams.amount0Min.toString(),
          amount1Min: mintParams.amount1Min.toString(),
          deadline: mintParams.deadline.toString(),
          ethValue: ethValue.toString()
        });

        // Send minting transaction with proper account
        const hash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'mint',
          args: [mintParams],
          account: address as `0x${string}`,
          value: ethValue,
        });

        // Wait for transaction confirmation
        const receipt = await baseClient.waitForTransactionReceipt({ hash });
        
        if (receipt.status === 'success') {
          toast({
            title: "Position Created",
            description: "Successfully created liquidity position",
          });
          return hash;
        } else {
          throw new Error('Transaction failed');
        }
      } catch (error: any) {
        // Enhanced error handling
        let errorMessage = "Position creation failed";
        
        if (error.message?.includes('STF')) {
          errorMessage = "Slippage tolerance failed - try increasing slippage tolerance";
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = "Insufficient funds for transaction";
        } else if (error.message?.includes('user rejected')) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message?.includes('execution reverted')) {
          errorMessage = "Contract execution failed - check token approvals";
        } else if (error.message) {
          errorMessage = error.message;
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
    },
    increaseLiquidity: async (params: {
      tokenId: string;
      amount0Desired: string;
      amount1Desired: string;
      amount0Min?: string;
      amount1Min?: string;
    }) => {
      try {
        if (!address) throw new Error('Wallet not connected');
        
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });

        // Check and handle token approvals first
        const amount0Desired = BigInt(params.amount0Desired);
        const amount1Desired = BigInt(params.amount1Desired);
        
        console.log('🔍 Transaction Parameters:', {
          tokenId: params.tokenId,
          amount0Desired: amount0Desired.toString(),
          amount1Desired: amount1Desired.toString(),
          wethToken: WETH_TOKEN,
          kiltToken: KILT_TOKEN,
          positionManager: UNISWAP_V3_POSITION_MANAGER
        });
        
        // Check token balances first
        const [wethBalance, kiltBalance] = await Promise.all([
          baseClient.readContract({
            address: WETH_TOKEN as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          }),
          baseClient.readContract({
            address: KILT_TOKEN as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address as `0x${string}`],
          })
        ]);
        
        console.log('💰 Token Balances:', {
          wethBalance: wethBalance.toString(),
          kiltBalance: kiltBalance.toString(),
          requiredWeth: amount0Desired.toString(),
          requiredKilt: amount1Desired.toString()
        });
        
        // Handle ETH vs WETH based on user preference  
        const useEth = (params as any).useEth || false;
        if (useEth) {
          // When using ETH, check native ETH balance
          const ethBalance = await baseClient.getBalance({
            address: address as `0x${string}`,
          });
          
          console.log('💡 Native ETH Check:', {
            ethBalance: ethBalance.toString(),
            requiredEth: amount0Desired.toString(),
            hasEnoughEth: ethBalance >= amount0Desired + parseUnits('0.002', 18) // Reserve 0.002 ETH for gas
          });
          
          if (ethBalance < amount0Desired + parseUnits('0.002', 18)) {
            throw new Error(`Insufficient ETH balance for transaction. Have: ${formatUnits(ethBalance, 18)} ETH, Need: ${formatUnits(amount0Desired + parseUnits('0.002', 18), 18)} ETH (including gas)`);
          }
          
          console.log('✅ Using native ETH - no wrapping needed');
          
        } else {
          // When using WETH, check WETH balance and wrap if needed
          if (wethBalance < amount0Desired) {
            const ethBalance = await baseClient.getBalance({
              address: address as `0x${string}`,
            });
            
            const totalWethNeeded = amount0Desired - wethBalance;
            
            console.log('💡 ETH Wrapping Check:', {
              ethBalance: ethBalance.toString(),
              totalWethNeeded: totalWethNeeded.toString(),
              hasEnoughEth: ethBalance >= totalWethNeeded
            });
            
            if (ethBalance >= totalWethNeeded + parseUnits('0.001', 18)) { // Reserve 0.001 ETH for gas
              toast({
                title: "Wrapping ETH to WETH",
                description: `Converting ${formatUnits(totalWethNeeded, 18)} ETH to WETH for liquidity addition`,
              });
              
              // Wrap ETH to WETH
              const wrapHash = await walletClient.writeContract({
                address: WETH_TOKEN as `0x${string}`,
                abi: [
                  {
                    inputs: [],
                    name: 'deposit',
                    outputs: [],
                    stateMutability: 'payable',
                    type: 'function',
                  }
                ],
                functionName: 'deposit',
                value: totalWethNeeded,
                account: address as `0x${string}`,
              });
              
              await baseClient.waitForTransactionReceipt({ hash: wrapHash });
              
              toast({
                title: "ETH Wrapped Successfully",
                description: "ETH converted to WETH. Now processing liquidity addition...",
              });
            } else {
              throw new Error(`Insufficient ETH/WETH balance. Have: ${formatUnits(ethBalance, 18)} ETH + ${formatUnits(wethBalance, 18)} WETH, Need: ${formatUnits(amount0Desired, 18)} WETH total`);
            }
          }
        }
        
        if (kiltBalance < amount1Desired) {
          throw new Error(`Insufficient KILT balance. Have: ${formatUnits(kiltBalance, 18)}, Need: ${formatUnits(amount1Desired, 18)}`);
        }
        
        // Check WETH (token0) allowance only if NOT using native ETH
        if (amount0Desired > 0n && !useEth) {
          const wethAllowance = await baseClient.readContract({
            address: WETH_TOKEN as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address as `0x${string}`, UNISWAP_V3_POSITION_MANAGER as `0x${string}`],
          });
          
          console.log('🔒 WETH Allowance:', wethAllowance.toString());
          
          if (wethAllowance < amount0Desired) {
            toast({
              title: "Token Approval Required",
              description: "Please approve WETH spending in the next transaction",
            });
            
            const approveHash = await walletClient.writeContract({
              address: WETH_TOKEN as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [UNISWAP_V3_POSITION_MANAGER as `0x${string}`, amount0Desired * 2n], // Approve 2x for future transactions
              account: address as `0x${string}`,
            });
            
            await baseClient.waitForTransactionReceipt({ hash: approveHash });
            
            toast({
              title: "WETH Approved",
              description: "Now processing liquidity addition...",
            });
          }
        } else if (useEth) {
          console.log('🔓 Skipping WETH approval - using native ETH');
        }
        
        // Check KILT (token1) allowance
        if (amount1Desired > 0n) {
          const kiltAllowance = await baseClient.readContract({
            address: KILT_TOKEN as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address as `0x${string}`, UNISWAP_V3_POSITION_MANAGER as `0x${string}`],
          });
          
          console.log('🔒 KILT Allowance:', kiltAllowance.toString());
          
          if (kiltAllowance < amount1Desired) {
            toast({
              title: "Token Approval Required",
              description: "Please approve KILT spending in the next transaction",
            });
            
            const approveHash = await walletClient.writeContract({
              address: KILT_TOKEN as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [UNISWAP_V3_POSITION_MANAGER as `0x${string}`, amount1Desired * 2n], // Approve 2x for future transactions
              account: address as `0x${string}`,
            });
            
            await baseClient.waitForTransactionReceipt({ hash: approveHash });
            
            toast({
              title: "KILT Approved",
              description: "Now processing liquidity addition...",
            });
          }
        }

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        
        // Execute the increaseLiquidity transaction with proper ETH handling
        console.log('🚀 Executing increaseLiquidity transaction...');
        
        let hash;
        if (useEth) {
          // When using ETH, include the ETH value in the transaction
          console.log('💎 Using native ETH transaction with value:', formatUnits(amount0Desired, 18), 'ETH');
          hash = await walletClient.writeContract({
            address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
            abi: POSITION_MANAGER_ABI,
            functionName: 'increaseLiquidity',
            args: [{
              tokenId: BigInt(params.tokenId),
              amount0Desired,
              amount1Desired,
              amount0Min: BigInt(params.amount0Min || '0'),
              amount1Min: BigInt(params.amount1Min || '0'),
              deadline: BigInt(deadline)
            }],
            value: amount0Desired, // Send ETH value with the transaction
            account: address as `0x${string}`,
          });
        } else {
          // Standard WETH transaction (no ETH value)
          console.log('🔄 Using WETH transaction (no ETH value)');
          hash = await walletClient.writeContract({
            address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
            abi: POSITION_MANAGER_ABI,
            functionName: 'increaseLiquidity',
            args: [{
              tokenId: BigInt(params.tokenId),
              amount0Desired,
              amount1Desired,
              amount0Min: BigInt(params.amount0Min || '0'),
              amount1Min: BigInt(params.amount1Min || '0'),
              deadline: BigInt(deadline)
            }],
            account: address as `0x${string}`,
          });
        }

        await baseClient.waitForTransactionReceipt({ hash });
        
        toast({
          title: "Liquidity Added!",
          description: `Successfully added liquidity to position #${params.tokenId}`,
        });
        
        return hash;
      } catch (error: any) {
        // Enhanced error handling for increaseLiquidity
        let errorMessage = "Failed to add liquidity";
        
        if (error.message?.includes('STF')) {
          errorMessage = "Slippage tolerance failed - try increasing slippage tolerance";
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = "Insufficient token balance for transaction";
        } else if (error.message?.includes('user rejected')) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message?.includes('execution reverted')) {
          errorMessage = "Contract execution failed - check token approvals and balances";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Add Liquidity Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    },
    decreaseLiquidity: async (params: {
      tokenId: string;
      liquidity: string;
      amount0Min?: string;
      amount1Min?: string;
    }) => {
      try {
        if (!address) throw new Error('Wallet not connected');
        
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });

        // Verify position ownership before attempting to remove liquidity
        try {
          const owner = await baseClient.readContract({
            address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
            abi: POSITION_MANAGER_ABI,
            functionName: 'ownerOf',
            args: [BigInt(params.tokenId)],
          });
          
          if (owner.toLowerCase() !== address.toLowerCase()) {
            throw new Error(`Position #${params.tokenId} is not owned by connected wallet`);
          }
          
          console.log(`✅ Position ownership verified for token ${params.tokenId}`);
        } catch (ownershipError) {
          console.error('Position ownership verification failed:', ownershipError);
          throw new Error(`Cannot verify position ownership: ${(ownershipError as Error).message}`);
        }

        // Get current position data to verify liquidity
        try {
          const positionData = await baseClient.readContract({
            address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
            abi: POSITION_MANAGER_ABI,
            functionName: 'positions',
            args: [BigInt(params.tokenId)],
          });
          
          const currentLiquidity = positionData[7] as bigint; // liquidity is at index 7
          console.log(`Current position liquidity: ${currentLiquidity.toString()}`);
          console.log(`Attempting to remove: ${params.liquidity}`);
          
          if (currentLiquidity === 0n) {
            throw new Error(`Position #${params.tokenId} has no liquidity to remove`);
          }
          
          if (BigInt(params.liquidity) > currentLiquidity) {
            throw new Error(`Cannot remove ${params.liquidity} liquidity - position only has ${currentLiquidity.toString()}`);
          }
        } catch (positionError) {
          console.error('Position data verification failed:', positionError);
          throw new Error(`Cannot verify position data: ${(positionError as Error).message}`);
        }

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        
        console.log('🔄 Starting decreaseLiquidity with verified parameters:', {
          tokenId: params.tokenId,
          liquidity: params.liquidity,
          deadline,
          contractAddress: UNISWAP_V3_POSITION_MANAGER
        });
        
        const hash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'decreaseLiquidity',
          args: [{
            tokenId: BigInt(params.tokenId),
            liquidity: BigInt(params.liquidity),
            amount0Min: BigInt(params.amount0Min || '0'),
            amount1Min: BigInt(params.amount1Min || '0'),
            deadline: BigInt(deadline)
          }],
          account: address as `0x${string}`,
        });

        await baseClient.waitForTransactionReceipt({ hash });
        
        toast({
          title: "Liquidity Removed!",
          description: `Successfully removed liquidity from position #${params.tokenId}`,
        });
        
        return hash;
      } catch (error: any) {
        let errorMessage = "Failed to remove liquidity";
        let shouldShowRetryAdvice = false;
        
        // Check for circuit breaker errors that indicate temporary network protection
        if (error.message?.includes('breaker is open') || 
            error.message?.includes('circuit breaker') ||
            error.message?.includes('temporary restriction')) {
          errorMessage = "Network protection is active - this usually resolves within 5-30 minutes";
          shouldShowRetryAdvice = true;
        } else if (error.message?.includes('not owned by')) {
          errorMessage = error.message;
        } else if (error.message?.includes('no liquidity')) {
          errorMessage = error.message;
        } else if (error.message?.includes('Cannot remove')) {
          errorMessage = error.message;
        } else if (error.message?.includes('user rejected')) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message?.includes('insufficient funds')) {
          errorMessage = "Insufficient gas for transaction";
        } else if (error.message) {
          errorMessage = error.message;
          // Also check for other network/timeout errors that might be temporary
          shouldShowRetryAdvice = error.message.includes('network') || 
                                 error.message.includes('timeout') ||
                                 error.message.includes('connection') ||
                                 error.message.includes('rpc');
        }
        
        toast({
          title: "Remove Liquidity Failed",
          description: shouldShowRetryAdvice ? 
            `${errorMessage}. Try again in a few minutes or try smaller amounts.` : 
            errorMessage,
          variant: "destructive",
        });
        throw error;
      }
    },
    collectFees: async (params: {
      tokenId: string;
    }) => {
      try {
        if (!address) throw new Error('Wallet not connected');
        
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });
        
        const hash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId: BigInt(params.tokenId),
            recipient: address as `0x${string}`,
            amount0Max: BigInt('340282366920938463463374607431768211455'), // type(uint128).max
            amount1Max: BigInt('340282366920938463463374607431768211455'), // type(uint128).max
          }],
          account: address as `0x${string}`,
        });

        await baseClient.waitForTransactionReceipt({ hash });
        
        toast({
          title: "Fees Collected!",
          description: `Successfully collected fees from position #${params.tokenId}`,
        });
        
        return hash;
      } catch (error) {
        toast({
          title: "Collect Fees Failed",
          description: (error as Error)?.message || 'Failed to collect fees',
          variant: "destructive",
        });
        throw error;
      }
    },
    collectLiquidity: async (params: {
      tokenId: string;
    }) => {
      try {
        if (!address) throw new Error('Wallet not connected');
        
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });
        
        const hash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId: BigInt(params.tokenId),
            recipient: address as `0x${string}`,
            amount0Max: BigInt('340282366920938463463374607431768211455'), // type(uint128).max
            amount1Max: BigInt('340282366920938463463374607431768211455'), // type(uint128).max
          }],
          account: address as `0x${string}`,
        });

        await baseClient.waitForTransactionReceipt({ hash });
        
        toast({
          title: "Tokens Collected!",
          description: `Successfully collected underlying tokens from position #${params.tokenId}`,
        });
        
        return hash;
      } catch (error) {
        toast({
          title: "Collect Tokens Failed",
          description: (error as Error)?.message || 'Failed to collect underlying tokens',
          variant: "destructive",
        });
        throw error;
      }
    },
    removeLiquidityAndCollect: async (params: {
      tokenId: string;
      liquidity: string;
      removePercentage: number;
    }) => {
      try {
        if (!address) throw new Error('Wallet not connected');
        
        const walletClient = createWalletClient({
          chain: base,
          transport: custom(window.ethereum),
        });

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
        
        console.log('🔄 Step 1: Starting decreaseLiquidity transaction...');
        
        // Step 1: Remove liquidity from position
        const decreaseHash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'decreaseLiquidity',
          args: [{
            tokenId: BigInt(params.tokenId),
            liquidity: BigInt(params.liquidity),
            amount0Min: BigInt('0'),
            amount1Min: BigInt('0'),
            deadline: BigInt(deadline)
          }],
          account: address as `0x${string}`,
        });

        // Wait for Step 1 to complete
        await baseClient.waitForTransactionReceipt({ hash: decreaseHash });
        console.log('✅ Step 1 completed: Liquidity decreased successfully');
        
        // Wait a moment to ensure network state is updated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('🔄 Step 2: Starting collectLiquidity transaction...');
        
        // Step 2: Collect the underlying tokens to wallet
        const collectHash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId: BigInt(params.tokenId),
            recipient: address as `0x${string}`,
            amount0Max: BigInt('340282366920938463463374607431768211455'),
            amount1Max: BigInt('340282366920938463463374607431768211455'),
          }],
          account: address as `0x${string}`,
        });

        // Wait for Step 2 to complete
        await baseClient.waitForTransactionReceipt({ hash: collectHash });
        console.log('✅ Step 2 completed: Tokens collected successfully');
        
        toast({
          title: "Liquidity Removed!",
          description: `Successfully removed ${params.removePercentage}% liquidity and collected tokens from position #${params.tokenId}`,
        });
        
        return collectHash;
      } catch (error: any) {
        console.error('removeLiquidityAndCollect failed:', error);
        toast({
          title: "Remove Liquidity Failed",
          description: error?.message || 'Failed to remove liquidity and collect tokens',
          variant: "destructive",
        });
        throw error;
      }
    },
    burnPosition: async (params: { tokenId: string }) => {
      if (!address || !params.tokenId) {
        throw new Error('Address or token ID not available');
      }

      try {
        const walletClient = createWalletClient({
          account: address as `0x${string}`,
          chain: base,
          transport: custom(window.ethereum),
        });

        // First decrease all liquidity to 0
        const hash = await walletClient.writeContract({
          address: UNISWAP_V3_POSITION_MANAGER as `0x${string}`,
          abi: POSITION_MANAGER_ABI,
          functionName: 'burn' as any,
          args: [BigInt(params.tokenId)] as any,
          account: address as `0x${string}`,
        });

        await baseClient.waitForTransactionReceipt({ hash });

        toast({
          title: "Position Burned!",
          description: `Successfully burned position #${params.tokenId}`,
        });

        return hash;
      } catch (error) {
        toast({
          title: "Burn Position Failed",
          description: (error as Error)?.message || 'Failed to burn position',
          variant: "destructive",
        });
        throw error;
      }
    },
    calculatePositionValue: (position: any) => {
      // Calculate position value from token amounts and current prices
      if (!position || !position.currentValueUSD) return 0;
      return parseFloat(position.currentValueUSD.toString());
    },
    isPositionInRange: (position: any) => {
      // Check if position is in range based on API data
      if (!position) return false;
      // API already provides this information
      return position.isInRange !== false; // Default to true if not specified
    }
  };
}