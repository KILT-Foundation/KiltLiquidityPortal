import { TOKENS } from '@/lib/uniswap-v3';
import { parseUnits } from 'viem';

export interface LiquidityParams {
  kiltAmount: string;
  ethAmount: string;
  useNativeEth: boolean;
  strategy: 'balanced' | 'wide' | 'narrow' | 'full';
  slippage?: number;
}

export interface LiquidityCalculation {
  kiltAmount: string;
  ethAmount: string;
  totalValue: string;
  selectedToken: string;
  useNativeEth: boolean;
}

export class LiquidityService {
  static calculateOptimalAmounts(
    kiltBalance: string | bigint | undefined,
    wethBalance: string | bigint | undefined,
    ethBalance: string | bigint | undefined,
    kiltPrice: number,
    percentage: number = 80,
    formatTokenBalance: (balance: string | bigint | undefined) => string,
    realTimeEthPrice?: number // Optional real-time ETH price parameter
  ): LiquidityCalculation {
    if (!kiltBalance || !kiltPrice) {
      return { 
        kiltAmount: '0', 
        ethAmount: '0', 
        totalValue: '0', 
        selectedToken: 'KILT', 
        useNativeEth: false 
      };
    }

    // Use provided ETH price or fallback to approximate price
    const currentEthPrice = realTimeEthPrice || 3500;
    
    // Convert balances to numbers safely - the balances are already in human-readable format
    const availableKilt = parseFloat(kiltBalance?.toString() || '0');
    const availableWeth = parseFloat(wethBalance?.toString() || '0');
    const availableEth = parseFloat(ethBalance?.toString() || '0');
    
    // Calculate total value of each token in USD
    const kiltValueUSD = availableKilt * kiltPrice;
    const wethValueUSD = availableWeth * currentEthPrice;
    const ethValueUSD = availableEth * currentEthPrice;
    
    // Always pick the bigger amount between ETH and WETH (as per user requirement)
    const useEthNotWeth = ethValueUSD >= wethValueUSD;
    const ethTokenValue = useEthNotWeth ? ethValueUSD : wethValueUSD;
    const availableEthToken = useEthNotWeth ? availableEth : availableWeth;
    
    // Determine which token has higher value
    const selectedToken = kiltValueUSD >= ethTokenValue ? 'KILT' : (useEthNotWeth ? 'ETH' : 'WETH');
    
    // Calculate amounts using the selected percentage
    const safetyBuffer = percentage / 100;
    const maxKiltForBalance = availableKilt * safetyBuffer;
    const maxEthForBalance = availableEthToken * safetyBuffer;
    
    // Calculate equivalent amounts for balanced liquidity
    const kiltValueInEth = maxKiltForBalance * kiltPrice / currentEthPrice;
    const ethValueInKilt = maxEthForBalance * currentEthPrice / kiltPrice;
    
    let optimalKilt, optimalEth;
    
    if (kiltValueInEth <= maxEthForBalance) {
      // KILT is the limiting factor
      optimalKilt = maxKiltForBalance;
      optimalEth = kiltValueInEth;
    } else {
      // ETH is the limiting factor
      optimalKilt = ethValueInKilt;
      optimalEth = maxEthForBalance;
    }
    
    const totalValue = (optimalKilt * kiltPrice + optimalEth * currentEthPrice);
    
    return {
      kiltAmount: optimalKilt.toFixed(2),
      ethAmount: optimalEth.toFixed(6),
      totalValue: totalValue.toFixed(2),
      selectedToken,
      useNativeEth: useEthNotWeth
    };
  }

  static async executeQuickAddLiquidity(
    params: LiquidityParams,
    mintPosition: (params: any) => Promise<any>,
    approveToken: (tokenAddress: string, amount: string) => Promise<boolean>,
    parseTokenAmount: (amount: string) => bigint,
    toast: any,
    sessionId: string | null,
    createAppSession: () => Promise<string>,
    recordAppTransaction: (transactionHash: string, type: string, details: any) => Promise<void>
  ): Promise<boolean> {
    try {
      // Ensure we have a session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createAppSession();
      }

      // Step 1: Approve tokens
      
      toast({
        title: "Approving Tokens",
        description: "Approving KILT and ETH for liquidity provision...",
      });

      // Approve KILT
      const kiltApproved = await approveToken(TOKENS.KILT, params.kiltAmount);
      if (!kiltApproved) {
        throw new Error('Failed to approve KILT token');
      }

      // Approve ETH/WETH
      const ethTokenAddress = params.useNativeEth ? TOKENS.ETH : TOKENS.WETH;
      const ethApproved = await approveToken(ethTokenAddress, params.ethAmount);
      if (!ethApproved) {
        throw new Error('Failed to approve ETH token');
      }

      toast({
        title: "Tokens Approved",
        description: "Creating liquidity position...",
      });

      // Step 2: Create liquidity position
      const mintParams = {
        token0: TOKENS.KILT,
        token1: params.useNativeEth ? TOKENS.ETH : TOKENS.WETH,
        fee: 3000, // 0.3% fee tier
        tickLower: -887220, // Full range for simplicity
        tickUpper: 887220,
        amount0Desired: parseTokenAmount(params.kiltAmount),
        amount1Desired: parseTokenAmount(params.ethAmount),
        amount0Min: parseTokenAmount((parseFloat(params.kiltAmount) * 0.95).toString()),
        amount1Min: parseTokenAmount((parseFloat(params.ethAmount) * 0.95).toString()),
        recipient: TOKENS.KILT, // Will be replaced with actual address
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        slippage: params.slippage || 5,
        strategy: params.strategy,
        isNativeETH: params.useNativeEth
      };

      const result = await mintPosition(mintParams);
      
      if (result.success && result.transactionHash) {
        // Record transaction for reward eligibility
        await recordAppTransaction(result.transactionHash, 'MINT_POSITION', {
          kiltAmount: params.kiltAmount,
          ethAmount: params.ethAmount,
          strategy: params.strategy,
          useNativeEth: params.useNativeEth
        });

        toast({
          title: "Liquidity Added Successfully!",
          description: `Position created with ${params.kiltAmount} KILT + ${params.ethAmount} ${params.useNativeEth ? 'ETH' : 'WETH'}`,
        });

        return true;
      } else {
        throw new Error(result.error || 'Failed to create position');
      }
    } catch (error: any) {
      toast({
        title: "Quick Add Failed",
        description: error.message || "Failed to add liquidity automatically",
        variant: "destructive",
      });
      return false;
    }
  }

  static getPercentageOptions(): Array<{value: number, label: string}> {
    return [
      { value: 10, label: '10%' },
      { value: 25, label: '25%' },
      { value: 50, label: '50%' },
      { value: 75, label: '75%' },
      { value: 100, label: '100%' }
    ];
  }

  static estimateGasForQuickAdd(kiltAmount: string, ethAmount: string): number {
    // Estimate gas for approval + minting
    const approvalGas = 50000; // ~50k gas per approval
    const mintGas = 200000; // ~200k gas for minting
    return (approvalGas * 2) + mintGas; // Two approvals + mint
  }
}