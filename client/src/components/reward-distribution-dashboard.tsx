import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Send, Users, TrendingUp, AlertCircle, CheckCircle, ShoppingCart } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EligibleUser {
  userAddress: string;
  amount: string;
  nftTokenId: string;
  reason: string;
}

interface DistributionResult {
  success: boolean;
  message: string;
  distributedAmount: string;
  recipientCount: number;
  error?: string;
}

export function RewardDistributionDashboard() {
  const queryClient = useQueryClient();
  const [selectedUsers, setSelectedUsers] = useState<EligibleUser[]>([]);

  // Get treasury balance
  const { data: treasuryBalance, isLoading: balanceLoading } = useQuery({
    queryKey: ['/api/reward-distribution/treasury/balance'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get eligible users
  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ['/api/reward-distribution/eligible-users'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Distribution mutation
  const distributeMutation = useMutation<DistributionResult, Error, EligibleUser[]>({
    mutationFn: async (recipients: EligibleUser[]) => {
      return await apiRequest('/api/reward-distribution/distribute', {
        method: 'POST',
        data: { recipients }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reward-distribution/eligible-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reward-distribution/treasury/balance'] });
      setSelectedUsers([]);
    },
  });

  // Daily distribution mutation
  const dailyDistributionMutation = useMutation<DistributionResult, Error, void>({
    mutationFn: async () => {
      return await apiRequest('/api/reward-distribution/daily-distribution', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reward-distribution/eligible-users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reward-distribution/treasury/balance'] });
    },
  });

  const handleDistribute = async () => {
    if (selectedUsers.length === 0) return;
    
    try {
      await distributeMutation.mutateAsync(selectedUsers);
    } catch (error) {
      console.warn('Distribution failed (gracefully handled):', error);
    }
  };

  const handleDailyDistribution = async () => {
    try {
      await dailyDistributionMutation.mutateAsync();
    } catch (error) {
      console.warn('Daily distribution failed (gracefully handled):', error);
    }
  };

  const handleUserSelection = (user: EligibleUser, selected: boolean) => {
    if (selected) {
      setSelectedUsers([...selectedUsers, user]);
    } else {
      setSelectedUsers(selectedUsers.filter(u => u.userAddress !== user.userAddress));
    }
  };

  const totalSelectedAmount = selectedUsers.reduce((sum, user) => sum + parseFloat(user.amount), 0);

  if (balanceLoading || eligibleLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderBottomColor: '#ff0066' }}></div>
          <p className="mt-4 text-gray-400">Loading reward distribution data...</p>
        </div>
      </div>
    );
  }

  const eligibleUsers = (eligibleData as any)?.eligibleUsers || [];
  const balance = (treasuryBalance as any)?.balance || '0';

  return (
    <div className="space-y-6">
      {/* Treasury Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
        <Card className="bg-white/5 backdrop-blur-sm border-gray-800/30 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex-safe">
              <Coins className="h-4 w-4 flex-shrink-0" />
              <span className="truncate-safe">Treasury Balance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content-safe">
            <div className="text-2xl font-bold text-white number-display-safe truncate-safe">
              {parseFloat(balance).toLocaleString()} KILT
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate-safe">
              Available for distribution
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-gray-800/30 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex-safe">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate-safe">Eligible Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content-safe">
            <div className="text-2xl font-bold text-white number-display-safe">
              {eligibleUsers.length}
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate-safe">
              Ready for rewards
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 backdrop-blur-sm border-gray-800/30 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400 flex-safe">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <span className="truncate-safe">Selected Amount</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="card-content-safe">
            <div className="text-2xl font-bold text-white number-display-safe truncate-safe">
              {totalSelectedAmount.toLocaleString()} KILT
            </div>
            <p className="text-xs text-gray-400 mt-1 truncate-safe">
              {selectedUsers.length} users selected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={handleDailyDistribution}
          disabled={dailyDistributionMutation.isPending || eligibleUsers.length === 0}
          className="flex-1 bg-gradient-to-r from-[#ff0066] to-[#ff0066] hover:from-[#ff0066] hover:to-[#ff0066] text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          {dailyDistributionMutation.isPending ? 'Processing...' : 'Daily Distribution'}
        </Button>

        <Button
          onClick={handleDistribute}
          disabled={distributeMutation.isPending || selectedUsers.length === 0}
          variant="outline"
          className="flex-1 text-white hover:bg-[#ff0066]/10" style={{ borderColor: 'rgba(255, 0, 102, 0.3)', color: '#ff0066' }}
        >
          <Users className="h-4 w-4 mr-2" />
          {distributeMutation.isPending ? 'Distributing...' : `Distribute to Selected (${selectedUsers.length})`}
        </Button>
      </div>

      {/* Distribution Results */}
      {(distributeMutation.data || dailyDistributionMutation.data) && (
        <Card className="bg-white/5 backdrop-blur-sm border-gray-800/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-400">
              Distribution Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributeMutation.data && (
              <div className="flex items-center gap-2 mb-2">
                {distributeMutation.data.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <span className={distributeMutation.data.success ? 'text-emerald-400' : 'text-red-400'}>
                  {String(distributeMutation.data.message)}
                </span>
              </div>
            )}
            {dailyDistributionMutation.data && (
              <div className="flex items-center gap-2">
                {dailyDistributionMutation.data.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <span className={dailyDistributionMutation.data.success ? 'text-emerald-400' : 'text-red-400'}>
                  {String(dailyDistributionMutation.data.message)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Eligible Users List */}
      <Card className="bg-white/5 backdrop-blur-sm border-gray-800/30">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            Eligible Users ({eligibleUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eligibleUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No eligible users for distribution at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {eligibleUsers.map((user: EligibleUser) => (
                <div
                  key={user.userAddress}
                  className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.some(u => u.userAddress === user.userAddress)}
                      onChange={(e) => handleUserSelection(user, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">
                        {user.userAddress.slice(0, 6)}...{user.userAddress.slice(-4)}
                      </div>
                      <div className="text-xs text-gray-400">
                        NFT #{user.nftTokenId} • {user.reason}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-emerald-400">
                      {parseFloat(user.amount).toLocaleString()} KILT
                    </div>
                    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                      Ready
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}