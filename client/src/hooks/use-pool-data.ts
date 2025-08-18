import { useQuery } from '@tanstack/react-query';
// Pool address now managed via blockchain configuration service

export function usePoolData() {
  return useQuery({
    queryKey: [`/api/pool/current`],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useUserPositions(userId: number | null) {
  return useQuery({
    queryKey: [`/api/positions/user/${userId}`],
    enabled: !!userId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export function useUserRewards(userId: number | null) {
  return useQuery({
    queryKey: [`/api/rewards/user/${userId}`],
    enabled: !!userId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}
