import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export function useBaseNetwork() {
  const chainId = useChainId();
  const { isConnected, address } = useAccount();
  const { switchChain } = useSwitchChain();

  const isOnBase = chainId === base.id;
  const shouldSwitchToBase = isConnected && !isOnBase;

  const switchToBase = async () => {
    try {
      console.log(`🔄 NETWORK FIX: Attempting to switch from chain ${chainId} to Base (${base.id})`);
      
      // First try wagmi's switchChain
      await switchChain({ chainId: base.id });
      
      // Verify the switch was successful
      const newChainId = await window.ethereum?.request({ method: 'eth_chainId' });
      const newChainIdDecimal = parseInt(newChainId, 16);
      
      if (newChainIdDecimal === base.id) {
        console.log(`✅ NETWORK FIX: Successfully switched to Base (${base.id})`);
        toast({
          title: "Switched to Base",
          description: "Successfully switched to Base network",
        });
      } else {
        throw new Error(`Chain switch failed - still on chain ${newChainIdDecimal}`);
      }
    } catch (error: any) {
      console.error('Failed to switch to Base:', error);
      
      // Try direct MetaMask method as fallback
      try {
        console.log(`🔄 NETWORK FIX: Trying direct MetaMask chain switch...`);
        await window.ethereum?.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }], // Base chain ID in hex
        });
        
        toast({
          title: "Switched to Base",
          description: "Successfully switched to Base network via MetaMask",
        });
      } catch (switchError: any) {
        // If chain doesn't exist, try to add it
        if (switchError.code === 4902) {
          try {
            console.log(`🔄 NETWORK FIX: Adding Base network to wallet...`);
            await window.ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                rpcUrls: ['https://mainnet.base.org'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
            
            toast({
              title: "Base Network Added",
              description: "Base network added to wallet and switched successfully",
            });
          } catch (addError) {
            console.error('Failed to add Base network:', addError);
            toast({
              title: "CRITICAL: Manual Network Switch Required",
              description: "Your wallet is on Ethereum mainnet (chain 1) but KILT Portal requires Base network (chain 8453). Please manually switch to Base in your wallet settings.",
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "CRITICAL: Manual Network Switch Required", 
            description: "Your wallet is on Ethereum mainnet (chain 1) but KILT Portal requires Base network (chain 8453). Please manually switch to Base in your wallet settings.",
            variant: "destructive",
          });
        }
      }
    }
  };

  // Auto-switch to Base when wallet connects - more aggressive detection
  useEffect(() => {
    if (shouldSwitchToBase && address) {
      console.log(`🚨 CHAIN MISMATCH DETECTED: User on chain ${chainId}, need Base (${base.id})`);
      
      // Immediate switch attempt
      switchToBase();
      
      // Also set up a backup timer for persistent switching
      const timer = setTimeout(() => {
        if (chainId !== base.id) {
          console.log(`🚨 PERSISTENT CHAIN ISSUE: Still on wrong chain ${chainId}, retrying...`);
          switchToBase();
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [shouldSwitchToBase, address, chainId]);
  
  // Additional effect to monitor chain changes and alert user
  useEffect(() => {
    if (isConnected && chainId !== base.id) {
      console.log(`⚠️ WRONG NETWORK: Connected to chain ${chainId}, but need Base (${base.id})`);
      
      // Show persistent warning for wrong network
      const warningTimer = setTimeout(() => {
        if (chainId !== base.id) {
          toast({
            title: "Wrong Network Detected",
            description: `You're connected to chain ${chainId} but KILT Portal requires Base network (${base.id}). Transactions will fail until you switch.`,
            variant: "destructive",
          });
        }
      }, 3000);
      
      return () => clearTimeout(warningTimer);
    }
  }, [isConnected, chainId]);

  return {
    isOnBase,
    shouldSwitchToBase,
    switchToBase,
    baseChainId: base.id,
    currentChainId: chainId
  };
}