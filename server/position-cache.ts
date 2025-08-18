import { LRUCache } from 'lru-cache';

// Cache for position data to reduce blockchain calls
const positionCache = new LRUCache<string, any>({
  max: 1000, // Cache up to 1000 positions
  ttl: 1000 * 60 * 2, // 2 minutes TTL
});

export const getCachedPosition = (tokenId: string) => {
  return positionCache.get(tokenId);
};

export const setCachedPosition = (tokenId: string, positionData: any) => {
  positionCache.set(tokenId, positionData);
};

export const clearPositionCache = () => {
  positionCache.clear();
};