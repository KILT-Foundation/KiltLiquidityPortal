import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWagmiWallet } from './use-wagmi-wallet';
import { useToast } from './use-toast';

interface AppSession {
  sessionId: string;
  userId: number;
  userAddress: string;
  expiresAt: string;
  isActive: boolean;
}

interface AppTransaction {
  id: number;
  sessionId: string;
  transactionHash: string;
  transactionType: string;
  nftTokenId?: string;
  poolAddress: string;
  verificationStatus: string;
  createdAt: string;
}

export function useAppSession() {
  const { address } = useWagmiWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get current session
  const { data: session, isLoading } = useQuery<AppSession | null>({
    queryKey: ['app-session', address],
    queryFn: async () => {
      if (!address) return null;
      
      try {
        const response = await fetch(`/api/app-sessions/current/${address}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to fetch session');
        }
        return response.json();
      } catch (error) {
        console.warn('No active session found');
        return null;
      }
    },
    enabled: !!address,
  });

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async ({ userId, userAddress }: { userId: number; userAddress: string }) => {
      const response = await fetch('/api/app-sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      queryClient.invalidateQueries({ queryKey: ['app-session'] });
      toast({
        title: "Session Created",
        description: "App session created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Session Error",
        description: "Failed to create app session",
        variant: "destructive",
      });
    },
  });

  // Record transaction mutation
  const recordTransactionMutation = useMutation({
    mutationFn: async (transactionData: {
      sessionId: string;
      transactionHash: string;
      transactionType: string;
      nftTokenId?: string;
      poolAddress: string;
      amount0?: string;
      amount1?: string;
      liquidityAmount?: string;
    }) => {
      const response = await fetch('/api/app-transactions/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to record transaction');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-transactions'] });
      toast({
        title: "Transaction Recorded",
        description: "Transaction recorded for reward eligibility",
      });
    },
    onError: (error) => {
      toast({
        title: "Recording Error",
        description: "Failed to record transaction",
        variant: "destructive",
      });
    },
  });

  // Auto-set session ID when session is loaded
  useEffect(() => {
    if (session?.sessionId) {
      setSessionId(session.sessionId);
    }
  }, [session]);

  // Create session callback
  const createAppSession = useCallback(async (userId: number, userAddress: string) => {
    return createSessionMutation.mutateAsync({ userId, userAddress });
  }, [createSessionMutation]);

  // Record transaction callback
  const recordAppTransaction = useCallback(async (transactionData: {
    transactionHash: string;
    transactionType: string;
    nftTokenId?: string;
    poolAddress: string;
    amount0?: string;
    amount1?: string;
    liquidityAmount?: string;
  }) => {
    if (!sessionId) {
      throw new Error('No active session');
    }

    return recordTransactionMutation.mutateAsync({
      sessionId,
      ...transactionData,
    });
  }, [sessionId, recordTransactionMutation]);

  return {
    session,
    sessionId,
    isLoading,
    createAppSession,
    recordAppTransaction,
    isCreatingSession: createSessionMutation.isPending,
    isRecordingTransaction: recordTransactionMutation.isPending,
  };
}