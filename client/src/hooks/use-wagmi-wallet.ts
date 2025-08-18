import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { base } from 'wagmi/chains';

export function useWagmiWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    connectors,
    chainId: base.id,
  };
}