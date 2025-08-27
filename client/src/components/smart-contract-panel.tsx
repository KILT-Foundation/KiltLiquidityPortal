import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWagmiWallet } from "@/hooks/use-wagmi-wallet";
import { apiRequest } from "@/lib/queryClient";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Slider } from "@/components/ui/slider";
import { 
  Building2,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Wallet,
  Lock,
  Unlock,
  Shield,
  TrendingUp,
  Activity
} from "lucide-react";

// Import centralized contract constants
import { 
  TOKEN_ADDRESSES, 
  ERC20_ABI, 
  DYNAMIC_TREASURY_POOL_ABI, 
  AUTHORIZED_ADMINS 
} from "@/lib/contracts";

// Simplified implementation focused on admin interface guidance

// Contract configuration fetched from database
// ABIs and addresses now imported from centralized contracts file

export function SmartContractPanel() {
  const { toast } = useToast();
  const { address, isConnected } = useWagmiWallet();
  const queryClient = useQueryClient();
  
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [rewardUser, setRewardUser] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [depositPercentage, setDepositPercentage] = useState([0]);
  const [withdrawPercentage, setWithdrawPercentage] = useState([0]);

  // Fetch treasury configuration from database
  const { data: treasuryConfig } = useQuery({
    queryKey: ['/api/treasury/config'],
    enabled: true
  });

  const contractAddress = (treasuryConfig as any)?.smartContractAddress;

  // Authorized admin addresses for smart contract operations
  const authorizedAdmins = AUTHORIZED_ADMINS;
  
  // Check if current wallet is authorized for admin operations
  const isAuthorizedAdmin = address && authorizedAdmins.some(admin => 
    admin.toLowerCase() === address.toLowerCase()
  );
  
  // Fetch real KILT balance for connected wallet with aggressive refresh
  const { data: walletKiltData, refetch: refetchWalletData } = useQuery({
    queryKey: [`/api/wallet/kilt-balance/${address}`],
    enabled: !!address,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch contract balances from blockchain with aggressive refresh
  const { data: contractData, refetch: refetchContractData } = useQuery({
    queryKey: [`/api/smart-contract/balances/${contractAddress}`],
    enabled: !!contractAddress,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Extract values with fallbacks
  const userKiltBalance = (walletKiltData as any)?.balance || 0;
  const kiltAllowance = (walletKiltData as any)?.allowance || 0;
  const contractBalance = (contractData as any)?.contractBalance || 0;
  const treasuryBalance = (contractData as any)?.treasuryBalance || 0;


  
  // Real Web3 transaction hooks
  const { 
    data: approveHash, 
    isPending: approvePending, 
    writeContract: approveKilt 
  } = useWriteContract();

  const { 
    data: depositHash, 
    isPending: depositPending, 
    writeContract: depositToTreasury 
  } = useWriteContract();

  const { 
    data: transferHash, 
    isPending: transferPending, 
    writeContract: transferKilt 
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  const { isLoading: transferConfirming, isSuccess: transferSuccess } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  const { 
    data: withdrawHash, 
    isPending: withdrawPending, 
    writeContract: emergencyWithdraw 
  } = useWriteContract();

  const { 
    data: rewardHash, 
    isPending: rewardPending, 
    writeContract: distributeReward 
  } = useWriteContract();

  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  const { isLoading: rewardConfirming, isSuccess: rewardSuccess } = useWaitForTransactionReceipt({
    hash: rewardHash,
  });

  // Check if user is authorized admin (either contract owner or additional admin)
  const isOwner = isAuthorizedAdmin;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const openBaseScan = (address: string) => {
    window.open(`https://basescan.org/address/${address}`, '_blank');
  };

  const handleApproveKilt = async () => {
    if (!depositAmount || !contractAddress) {
      toast({
        title: "Error",
        description: "Please enter an amount and ensure contract address is loaded",
        variant: "destructive"
      });
      return;
    }

    try {
      const amountInWei = parseUnits(depositAmount, 18);
      
      approveKilt({
        address: TOKEN_ADDRESSES.KILT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [contractAddress as `0x${string}`, amountInWei],
      });

      toast({
        title: "Approval Transaction Sent",
        description: "Please confirm the transaction in your wallet",
      });
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || !contractAddress) {
      toast({
        title: "Error",
        description: "Please enter an amount and ensure contract address is loaded",
        variant: "destructive"
      });
      return;
    }

    try {
      const amountInWei = parseUnits(depositAmount, 18);
      
      depositToTreasury({
        address: contractAddress as `0x${string}`,
        abi: DYNAMIC_TREASURY_POOL_ABI,
        functionName: 'depositTreasury',
        args: [amountInWei],
      });

      toast({
        title: "Deposit Transaction Sent",
        description: "Please confirm the transaction in your wallet",
      });
    } catch (error) {
      toast({
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
    }
  };

  const handleDirectTransfer = async () => {
    if (!depositAmount || !contractAddress) {
      toast({
        title: "Error",
        description: "Please enter an amount and ensure contract address is loaded",
        variant: "destructive"
      });
      return;
    }

    try {
      const amountInWei = parseUnits(depositAmount, 18);
      
      transferKilt({
        address: TOKEN_ADDRESSES.KILT as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [contractAddress as `0x${string}`, amountInWei],
      });

      toast({
        title: "Direct Transfer Sent",
        description: "Please confirm the KILT transfer in your wallet",
      });
    } catch (error) {
      toast({
        title: "Transfer Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !contractAddress) {
      toast({
        title: "Error",
        description: "Please enter an amount and ensure contract address is loaded",
        variant: "destructive"
      });
      return;
    }

    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only the contract owner can perform emergency withdrawals",
        variant: "destructive"
      });
      return;
    }

    try {
      const amountInWei = parseUnits(withdrawAmount, 18);
      
      emergencyWithdraw({
        address: contractAddress as `0x${string}`,
        abi: DYNAMIC_TREASURY_POOL_ABI,
        functionName: 'emergencyWithdraw',
        args: [amountInWei],
      });

      toast({
        title: "Withdrawal Transaction Sent",
        description: "Please confirm the transaction in your wallet",
      });
    } catch (error) {
      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
    }
  };

  const handleDistributeReward = async () => {
    if (!rewardUser || !rewardAmount || !contractAddress) {
      toast({
        title: "Error",
        description: "Please enter user address, reward amount, and ensure contract address is loaded",
        variant: "destructive"
      });
      return;
    }

    if (!isOwner) {
      toast({
        title: "Access Denied",
        description: "Only the contract owner can distribute rewards",
        variant: "destructive"
      });
      return;
    }

    try {
      const amountInWei = parseUnits(rewardAmount, 18);
      
      distributeReward({
        address: contractAddress as `0x${string}`,
        abi: DYNAMIC_TREASURY_POOL_ABI,
        functionName: 'distributeReward',
        args: [rewardUser as `0x${string}`, amountInWei],
      });

      toast({
        title: "Reward Distribution Sent",
        description: "Please confirm the transaction in your wallet",
      });
    } catch (error) {
      toast({
        title: "Distribution Failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive"
      });
    }
  };

  const maxWithdraw = () => {
    if (contractBalance > 0) {
      setWithdrawAmount(contractBalance.toString());
      setWithdrawPercentage([100]);
    }
  };

  const handleWithdrawPercentageChange = (value: number[]) => {
    const percentage = value[0];
    setWithdrawPercentage(value);
    if (contractBalance > 0) {
      const amount = (contractBalance * percentage) / 100;
      setWithdrawAmount(amount.toString());
    }
  };

  const handleWithdrawAmountChange = (value: string) => {
    setWithdrawAmount(value);
    if (contractBalance > 0 && value) {
      const percentage = (parseFloat(value) / contractBalance) * 100;
      setWithdrawPercentage([Math.min(100, Math.max(0, percentage))]);
    } else {
      setWithdrawPercentage([0]);
    }
  };

  const maxDeposit = () => {
    if (userKiltBalance > 0) {
      setDepositAmount(userKiltBalance.toString());
      setDepositPercentage([100]);
    }
  };

  const handleDepositPercentageChange = (value: number[]) => {
    const percentage = value[0];
    setDepositPercentage(value);
    if (userKiltBalance > 0) {
      const amount = (userKiltBalance * percentage) / 100;
      setDepositAmount(amount.toString());
    }
  };

  const handleDepositAmountChange = (value: string) => {
    setDepositAmount(value);
    if (userKiltBalance > 0 && value) {
      const percentage = (parseFloat(value) / userKiltBalance) * 100;
      setDepositPercentage([Math.min(100, Math.max(0, percentage))]);
    } else {
      setDepositPercentage([0]);
    }
  };

  // Handle successful transactions
  useEffect(() => {
    if (approveSuccess) {
      toast({
        title: "Approval Successful!",
        description: `Successfully approved ${depositAmount} KILT for treasury deposit`,
      });
      // Immediate data refresh for real-time updates
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/kilt-balance/${address}`] });
      refetchWalletData();
    }
  }, [approveSuccess, depositAmount, toast, queryClient, address, refetchWalletData]);

  useEffect(() => {
    if (transferSuccess) {
      toast({
        title: "Direct Transfer Successful!",
        description: `Successfully transferred ${depositAmount} KILT to contract`,
      });
      setDepositAmount("");
      // Immediate data refresh for real-time balance updates
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/kilt-balance/${address}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/smart-contract/balances/${contractAddress}`] });
      refetchWalletData();
      refetchContractData();
    }
  }, [transferSuccess, depositAmount, toast, queryClient, address, contractAddress, refetchWalletData, refetchContractData]);

  useEffect(() => {
    if (depositSuccess) {
      toast({
        title: "Deposit Successful!",
        description: `Successfully deposited ${depositAmount} KILT to treasury`,
      });
      setDepositAmount("");
      // Immediate data refresh for real-time balance updates
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/kilt-balance/${address}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/smart-contract/balances/${contractAddress}`] });
      refetchWalletData();
      refetchContractData();
    }
  }, [depositSuccess, depositAmount, toast, queryClient, address, contractAddress, refetchWalletData, refetchContractData]);

  useEffect(() => {
    if (withdrawSuccess) {
      toast({
        title: "Withdrawal Successful!",
        description: `Successfully withdrew ${withdrawAmount} KILT from treasury`,
      });
      setWithdrawAmount("");
      // Immediate data refresh for real-time balance updates
      queryClient.invalidateQueries({ queryKey: [`/api/wallet/kilt-balance/${address}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/smart-contract/balances/${contractAddress}`] });
      refetchWalletData();
      refetchContractData();
    }
  }, [withdrawSuccess, withdrawAmount, toast, queryClient, address, contractAddress, refetchWalletData, refetchContractData]);

  useEffect(() => {
    if (rewardSuccess) {
      toast({
        title: "Reward Distribution Successful!",
        description: `Successfully distributed ${rewardAmount} KILT to ${rewardUser}`,
      });
      setRewardAmount("");
      setRewardUser("");
      // Immediate data refresh for real-time balance updates
      queryClient.invalidateQueries({ queryKey: [`/api/smart-contract/balances/${contractAddress}`] });
      refetchContractData();
    }
  }, [rewardSuccess, rewardAmount, rewardUser, toast, queryClient, contractAddress, refetchContractData]);

  // Auto-refresh when component becomes visible or user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && contractAddress && address) {
        refetchWalletData();
        refetchContractData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [contractAddress, address, refetchWalletData, refetchContractData]);

  if (!isConnected) {
    return (
      <div className="bg-black/90 border border-red-400 rounded-lg p-6">
        <div className="text-center">
          <Wallet className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-400 mb-2">Wallet Not Connected</h3>
          <p className="text-gray-300">Connect your wallet to manage the smart contract</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contract Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-black/90 border border-green-400 rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-green-400 text-sm">
              <Building2 className="h-4 w-4" />
              <span>Contract Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Network:</span>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-400">Base</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Owner Access:</span>
              <Badge className={`${isOwner ? 'bg-green-500/20 text-green-400 border-green-400' : 'bg-red-500/20 text-red-400 border-red-400'}`}>
                {isOwner ? 'Authorized' : 'Not Owner'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Address:</span>
              <div className="flex items-center space-x-1">
                <span className="text-white text-xs font-mono">
                  {contractAddress ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}` : 'Loading...'}
                </span>
                {contractAddress && (
                  <>
                    <button onClick={() => copyToClipboard(contractAddress)}>
                      <Copy className="h-3 w-3 text-gray-400 hover:text-white" />
                    </button>
                    <button onClick={() => openBaseScan(contractAddress)}>
                      <ExternalLink className="h-3 w-3 text-gray-400 hover:text-white" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/90 border border-blue-400 rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-blue-400 text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Treasury Balance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {contractBalance ? Number(contractBalance).toLocaleString() : '0'} KILT
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Tracked: {treasuryBalance ? Number(treasuryBalance).toLocaleString() : '0'} KILT
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-2">
              <div className="text-xs text-gray-300 text-center">
                Available for distribution to users
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/90 border border-purple-400 rounded-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center space-x-2 text-purple-400 text-sm">
              <Wallet className="h-4 w-4" />
              <span>Your KILT Balance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">
                {userKiltBalance ? Number(userKiltBalance).toLocaleString() : '0'} KILT
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Allowance: {kiltAllowance ? Number(kiltAllowance).toLocaleString() : '0'} KILT
              </div>
            </div>
            <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-2">
              <div className="text-xs text-gray-300 text-center">
                Available to deposit to treasury
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contract Operations */}
      {isOwner ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fund Contract */}
          <Card className="bg-black/90 border border-green-400 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-400">
                <TrendingUp className="h-5 w-5" />
                <span>Fund Contract</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Wallet Balance Display */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Your KILT Balance</span>
                  <span className="text-lg font-bold text-green-400">
                    {userKiltBalance ? Number(userKiltBalance).toLocaleString() : '0'} KILT
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Allowance: {kiltAllowance ? Number(kiltAllowance).toLocaleString() : '0'} KILT
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="depositAmount" className="text-gray-300 text-sm font-medium">Amount (KILT)</Label>
                <div className="flex space-x-2">
                  <Input
                    id="depositAmount"
                    type="number"
                    placeholder="1000"
                    value={depositAmount}
                    onChange={(e) => handleDepositAmountChange(e.target.value)}
                    className="bg-black border-gray-600 text-white"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={maxDeposit}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 min-w-[60px]"
                  >
                    Max
                  </Button>
                </div>
                
                {/* Percentage Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-gray-400 text-xs">Percentage of Balance</Label>
                    <span className="text-green-400 text-sm font-medium">{depositPercentage[0]}%</span>
                  </div>
                  <Slider
                    value={depositPercentage}
                    onValueChange={handleDepositPercentageChange}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {/* Option 1: Contract Deposit (Owner Only) */}
                <div className="border border-yellow-400/30 rounded-lg p-3 bg-yellow-400/5">
                  <div className="text-sm font-semibold text-yellow-400 mb-2">Option 1: Smart Contract Deposit (Owner Only)</div>
                  <div className="space-y-2">
                    <Button
                      onClick={handleApproveKilt}
                      disabled={!depositAmount || approvePending || approveConfirming}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    >
                      {approvePending || approveConfirming ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          1. Approve KILT Tokens
                        </>
                      )}
                    </Button>
                    
                    <Button
                      onClick={handleDeposit}
                      disabled={!depositAmount || depositPending || depositConfirming || !isOwner}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50"
                    >
                      {depositPending || depositConfirming ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          2a. Deposit via Contract
                        </>
                      )}
                    </Button>
                  </div>
                  {!isOwner && (
                    <div className="text-xs text-red-400 mt-2">
                      Requires contract owner wallet (0xAFf...71a)
                    </div>
                  )}
                </div>

                {/* Option 2: Direct Transfer (Any Wallet) */}
                <div className="border border-blue-400/30 rounded-lg p-3 bg-blue-400/5">
                  <div className="text-sm font-semibold text-blue-400 mb-2">Option 2: Direct Transfer (Any Wallet)</div>
                  <Button
                    onClick={handleDirectTransfer}
                    disabled={!depositAmount || transferPending || transferConfirming}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {transferPending || transferConfirming ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Direct Transfer KILT
                      </>
                    )}
                  </Button>
                  <div className="text-xs text-green-400 mt-2">
                    Works with any wallet - Simple KILT token transfer
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded">
                <strong>Choose your method:</strong> Option 1 requires contract owner, Option 2 works with any wallet. Both fund the treasury. Gas cost: ~$0.02 per transaction.
              </div>
            </CardContent>
          </Card>

          {/* Emergency Withdrawal */}
          <Card className="bg-black/90 border border-red-400 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span>Emergency Withdrawal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Treasury Balance Display */}
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">Treasury Balance</span>
                  <span className="text-lg font-bold text-red-400">
                    {contractBalance ? Number(contractBalance).toLocaleString() : '0'} KILT
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Available for withdrawal
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="withdrawAmount" className="text-gray-300 text-sm font-medium">Amount (KILT)</Label>
                <div className="flex space-x-2">
                  <Input
                    id="withdrawAmount"
                    type="number"
                    placeholder="500"
                    value={withdrawAmount}
                    onChange={(e) => handleWithdrawAmountChange(e.target.value)}
                    className="bg-black border-gray-600 text-white"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={maxWithdraw}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 min-w-[60px]"
                  >
                    All
                  </Button>
                </div>
                
                {/* Percentage Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-gray-400 text-xs">Percentage of Treasury</Label>
                    <span className="text-red-400 text-sm font-medium">{withdrawPercentage[0]}%</span>
                  </div>
                  <Slider
                    value={withdrawPercentage}
                    onValueChange={handleWithdrawPercentageChange}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || withdrawPending || withdrawConfirming}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold"
              >
                {withdrawPending || withdrawConfirming ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Emergency Withdraw
                  </>
                )}
              </Button>
              
              <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-400/30">
                <strong>Warning:</strong> This withdraws KILT tokens directly to your wallet. Use only in emergencies.
              </div>
            </CardContent>
          </Card>

          {/* Distribute Rewards */}
          <Card className="bg-black/90 border border-blue-400 rounded-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-400">
                <Activity className="h-5 w-5" />
                <span>Distribute Rewards</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rewardUser" className="text-gray-300">User Address</Label>
                  <Input
                    id="rewardUser"
                    type="text"
                    placeholder="0x..."
                    value={rewardUser}
                    onChange={(e) => setRewardUser(e.target.value)}
                    className="bg-black border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rewardAmount" className="text-gray-300">Reward Amount (KILT)</Label>
                  <Input
                    id="rewardAmount"
                    type="number"
                    placeholder="100"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    className="bg-black border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <Button
                onClick={handleDistributeReward}
                disabled={!rewardUser || !rewardAmount || rewardPending || rewardConfirming}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
              >
                {rewardPending || rewardConfirming ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Distribute Reward
                  </>
                )}
              </Button>
              
              <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded">
                <strong>Note:</strong> This allocates KILT tokens to a user's claimable balance. They can claim immediately after distribution.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-black/90 border border-yellow-400 rounded-lg">
          <CardContent className="p-6 text-center">
            <Lock className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-yellow-400 mb-2">Smart Contract Owner Access Required</h3>
            <p className="text-gray-300 mb-4">
              Treasury operations require the actual smart contract owner wallet, not just admin panel access.
            </p>
            <div className="mt-4 text-sm text-gray-400 space-y-2">
              <div className="bg-gray-900/50 p-3 rounded border border-red-400/30">
                <p className="text-red-400 font-semibold">Smart Contract Owner Only:</p>
                <p className="font-mono text-xs">• 0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a</p>
              </div>
              <div className="bg-gray-900/50 p-3 rounded border border-blue-400/30">
                <p className="text-blue-400 font-semibold">Admin Panel Access (Non-Owner):</p>
                <p className="font-mono text-xs">• 0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e</p>
              </div>
              <div className="bg-gray-900/50 p-3 rounded border border-green-400/30">
                <p className="text-green-400 font-semibold">Your Connected Wallet:</p>
                <p className="font-mono text-xs">• {address}</p>
              </div>
              <div className="text-xs text-yellow-400 mt-3 bg-yellow-400/10 p-2 rounded">
                <strong>Note:</strong> To fund the contract, connect with wallet 0xAFf...71a
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Status */}
      {(approvePending || approveConfirming || depositPending || depositConfirming || transferPending || transferConfirming || withdrawPending || withdrawConfirming || rewardPending || rewardConfirming) && (
        <Card className="bg-black/90 border border-yellow-400 rounded-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-5 w-5 text-yellow-400 animate-spin" />
              <span className="text-yellow-400">
                {(approvePending || depositPending || transferPending || withdrawPending || rewardPending) ? 'Waiting for wallet confirmation...' : 'Transaction confirming on blockchain...'}
              </span>
            </div>
            {(approveHash || depositHash || transferHash || withdrawHash || rewardHash) && (
              <div className="mt-2 text-center">
                <button
                  onClick={() => openBaseScan(`https://basescan.org/tx/${approveHash || depositHash || transferHash || withdrawHash || rewardHash}`)}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center justify-center space-x-1"
                >
                  <span>View Transaction</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}