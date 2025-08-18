/**
 * Updated Gas Estimation Card using Single Source APR
 * This replaces the previous version to use unified APR calculations
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useExpectedReturns } from "@/hooks/use-single-source-apr";
import { TrendingUp, Fuel, Clock } from "lucide-react";

interface GasEstimationCardProps {
  gasData?: {
    approve: { gasPrice: string; gasLimit: string; costUSD: string };
    mint: { gasPrice: string; gasLimit: string; costUSD: string };
    total: { costUSD: string };
    source: string;
  };
}

export function GasEstimationCardUnified({ gasData }: GasEstimationCardProps) {
  const { data: expectedReturns, isLoading, error } = useExpectedReturns();

  return (
    <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/30 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-purple-400" />
          Expected Returns & Costs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Expected Returns Section - SINGLE SOURCE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Trading Fees APR</span>
            {isLoading ? (
              <div className="h-4 w-12 bg-slate-700 animate-pulse rounded"></div>
            ) : error ? (
              <span className="text-red-400 text-sm">Error</span>
            ) : (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                {expectedReturns?.tradingAPR || '0.00'}%
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Treasury Rewards APR</span>
            {isLoading ? (
              <div className="h-4 w-12 bg-slate-700 animate-pulse rounded"></div>
            ) : error ? (
              <span className="text-red-400 text-sm">Error</span>
            ) : (
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                {expectedReturns?.incentiveAPR || '0.00'}%
              </Badge>
            )}
          </div>
          
          <Separator className="bg-slate-700/50" />
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Total Expected APR</span>
            {isLoading ? (
              <div className="h-5 w-16 bg-slate-700 animate-pulse rounded"></div>
            ) : error ? (
              <span className="text-red-400 text-sm">Error</span>
            ) : (
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
                {expectedReturns?.totalAPR || '0.00'}%
              </Badge>
            )}
          </div>
          
          {expectedReturns?.source && (
            <p className="text-xs text-slate-500">
              Source: {expectedReturns.source}
            </p>
          )}
        </div>

        <Separator className="bg-slate-700/50" />

        {/* Gas Costs Section */}
        {gasData && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Fuel className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-slate-300">Transaction Costs</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">Approval</div>
                <div className="text-sm font-medium text-white">{gasData.approve.costUSD}</div>
              </div>
              <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-1">Add Liquidity</div>
                <div className="text-sm font-medium text-white">{gasData.mint.costUSD}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Total Gas Cost</span>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                {gasData.total.costUSD}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Source: {gasData.source}
            </div>
          </div>
        )}

        {/* Value Proposition */}
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Earning Potential</span>
          </div>
          <p className="text-xs text-green-300">
            {!isLoading && expectedReturns ? (
              `Earn ${expectedReturns.totalAPR}% APR with minimal gas costs (${gasData?.total.costUSD || '$0.02'})`
            ) : (
              'Loading earning potential...'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}