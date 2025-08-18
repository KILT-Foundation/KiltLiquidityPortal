import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BlockchainConfig {
  id: number;
  configKey: string;
  configValue: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GroupedConfigs {
  [category: string]: BlockchainConfig[];
}

export function BlockchainConfigPanel() {
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch blockchain configurations
  const { data: configData, isLoading, error } = useQuery({
    queryKey: ['/api/admin/blockchain-config'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ configKey, configValue, description, category }: {
      configKey: string;
      configValue: string;
      description?: string;
      category?: string;
    }) => {
      const response = await fetch('/api/admin/blockchain-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configKey, configValue, description, category })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Configuration update failed:', errorData.error || 'Failed to update configuration');
        return;
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/blockchain-config'] });
      setEditingConfig(null);
      setNewValues({});
    },
    onError: (error) => {
      console.warn('Failed to update blockchain configuration (gracefully handled):', error);
    }
  });

  const handleSaveConfig = async (configKey: string, config: BlockchainConfig) => {
    const newValue = newValues[configKey] || config.configValue;
    
    if (newValue !== config.configValue) {
      await updateConfigMutation.mutateAsync({
        configKey,
        configValue: newValue,
        description: config.description || undefined,
        category: config.category
      });
    } else {
      setEditingConfig(null);
    }
  };

  const handleCancelEdit = (configKey: string) => {
    setEditingConfig(null);
    setNewValues(prev => {
      const updated = { ...prev };
      delete updated[configKey];
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-black/90 border border-green-400 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[#ff0066] mb-4">
          ◢◤ BLOCKCHAIN CONFIGURATION ◥◣
        </h3>
        <div className="text-green-400 font-mono text-sm">
          [LOADING_CONFIGURATION...]
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-black/90 border border-red-500 rounded-lg p-6">
        <h3 className="text-xl font-bold text-[#ff0066] mb-4">
          ◢◤ BLOCKCHAIN CONFIGURATION ◥◣
        </h3>
        <div className="text-red-400 font-mono text-sm">
          [ERROR] Failed to load blockchain configuration
        </div>
      </div>
    );
  }

  const groupedConfigs: GroupedConfigs = (configData as any)?.configs || {};

  return (
    <div className="bg-black/90 border border-green-400 rounded-lg p-6">
      <h3 className="text-xl font-bold text-[#ff0066] mb-4 tracking-wider">
        ◢◤ BLOCKCHAIN CONFIGURATION ◥◣
      </h3>
      
      <div className="text-green-400 text-sm mb-6 font-mono">
        [SYSTEM_CONFIG_MANAGEMENT] Dynamic blockchain parameter control
      </div>

      <div className="space-y-6">
        {Object.entries(groupedConfigs).map(([category, configs]) => (
          <div key={category} className="space-y-3">
            <h4 className="text-[#ff0066] font-bold uppercase tracking-wider text-sm">
              {category.toUpperCase()} PARAMETERS
            </h4>
            
            {configs.map((config) => (
              <div key={config.configKey} className="bg-gray-900/50 border border-green-400/30 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-green-400 font-mono text-sm font-bold">
                      {config.configKey}
                    </div>
                    {config.description && (
                      <div className="text-green-400/70 text-xs mt-1">
                        {config.description}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {editingConfig === config.configKey ? (
                      <>
                        <button
                          onClick={() => handleSaveConfig(config.configKey, config)}
                          disabled={updateConfigMutation.isPending}
                          className="px-3 py-1 bg-green-600 text-black text-xs font-bold rounded hover:bg-green-500 transition-colors disabled:opacity-50"
                        >
                          SAVE
                        </button>
                        <button
                          onClick={() => handleCancelEdit(config.configKey)}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-500 transition-colors"
                        >
                          CANCEL
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingConfig(config.configKey);
                          setNewValues(prev => ({ ...prev, [config.configKey]: config.configValue }));
                        }}
                        className="px-3 py-1 bg-[#ff0066] text-white text-xs font-bold rounded hover:bg-[#ff0066]/80 transition-colors"
                      >
                        EDIT
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-2">
                  {editingConfig === config.configKey ? (
                    <input
                      type="text"
                      value={newValues[config.configKey] || config.configValue}
                      onChange={(e) => setNewValues(prev => ({ ...prev, [config.configKey]: e.target.value }))}
                      className="w-full bg-black border border-green-400/50 rounded px-3 py-2 text-green-400 font-mono text-sm focus:border-green-400 focus:outline-none"
                      placeholder="Enter configuration value..."
                    />
                  ) : (
                    <div className="bg-black/50 border border-green-400/30 rounded px-3 py-2 text-green-400 font-mono text-sm break-all">
                      {config.configValue}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Important Security Notice */}
      <div className="mt-6 p-4 bg-red-900/20 border border-red-500/50 rounded">
        <div className="text-red-400 text-xs font-mono">
          <div className="font-bold mb-1">[CRITICAL_SECURITY_NOTICE]</div>
          <div>
            Changing blockchain configuration will affect all app operations.
            Ensure addresses are valid and verified before saving changes.
            Invalid configurations may cause system failures.
          </div>
        </div>
      </div>
    </div>
  );
}