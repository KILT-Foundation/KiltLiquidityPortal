import { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

// Manual disconnect flag to prevent auto-reconnection
const MANUAL_DISCONNECT_KEY = 'kilt-manual-disconnect';

export function useManualDisconnect() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  // Check if user manually disconnected
  const isManuallyDisconnected = () => {
    return localStorage.getItem(MANUAL_DISCONNECT_KEY) === 'true';
  };

  // Set manual disconnect flag
  const setManualDisconnect = () => {
    localStorage.setItem(MANUAL_DISCONNECT_KEY, 'true');
  };

  // Clear manual disconnect flag (when user wants to connect)
  const clearManualDisconnect = () => {
    localStorage.removeItem(MANUAL_DISCONNECT_KEY);
  };

  // Enhanced disconnect with cache clearing
  const disconnectWithCacheClearing = () => {
    // Set manual disconnect flag
    setManualDisconnect();
    
    // Clear all wallet-related localStorage
    localStorage.removeItem('wagmi.connected');
    localStorage.removeItem('wagmi.store');
    localStorage.removeItem('wagmi.cache');
    localStorage.removeItem('wagmi.injected.shimDisconnect');
    
    // Clear Phantom-specific storage
    if ((window as any).phantom?.ethereum) {
      try {
        (window as any).phantom.ethereum.disconnect?.();
      } catch (error) {
        console.log('Phantom disconnect not available');
      }
    }
    
    // Clear other wallet-specific storage
    if ((window as any).ethereum) {
      try {
        // Clear MetaMask connection cache
        (window as any).ethereum._metamask?.isUnlocked?.()?.then(() => {
          (window as any).ethereum?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] });
        });
      } catch (error) {
        console.log('MetaMask permission revoke not available');
      }
    }
    
    disconnect();
  };

  // Prevent auto-reconnection if user manually disconnected
  useEffect(() => {
    if (isConnected && isManuallyDisconnected()) {
      console.log('Preventing auto-reconnection - user manually disconnected');
      disconnect();
    }
  }, [isConnected, disconnect]);

  return {
    isManuallyDisconnected,
    setManualDisconnect,
    clearManualDisconnect,
    disconnectWithCacheClearing
  };
}