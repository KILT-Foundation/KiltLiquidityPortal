import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard';
import { useValidatedPositions } from '@/hooks/use-validated-positions';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Clock, 
  TrendingUp, 
  Calculator, 
  Info,
  Zap,
  Target,
  Activity,
  ExternalLink
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PositionAnalytics {
  nftTokenId: string;
  positionAgeDays: number;
  programParticipationDays: number;
  timeBonus: number;
  maxTimeBonus: number;
  currentValueUSD: number;
  createdAt: Date;
  isActive: boolean;
}

interface ProgramSettings {
  timeBoostCoefficient: number;
  fullRangeBonus: number;
  minimumPositionValue: number;
  lockPeriod: number;
}

interface TreasuryConfig {
  programDurationDays: number;
  programStartDate: string;
  programEndDate: string;
  totalAllocation: number;
  dailyRewardsCap: number;
  isActive: boolean;
}

export function AnalyticsTab() {
  const unifiedData = useUnifiedDashboard();
  const { data: validatedPositions, isLoading } = useValidatedPositions(unifiedData?.user?.id);
  
  // Fetch admin program settings
  const { data: programSettings } = useQuery<ProgramSettings>({
    queryKey: ['/api/admin/program/settings'],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch admin treasury configuration
  const { data: treasuryConfig } = useQuery<TreasuryConfig>({
    queryKey: ['/api/admin/treasury/config'],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Calculate analytics for each position
  const [positionAnalytics, setPositionAnalytics] = useState<PositionAnalytics[]>([]);

  useEffect(() => {
    if (!validatedPositions || !Array.isArray(validatedPositions) || !programSettings || !treasuryConfig) return;

    const analytics = validatedPositions.map((position: any) => {
      const now = new Date();
      const createdAt = new Date(position.createdAt || position.registeredAt);
      
      const P = treasuryConfig.programDurationDays || 365;
      const b_time = programSettings.timeBoostCoefficient || 0.6;
      
      const positionAgeDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const programStartDate = treasuryConfig.programStartDate ? new Date(treasuryConfig.programStartDate) : new Date('2024-01-01');
      const participationStartMs = Math.max(programStartDate.getTime(), createdAt.getTime());
      const programParticipationDays = Math.max(0, (now.getTime() - participationStartMs) / (1000 * 60 * 60 * 24));
      
      // Calculate time bonus from participation days, capped at 1 + b_time
      const maxTimeBonus = 1 + b_time;
      const timeBonus = Math.min(1 + ((programParticipationDays / P) * b_time), maxTimeBonus);
      
      return {
        nftTokenId: position.nftTokenId || position.tokenId || position.id?.toString(),
        positionAgeDays,
        programParticipationDays,
        timeBonus,
        maxTimeBonus,
        currentValueUSD: parseFloat(position.currentValueUSD || '0'),
        createdAt,
        isActive: position.isActive !== false
      };
    });

    setPositionAnalytics(analytics);
  }, [validatedPositions, programSettings, treasuryConfig]);

  // Calculate aggregate statistics
  const totalPositions = positionAnalytics.length;
  const activePositions = positionAnalytics.filter(p => p.isActive).length;
  
  // Calculate weighted average time bonus based on position size
  const activePositionsData = positionAnalytics.filter(p => p.isActive);
  const totalValueUSD = activePositionsData.reduce((sum, p) => sum + p.currentValueUSD, 0);
  
  const weightedAverageTimeBonus = totalValueUSD > 0 
    ? activePositionsData.reduce((sum, p) => sum + (p.timeBonus * p.currentValueUSD), 0) / totalValueUSD
    : 0;
  
  // Also calculate simple average for comparison
  const simpleAverageTimeBonus = activePositions > 0 
    ? activePositionsData.reduce((sum, p) => sum + p.timeBonus, 0) / activePositions 
    : 0;

  if (isLoading || !programSettings || !treasuryConfig) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff0066] mx-auto mb-4"></div>
          <p className="text-white/70">Loading analytics and configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-[#ff0066]" />
              <span className="text-white/70 text-sm">Total Positions</span>
            </div>
            <div className="text-white text-xl font-bold">{totalPositions}</div>
            <div className="text-white/50 text-xs">{activePositions} active</div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-white/70 text-sm">Time Bonus</span>
              {/* <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-white/50 hover:text-white/70" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs max-w-xs">
                      <div className="font-semibold mb-1">Weighted Average</div>
                      <div>Larger positions have more influence</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider> */}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 text-sm">Weighted Average:</span>
                <span className="text-white font-bold">
                  {weightedAverageTimeBonus > 0 ? `${weightedAverageTimeBonus.toFixed(2)}x` : '--'}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 text-sm">Simple Average:</span>
                <span className="text-white font-bold">
                  {simpleAverageTimeBonus > 0 ? `${simpleAverageTimeBonus.toFixed(2)}x` : '--'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-white/70 text-sm">Max Time Bonus</span>
            </div>
             <div className="text-white text-xl font-bold">{(1 + programSettings.timeBoostCoefficient).toFixed(1)}x</div>
             <div className="text-white/50 text-xs">After {treasuryConfig.programDurationDays} days</div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-purple-400" />
              <span className="text-white/70 text-sm">Total Value</span>
            </div>
            <div className="text-white text-xl font-bold">
              ${totalValueUSD > 0 ? totalValueUSD.toLocaleString() : '0'}
            </div>
            <div className="text-white/50 text-xs">Active positions</div>
          </CardContent>
        </Card>
      </div>

      {/* Position Analytics */}
      <Card className="bg-black/40 backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-[#ff0066]" />
            Position Time Bonus Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positionAnalytics.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-white/50 mb-2">No positions found</div>
              <div className="text-white/30 text-sm">Add liquidity to see time bonus analytics</div>
            </div>
          ) : (
            <div className="space-y-4">
              {positionAnalytics.map((position) => (
                <div key={position.nftTokenId} className="bg-black/50 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-white font-medium">
                            <button
                            onClick={() => {
                                const tokenId = position.nftTokenId;
                                const uniswapUrl = `https://app.uniswap.org/pool/${tokenId}`;
                                window.open(uniswapUrl, '_blank', 'noopener,noreferrer');
                            }}
                            className="text-sm font-semibold text-pink-primary hover:text-[#ff0066] transition-colors duration-200 cursor-pointer hover:underline flex items-center gap-1"
                            title="View on Uniswap"
                            >
                            Position #{position.nftTokenId}
                            <ExternalLink className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="text-white/50 text-sm">
                          Created {position.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={position.isActive ? "bg-green-400/10 text-green-400 border-green-400/30" : "bg-red-400/10 text-red-400 border-red-400/30"}>
                        {position.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <div className="text-white/70 text-sm">Age/Participation</div>
                      <div className="text-white font-semibold">
                        {Math.floor(position.positionAgeDays)}days/{Math.floor(position.programParticipationDays)}days
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-white/70 text-sm">Time Bonus</div>
                      <div className="flex items-center gap-2">
                        <div className="text-white font-semibold">
                          {position.timeBonus.toFixed(2)}x
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-white/50 hover:text-white/70" />
                            </TooltipTrigger>
                             <TooltipContent>
                               <div className="text-xs">
                                 <div>Max possible: {position.maxTimeBonus.toFixed(1)}x</div>
                                 <div>Resets if position is closed</div>
                               </div>
                             </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-white/70 text-sm">Progress to Max</div>
                      <div className="text-white font-semibold">
                        {((position.timeBonus - 1) / (position.maxTimeBonus - 1) * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-white/70 text-sm">Position Value</div>
                      <div className="text-white font-semibold">
                        ${position.currentValueUSD.toLocaleString()}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-white/70 text-sm flex items-center gap-1">
                        Weighting
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3 w-3 text-white/50 hover:text-white/70" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs max-w-xs">
                                <div className="font-semibold mb-1">Position Weighting</div>
                                <div>Larger positions contribute more to the Weighted Average Time Bonus calculation.</div>
                                <div className="mt-1 pt-1 border-t border-white/20">
                                  Weight = Position Value / Total Portfolio Value
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="text-white font-semibold">
                        {totalValueUSD > 0 ? ((position.currentValueUSD / totalValueUSD) * 100).toFixed(1) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                      <span>Time Bonus Progress</span>
                      <span>{position.timeBonus.toFixed(2)}x / {position.maxTimeBonus.toFixed(1)}x</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-[#ff0066] to-emerald-400 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(((position.timeBonus - 1) / (position.maxTimeBonus - 1)) * 100, 100)}%` 
                        }}
                      />
                    </div>
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
