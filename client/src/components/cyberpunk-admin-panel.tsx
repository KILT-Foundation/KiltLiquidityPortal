import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BlockchainConfigPanel } from "./blockchain-config-panel";
import { SmartContractPanel } from "./smart-contract-panel";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

interface TreasuryConfig {
  totalAllocation: number;
  programDurationDays: number;
  programStartDate: string;
  treasuryWalletAddress: string;
  isActive: boolean;
  // Auto-calculated fields (read-only)
  programEndDate?: string;
  dailyRewardsCap?: number;
}

interface ProgramSettings {
  timeBoostCoefficient: number;
  fullRangeBonus: number;
  minimumPositionValue: number;
  lockPeriod: number;
}

export function CyberpunkAdminPanel() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'treasury' | 'settings' | 'blockchain' | 'contract' | 'operations'>('treasury');
  const [treasuryConfig, setTreasuryConfig] = useState<TreasuryConfig>({
    totalAllocation: 0,
    programDurationDays: 0,
    programStartDate: '',
    treasuryWalletAddress: '',
    isActive: true
  });

  // Clear cache and force refresh when component mounts
  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['/api/admin/treasury/config'] });
    queryClient.removeQueries({ queryKey: ['/api/admin/program/settings'] });
  }, []);

  // Auto-calculate derived values
  const calculateDerivedValues = (config: TreasuryConfig) => {
    const dailyRewardsCap = config.totalAllocation && config.programDurationDays 
      ? config.totalAllocation / config.programDurationDays 
      : 0;
    
    const programEndDate = config.programStartDate && config.programDurationDays
      ? new Date(new Date(config.programStartDate).getTime() + (config.programDurationDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
      : '';

    return { dailyRewardsCap, programEndDate };
  };

  const derivedValues = calculateDerivedValues(treasuryConfig);
  
  const [programSettings, setProgramSettings] = useState<ProgramSettings>({
    timeBoostCoefficient: 0,
    fullRangeBonus: 0,
    minimumPositionValue: 0,
    lockPeriod: 0
  });

  // Save Treasury Configuration
  const treasuryMutation = useMutation({
    mutationFn: (config: TreasuryConfig) => {
      // Get the admin wallet address for logging
      const adminWallet = localStorage.getItem('admin_wallet') || 'Unknown Admin';
      
      // Include auto-calculated values and wallet address in the request
      const configWithCalculations = {
        ...config,
        ...derivedValues,
        adminWallet
      };
      
      return apiRequest('/api/admin/treasury/config', {
        method: 'POST',
        data: configWithCalculations
      });
    },
    onSuccess: (data) => {
      // Invalidate ALL queries that depend on treasury configuration for blazing fast updates
      queryClient.invalidateQueries({ queryKey: ['/api/admin/treasury/config'] });
      queryClient.invalidateQueries({ queryKey: ['maxAPR'] });
      queryClient.invalidateQueries({ queryKey: ['programAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/maximum-apr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/program-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['personalAPR'] });
      queryClient.invalidateQueries({ queryKey: ['rewardStats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/user-apr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trading-fees/pool-apr'] });
      
      // Force refetch of all cached data for instant main app updates
      queryClient.refetchQueries({ queryKey: ['maxAPR'] });
      queryClient.refetchQueries({ queryKey: ['programAnalytics'] });
      
      toast({
        title: "[TREASURY_UPDATE_SUCCESS]",
        description: "Treasury configuration updated successfully - Main app updated instantly",
        className: "bg-green-900/90 border-green-400 text-green-100",
      });
    },
    onError: (error) => {
      toast({
        title: "[TREASURY_UPDATE_FAILED]",
        description: `Failed to update treasury configuration: ${error.message}`,
        variant: "destructive",
        className: "bg-red-900/90 border-red-400 text-red-100",
      });
    }
  });

  // Save Program Settings
  const settingsMutation = useMutation({
    mutationFn: (settings: ProgramSettings) => {
      // Get the admin wallet address for logging
      const adminWallet = localStorage.getItem('admin_wallet') || 'Unknown Admin';
      
      return apiRequest('/api/admin/program/settings', {
        method: 'POST',
        data: {
          ...settings,
          adminWallet
        }
      });
    },
    onSuccess: (data) => {
      // Invalidate ALL queries that depend on program settings for blazing fast updates
      queryClient.invalidateQueries({ queryKey: ['/api/admin/program/settings'] });
      queryClient.invalidateQueries({ queryKey: ['maxAPR'] });
      queryClient.invalidateQueries({ queryKey: ['programAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/maximum-apr'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/program-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['personalAPR'] });
      queryClient.invalidateQueries({ queryKey: ['rewardStats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/user-apr'] });
      
      // Force refetch of all cached data for instant main app updates
      queryClient.refetchQueries({ queryKey: ['maxAPR'] });
      queryClient.refetchQueries({ queryKey: ['programAnalytics'] });
      
      toast({
        title: "[PROGRAM_SETTINGS_SUCCESS]",
        description: "Program parameters updated successfully - Main app updated instantly",
        className: "bg-green-900/90 border-green-400 text-green-100",
      });
    },
    onError: (error) => {
      toast({
        title: "[PROGRAM_SETTINGS_FAILED]",
        description: `Failed to update program settings: ${error.message}`,
        variant: "destructive",
        className: "bg-red-900/90 border-red-400 text-red-100",
      });
    }
  });

  // Load existing treasury configuration with forced refresh
  const { data: existingTreasuryConfig, isLoading: treasuryLoading } = useQuery({
    queryKey: ['/api/admin/treasury/config'],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Load existing program settings
  const { data: existingProgramSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/admin/program/settings'],
  });

  // Update state when data loads
  useEffect(() => {
    if (existingTreasuryConfig && !treasuryLoading) {
      // Loading treasury config
      setTreasuryConfig({
        ...treasuryConfig,
        ...existingTreasuryConfig,
        // Ensure dates are properly set
        programStartDate: (existingTreasuryConfig as any).programStartDate || '',
        programEndDate: (existingTreasuryConfig as any).programEndDate || ''
      });
    }
  }, [existingTreasuryConfig, treasuryLoading]);

  useEffect(() => {
    if (existingProgramSettings && !settingsLoading) {
      setProgramSettings(existingProgramSettings as ProgramSettings);
    }
  }, [existingProgramSettings, settingsLoading]);

  // Get Operations History
  const { data: operations = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/operations'],
    refetchInterval: 5000
  });

  const handleSaveTreasury = () => {

    
    // Validate required fields on frontend
    if (!treasuryConfig.treasuryWalletAddress || treasuryConfig.treasuryWalletAddress.trim() === '') {
      toast({
        title: "[VALIDATION_ERROR]",
        description: "Treasury wallet address is required",
        variant: "destructive",
        className: "bg-red-900/90 border-red-400 text-red-100",
      });
      return;
    }
    
    treasuryMutation.mutate(treasuryConfig);
  };

  const handleSaveSettings = () => {
    settingsMutation.mutate(programSettings);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_wallet');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono overflow-hidden relative">
      {/* Matrix Rain Background */}
      <div className="fixed inset-0 opacity-5">
        <div className="matrix-rain"></div>
      </div>
      
      {/* Cyberpunk Grid */}
      <div className="fixed inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 255, 102, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 255, 102, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-green-400 bg-black/90 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#ff0066] tracking-wider">
                ◢◤ KILT PROTOCOL ADMIN CONSOLE ◥◣
              </h1>

            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white font-mono text-sm rounded hover:bg-red-500 transition-colors"
            >
              [LOGOUT]
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-gray-900 border-b border-green-400/30">
          <div className="flex">
            {[
              { id: 'treasury', label: 'TREASURY_CONFIG' },
              { id: 'settings', label: 'PROGRAM_PARAMS' },
              { id: 'blockchain', label: 'BLOCKCHAIN_CONFIG' },
              { id: 'contract', label: 'SMART_CONTRACT' },
              { id: 'operations', label: 'OPERATIONS_LOG' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-mono text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-green-400 text-black'
                    : 'text-green-400 hover:bg-green-400/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {(treasuryLoading || settingsLoading) && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-4"></div>
              <div className="text-green-400 font-mono">Loading admin configuration...</div>
            </div>
          )}

          {/* Treasury Configuration */}
          {activeTab === 'treasury' && !treasuryLoading && (
            <div className="space-y-6">
              <div className="bg-black/50 border border-green-400 rounded p-6">
                <h2 className="text-lg font-bold text-[#ff0066] mb-4 tracking-wider">
                  [TREASURY_ALLOCATION_MATRIX]
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">TOTAL_ALLOCATION:</label>
                    <input
                      type="number"
                      value={treasuryConfig.totalAllocation || ''}
                      onChange={(e) => setTreasuryConfig({
                        ...treasuryConfig,
                        totalAllocation: Number(e.target.value) || 0
                      })}
                      placeholder="Enter total allocation"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">PROGRAM_DURATION_DAYS:</label>
                    <input
                      type="number"
                      value={treasuryConfig.programDurationDays || ''}
                      onChange={(e) => setTreasuryConfig({
                        ...treasuryConfig,
                        programDurationDays: Number(e.target.value) || 0
                      })}
                      placeholder="Enter program duration"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">TREASURY_WALLET_ADDRESS:</label>
                    <input
                      type="text"
                      value={treasuryConfig.treasuryWalletAddress || ''}
                      onChange={(e) => {

                        setTreasuryConfig({
                          ...treasuryConfig,
                          treasuryWalletAddress: e.target.value
                        });
                      }}
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none"
                      placeholder="0x1234...abcd (complete wallet address required)"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Treasury wallet that holds and distributes KILT token rewards
                    </div>
                  </div>

                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">DAILY_REWARDS_CAP: (Auto-calculated)</label>
                    <div className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-gray-400 font-mono">
                      {derivedValues.dailyRewardsCap.toFixed(2)} KILT/day
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      = {treasuryConfig.totalAllocation.toLocaleString()} ÷ {treasuryConfig.programDurationDays} days
                    </div>
                  </div>

                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">PROGRAM_START_DATE:</label>
                    <input
                      type="date"
                      value={treasuryConfig.programStartDate || ''}
                      onChange={(e) => setTreasuryConfig({
                        ...treasuryConfig,
                        programStartDate: e.target.value
                      })}
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-green-400 text-sm mb-2 font-mono">PROGRAM_END_DATE: (Auto-calculated)</label>
                    <div className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-gray-400 font-mono">
                      {derivedValues.programEndDate || 'dd/mm/yyyy'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      = Start Date + {treasuryConfig.programDurationDays} days
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveTreasury}
                  disabled={treasuryMutation.isPending}
                  className="mt-6 px-6 py-3 bg-green-400 text-black font-mono font-bold rounded hover:bg-green-300 transition-colors disabled:opacity-50"
                >
                  {treasuryMutation.isPending ? '[UPDATING...]' : '[UPDATE_TREASURY]'}
                </button>
              </div>
            </div>
          )}

          {/* Program Settings */}
          {activeTab === 'settings' && !settingsLoading && (
            <div className="space-y-6">
              {/* Reward Formula Explanation */}
              <div className="bg-black/60 border border-[#ff0066] rounded p-6">
                <h2 className="text-lg font-bold text-[#ff0066] mb-4 tracking-wider">
                  [REWARD_FORMULA_SPECIFICATION]
                </h2>
                
                <div className="bg-gray-900/80 border border-green-400/30 rounded p-4 mb-4">
                  <div className="text-green-400 font-mono text-sm mb-2">
                    MATHEMATICAL FORMULA:
                  </div>
                  <div className="text-white font-mono text-lg bg-black/50 p-3 rounded border border-green-400/20">
                    R_u = (L_u/L_T) × (1 + ((D_u/P) × b_time)) × IRM × FRB × (R/P)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="text-green-400 font-mono">FORMULA COMPONENTS:</div>
                    <div className="text-gray-300 space-y-1 font-mono">
                      <div>R_u = Daily user rewards (KILT)</div>
                      <div>L_u = User liquidity amount (USD)</div>
                      <div>L_T = Total pool liquidity (USD)</div>
                      <div>D_u = Days actively providing liquidity</div>
                      <div>P = Program duration (days)</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-green-400 font-mono">MULTIPLIERS:</div>
                    <div className="text-gray-300 space-y-1 font-mono">
                      <div>b_time = Time boost coefficient</div>
                      <div>IRM = In-range multiplier (0.7-1.0)</div>
                      <div>FRB = Full range bonus multiplier</div>
                      <div>R/P = Daily reward budget allocation</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/50 border border-green-400 rounded p-6">
                <h2 className="text-lg font-bold text-[#ff0066] mb-4 tracking-wider">
                  [REWARD_ALGORITHM_PARAMETERS]
                </h2>
                
                <div className="grid grid-cols-1 gap-6">
                  {/* Time Boost Coefficient */}
                  <div className="border border-green-400/30 rounded p-4 bg-gray-900/30">
                    <label className="block text-green-400 text-sm mb-2 font-mono">TIME_BOOST_COEFFICIENT (b_time):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={programSettings.timeBoostCoefficient || ''}
                      onChange={(e) => setProgramSettings({
                        ...programSettings,
                        timeBoostCoefficient: Number(e.target.value) || 0
                      })}
                      placeholder="e.g. 0.6"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none mb-2"
                    />
                    <div className="text-gray-400 text-xs font-mono">
                      Controls time-based reward growth. Value of 0.6 means users get 100% base rewards on day 1, growing to 160% at program completion. Higher values = steeper time progression.
                    </div>
                    <div className="text-green-400 text-xs mt-1 font-mono">
                      Current: {programSettings.timeBoostCoefficient}x → {(100 + programSettings.timeBoostCoefficient * 100).toFixed(0)}% max boost
                    </div>
                  </div>

                  {/* Full Range Bonus */}
                  <div className="border border-green-400/30 rounded p-4 bg-gray-900/30">
                    <label className="block text-green-400 text-sm mb-2 font-mono">FULL_RANGE_BONUS (FRB):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={programSettings.fullRangeBonus || ''}
                      onChange={(e) => setProgramSettings({
                        ...programSettings,
                        fullRangeBonus: Number(e.target.value) || 0
                      })}
                      placeholder="e.g. 1.2"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none mb-2"
                    />
                    <div className="text-gray-400 text-xs font-mono">
                      Bonus multiplier for full-range (50/50) liquidity positions. Encourages balanced liquidity provision. Concentrated positions get 1.0x, full-range gets this multiplier.
                    </div>
                    <div className="text-green-400 text-xs mt-1 font-mono">
                      Current: Full-range positions get {((programSettings.fullRangeBonus - 1) * 100).toFixed(0)}% bonus vs concentrated
                    </div>
                  </div>

                  {/* Minimum Position Value */}
                  <div className="border border-green-400/30 rounded p-4 bg-gray-900/30">
                    <label className="block text-green-400 text-sm mb-2 font-mono">MIN_POSITION_VALUE (USD):</label>
                    <input
                      type="number"
                      value={programSettings.minimumPositionValue || ''}
                      onChange={(e) => setProgramSettings({
                        ...programSettings,
                        minimumPositionValue: Number(e.target.value) || 0
                      })}
                      placeholder="e.g. 10"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none mb-2"
                    />
                    <div className="text-gray-400 text-xs font-mono">
                      Anti-spam protection: Minimum liquidity value required for reward eligibility. Prevents dust attacks and spam positions from consuming rewards.
                    </div>
                    <div className="text-green-400 text-xs mt-1 font-mono">
                      Current: ${programSettings.minimumPositionValue} minimum to earn rewards
                    </div>
                  </div>

                  {/* Lock Period */}
                  <div className="border border-green-400/30 rounded p-4 bg-gray-900/30">
                    <label className="block text-green-400 text-sm mb-2 font-mono">LOCK_PERIOD_DAYS:</label>
                    <input
                      type="number"
                      value={programSettings.lockPeriod || ''}
                      onChange={(e) => setProgramSettings({
                        ...programSettings,
                        lockPeriod: Number(e.target.value) || 0
                      })}
                      placeholder="e.g. 7"
                      className="w-full p-3 bg-gray-900 border border-green-400/50 rounded text-green-400 font-mono focus:border-green-400 focus:outline-none mb-2"
                    />
                    <div className="text-gray-400 text-xs font-mono">
                      Commitment period required before rewards become claimable. Encourages longer-term liquidity provision and reduces reward dumping.
                    </div>
                    <div className="text-green-400 text-xs mt-1 font-mono">
                      Current: {programSettings.lockPeriod} days commitment before claiming
                    </div>
                  </div>
                </div>

                {/* Live Formula Preview */}
                <div className="mt-6 bg-gray-900/80 border border-[#ff0066]/30 rounded p-4">
                  <div className="text-[#ff0066] font-mono text-sm mb-2">
                    LIVE FORMULA PREVIEW:
                  </div>
                  <div className="text-white font-mono text-sm bg-black/50 p-3 rounded border border-green-400/20">
                    R_u = (L_u/L_T) × (1 + ((D_u/{treasuryConfig.programDurationDays}) × {programSettings.timeBoostCoefficient})) × IRM × {programSettings.fullRangeBonus} × ({derivedValues.dailyRewardsCap}/day)
                  </div>
                  <div className="text-gray-400 text-xs mt-2 font-mono">
                    This formula runs in real-time across the main application. Changes here immediately affect all reward calculations, APR displays, and user earnings.
                  </div>
                </div>

                {/* Data Flow Documentation */}
                <div className="mt-6 bg-gray-900/60 border border-green-400/20 rounded p-4">
                  <div className="text-green-400 font-mono text-sm mb-3">
                    [SINGLE_SOURCE_OF_TRUTH_DATA_FLOW]
                  </div>
                  <div className="space-y-2 text-xs font-mono text-gray-300">
                    <div className="flex items-center">
                      <span className="text-[#ff0066] mr-2">1.</span>
                      <span>Admin Panel Parameters → PostgreSQL Database (treasury_config & program_settings tables)</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-[#ff0066] mr-2">2.</span>
                      <span>Fixed Reward Service → Reads admin configuration via getAdminConfiguration()</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-[#ff0066] mr-2">3.</span>
                      <span>Main App Components → Use unified dashboard hook to get real-time APR calculations</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-[#ff0066] mr-2">4.</span>
                      <span>User Interface → Displays live values from formula-based-apr-service.ts</span>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-black/40 border border-green-400/20 rounded">
                    <div className="text-green-400 text-xs font-mono">
                      ✓ No hardcoded values in main app &nbsp; ✓ Admin panel is single source of truth &nbsp; ✓ Real-time synchronization
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={settingsMutation.isPending}
                  className="mt-6 px-6 py-3 bg-[#ff0066] text-white font-mono font-bold rounded hover:bg-[#ff0066]/80 transition-colors disabled:opacity-50"
                >
                  {settingsMutation.isPending ? '[UPDATING...]' : '[UPDATE_PARAMETERS]'}
                </button>
              </div>
            </div>
          )}

          {/* Blockchain Configuration */}
          {activeTab === 'blockchain' && (
            <div className="space-y-6">
              <BlockchainConfigPanel />
            </div>
          )}

          {/* Smart Contract Management */}
          {activeTab === 'contract' && (
            <div className="space-y-6">
              <SmartContractPanel />
            </div>
          )}

          {/* Operations Log */}
          {activeTab === 'operations' && (
            <div className="space-y-6">
              <div className="bg-black/50 border border-green-400 rounded p-6">
                <h2 className="text-lg font-bold text-[#ff0066] mb-4 tracking-wider">
                  [SYSTEM_OPERATIONS_HISTORY]
                </h2>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(operations as any[]).length === 0 ? (
                    <div className="text-green-400/50 font-mono text-sm">
                      [NO_OPERATIONS_LOGGED]
                    </div>
                  ) : (
                    (operations as any[]).map((op: any, index: number) => (
                      <div
                        key={index}
                        className="border border-green-400/30 rounded p-3 bg-gray-900/50"
                      >
                        <div className="flex justify-between items-start text-sm">
                          <div className="text-green-400 font-mono">
                            [{op.action}]
                          </div>
                          <div className="text-green-400/50 font-mono">
                            {new Date(op.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {op.details && (
                          <div className="text-green-400/70 font-mono text-xs mt-1">
                            {op.details}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}