import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function AdminRewards() {
  const [userAddress, setUserAddress] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [rewardStats, setRewardStats] = useState<any>(null);
  const { toast } = useToast();

  const checkUserRewards = async () => {
    if (!userAddress) {
      toast({
        title: "Error",
        description: "Please enter a user address",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`/api/rewards/stats?userAddress=${userAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user rewards');
      }
      
      const stats = await response.json();
      setRewardStats(stats);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch user reward stats",
        variant: "destructive"
      });
    }
  };

  const distributeRewards = async () => {
    if (!userAddress || !rewardStats) {
      return;
    }

    setIsDistributing(true);
    try {
      const response = await fetch('/api/rewards/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to distribute rewards');
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: `Successfully distributed ${result.amount.toFixed(4)} KILT to ${userAddress}`
      });
      
      // Refresh stats
      await checkUserRewards();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to distribute rewards",
        variant: "destructive"
      });
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Admin Reward Distribution</CardTitle>
            <CardDescription>
              Distribute calculated rewards to users' smart contract balance for claiming
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="userAddress" className="text-sm font-medium">
                User Wallet Address
              </label>
              <Input
                id="userAddress"
                placeholder="0x..."
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
              />
            </div>

            <Button onClick={checkUserRewards} className="w-full">
              Check User Rewards
            </Button>

            {rewardStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Reward Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Earned</p>
                      <p className="text-2xl font-bold text-green-500">
                        {rewardStats.totalClaimable?.toFixed(4) || '0'} KILT
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Daily Rate</p>
                      <p className="text-lg font-semibold">
                        {rewardStats.avgDailyRewards?.toFixed(2) || '0'} KILT/day
                      </p>
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      This user has earned {rewardStats.totalClaimable?.toFixed(4) || '0'} KILT 
                      from their liquidity positions. Click "Distribute to Smart Contract" to make 
                      these rewards claimable by the user.
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={distributeRewards}
                    disabled={isDistributing || !rewardStats.totalClaimable || rewardStats.totalClaimable <= 0}
                    className="w-full"
                  >
                    {isDistributing ? 'Distributing...' : 'Distribute to Smart Contract'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertDescription>
                <strong>How this works without private keys:</strong><br/>
                1. Users earn rewards based on their liquidity positions<br/>
                2. Admin uses this interface to distribute earned rewards to the smart contract<br/>
                3. Users can then claim their distributed rewards directly from the smart contract<br/>
                4. This approach keeps private keys secure while enabling reward distribution
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}