import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUniswapV3 } from '@/hooks/use-uniswap-v3';
import { Coins } from 'lucide-react';

interface CollectTokensButtonProps {
  tokenId: string;
  disabled?: boolean;
}

export function CollectTokensButton({ tokenId, disabled = false }: CollectTokensButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { collectLiquidity } = useUniswapV3();

  const handleCollectTokens = async () => {
    setIsLoading(true);
    try {
      await collectLiquidity({
        tokenId: tokenId
      });
      
      toast({
        title: "Tokens Collected!",
        description: `Successfully collected tokens from position #${tokenId} to your wallet`,
      });
    } catch (error) {
      console.error('Collect tokens failed:', error);
      toast({
        title: "Collection Failed",
        description: (error as Error)?.message || 'Failed to collect tokens',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCollectTokens}
      disabled={disabled || isLoading}
      size="sm"
      variant="outline"
      className="text-xs px-2 py-1 h-auto border-green-500/30 text-green-400 hover:bg-green-500/10"
    >
      <Coins className="w-3 h-3 mr-1" />
      {isLoading ? 'Collecting...' : 'Collect Tokens'}
    </Button>
  );
}