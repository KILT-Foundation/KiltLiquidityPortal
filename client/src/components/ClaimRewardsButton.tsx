import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Coins, AlertCircle } from 'lucide-react';
import { DYNAMIC_TREASURY_POOL_ABI } from '@/lib/contracts';
import { useWalletClient } from 'wagmi';
import { parseUnits } from 'viem';

interface ClaimRewardsButtonProps {
  userAddress: string;
  claimableAmount: number;
  onSuccess?: () => void;
}

export function ClaimRewardsButton({ 
  userAddress, 
  claimableAmount, 
  onSuccess 
}: ClaimRewardsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: walletClient } = useWalletClient();

  const handleClaim = async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet Required", 
        description: "Please connect MetaMask to claim rewards",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Step 1: Get secure signature and exact signed amount from backend
      const signatureResponse = await fetch('/api/security/generate-claim-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amount: claimableAmount
        })
      });

      if (!signatureResponse.ok) {
        const errorData = await signatureResponse.json();
        throw new Error(errorData.error || 'Failed to generate claim signature');
      }

      const signatureData = await signatureResponse.json();
      
      if (!signatureData.success) {
        throw new Error(signatureData.error || 'Signature generation failed');
      }

      const { signature, totalRewardBalance, nonce, contractAddress } = signatureData;

      // Step 2: Ensure chain and account
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Step 3: Use ABI-driven write with exact signed amount and nonce
      if (!walletClient) throw new Error('Wallet not available');

      const amountWei = parseUnits((totalRewardBalance ?? claimableAmount).toString(), 18);

      const txHash = await walletClient.writeContract({
        address: contractAddress as `0x${string}`,
        abi: DYNAMIC_TREASURY_POOL_ABI as any,
        functionName: 'claimRewards',
        args: [userAddress as `0x${string}`, amountWei, BigInt(nonce), signature as `0x${string}`],

      });
      
      toast({
        title: "Transaction Submitted",
        description: `Claiming ${claimableAmount.toFixed(2)} KILT tokens`,
      });

      // Success feedback
      setTimeout(() => {
        toast({
          title: "Rewards Claimed Successfully",
          description: `${claimableAmount.toFixed(2)} KILT tokens transferred`,
        });
        onSuccess?.();
      }, 3000);
      
    } catch (error: any) {
      console.error('Claim error:', error);
      
      let errorMessage = 'Failed to claim rewards';
      if (error.code === 4001) {
        errorMessage = 'Transaction cancelled by user';
      } else if (error.message?.includes('exceeds maximum')) {
        errorMessage = 'Claim amount exceeds maximum limit';
      } else if (error.message?.includes('signature')) {
        errorMessage = 'Security validation failed - please try again';
      }
      
      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (claimableAmount <= 0) {
    return (
      <Button disabled variant="outline" className="w-full">
        <AlertCircle className="w-4 h-4 mr-2" />
        No Rewards Available
      </Button>
    );
  }

  return (
    <Button 
      onClick={handleClaim}
      disabled={isLoading}
      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
      size="lg"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Coins className="w-4 h-4 mr-2" />
      )}
      {isLoading ? 'Claiming...' : `Claim ${claimableAmount.toFixed(2)} KILT`}
    </Button>
  );
}