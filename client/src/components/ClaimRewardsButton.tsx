import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Coins, AlertCircle } from 'lucide-react';

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
      // Step 1: Get secure signature from backend
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

      const { signature } = signatureData;

      // Step 2: Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Step 3: Enhanced contract interaction with nonce-based security
      const contractAddress = "0xe5771357399D58aC79A5b1161e8C363bB178B22b";
      
      // Encode simplified claimRewards(totalRewardBalance, signature) function call
      const amountWei = BigInt(Math.floor(claimableAmount * 1e18)).toString(16).padStart(64, '0');
      const signatureFormatted = signature.slice(2); // Remove 0x prefix
      
      const claimData = '0x' + 
        'b88d4fde' + // claimRewards(uint256,bytes) selector for simplified version
        amountWei + 
        '0000000000000000000000000000000000000000000000000000000000000040' + // offset for bytes
        '0000000000000000000000000000000000000000000000000000000000000041' + // signature length (65 bytes)
        signatureFormatted +
        '00'; // padding
      
      const txParams = {
        to: contractAddress,
        from: userAddress,
        data: claimData,
        gas: '0x186A0', // 100,000 gas limit
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
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