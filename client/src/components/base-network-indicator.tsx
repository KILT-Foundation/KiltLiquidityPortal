import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBaseNetwork } from '@/hooks/use-base-network';
import { useAccount } from 'wagmi';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function BaseNetworkIndicator() {
  const { isConnected } = useAccount();
  const { isOnBase, shouldSwitchToBase, switchToBase } = useBaseNetwork();

  if (!isConnected) {
    return null;
  }

  if (shouldSwitchToBase) {
    return (
      <Button
        onClick={switchToBase}
        variant="outline"
        size="sm"
        className="bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20 flex items-center gap-2"
      >
        <AlertTriangle className="h-3 w-3" />
        Switch to Base
      </Button>
    );
  }

  if (isOnBase) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
        <CheckCircle className="h-3 w-3 mr-1" />
        Base Network
      </Badge>
    );
  }

  return null;
}