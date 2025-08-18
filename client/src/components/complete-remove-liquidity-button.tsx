import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { useQueryClient } from '@tanstack/react-query';
import { useWagmiWallet } from '@/hooks/use-wagmi-wallet';
import { Download } from 'lucide-react';

interface CompleteRemoveLiquidityButtonProps {
  tokenId: string;
  disabled?: boolean;
}

export function CompleteRemoveLiquidityButton({ tokenId, disabled = false }: CompleteRemoveLiquidityButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { collectLiquidity } = useUniswapV3();
  const queryClient = useQueryClient();
  const { address } = useWagmiWallet();

  const handleCompleteRemoval = async () => {
    setIsLoading(true);
    try {
      console.log(`🔄 Step 2: Completing token collection for position ${tokenId}...`);
      
      await collectLiquidity({
        tokenId: tokenId
      });
      
      console.log(`✅ Step 2 completed: Tokens collected successfully for position ${tokenId}`);
      
      // INSTANT UI UPDATE - Force cache refresh to update position display immediately
      queryClient.invalidateQueries({ queryKey: [`/api/positions/wallet/${address}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/positions/${tokenId}/fees`] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/program-analytics'] });
      
      // Force immediate re-fetch to update UI instantly
      queryClient.refetchQueries({ queryKey: [`/api/positions/wallet/${address}`] });
      
      toast({
        title: "Removal Complete!",
        description: `Successfully collected WETH + KILT tokens from position #${tokenId} to your wallet`,
      });
    } catch (error) {
      console.error(`Complete removal failed for position ${tokenId}:`, error);
      toast({
        title: "Collection Failed",
        description: (error as Error)?.message || 'Failed to collect tokens from position',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCompleteRemoval}
      disabled={disabled || isLoading}
      size="sm"
      variant="outline"
      className="text-xs px-3 py-1 h-auto border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
    >
      <Download className="w-3 h-3 mr-1" />
      {isLoading ? 'Collecting...' : 'Complete Step 2'}
    </Button>
  );
}