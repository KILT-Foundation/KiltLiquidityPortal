import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWagmiWallet } from './use-wagmi-wallet';

interface PositionRegistrationData {
  nftTokenId: string;
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  amount0: string;
  amount1: string;
  minPrice: string;
  maxPrice: string;
  liquidity: string;
  currentValueUSD: number;
  feeTier: number;
  createdAt: Date;
  creationBlockNumber?: number;
  creationTransactionHash?: string;
}

interface PositionRegistrationResult {
  success: boolean;
  positionId?: number;
  message: string;
  alreadyRegistered?: boolean;
  eligibilityStatus: 'eligible' | 'ineligible' | 'pending';
  validationResult?: any;
  liquidityTypeResult?: any;
  rewardInfo?: {
    dailyRewards: number;
    estimatedAPR: number;
    lockPeriodDays: number;
  };
}

export const usePositionRegistration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address } = useWagmiWallet();
  
  const registerPositionMutation = useMutation({
    mutationFn: async (positionData: PositionRegistrationData): Promise<PositionRegistrationResult> => {
      if (!address) throw new Error('Wallet not connected');
      
      // Get user ID from the address (assuming we have a user lookup)
      const userResponse = await fetch(`/api/users/${address}`);
      const userData = await userResponse.json();
      
      const requestData = {
        userId: userData.id,
        userAddress: address,
        nftTokenId: positionData.nftTokenId,
        poolAddress: positionData.poolAddress,
        token0Address: positionData.token0Address,
        token1Address: positionData.token1Address,
        amount0: positionData.amount0,
        amount1: positionData.amount1,
        minPrice: positionData.minPrice,
        maxPrice: positionData.maxPrice,
        liquidity: positionData.liquidity,
        currentValueUSD: positionData.currentValueUSD,
        feeTier: positionData.feeTier,
        originalCreationDate: positionData.createdAt,
        verificationProof: null // Can be added later if needed
      };
      
      const response = await fetch('/api/positions/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to register position');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Position Registered",
          description: result.message,
        });
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        queryClient.invalidateQueries({ queryKey: ['user-positions'] });
        queryClient.invalidateQueries({ queryKey: ['rewards'] });
      } else {
        toast({
          title: "Registration Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Registration Error",
        description: error.message || "Failed to register position",
        variant: "destructive",
      });
    },
  });

  const registerPosition = async (positionData: PositionRegistrationData) => {
    return registerPositionMutation.mutateAsync(positionData);
  };

  return {
    registerPosition,
    isRegistering: registerPositionMutation.isPending,
  };
};