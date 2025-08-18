// Performance optimization utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Preload critical API endpoints
export const preloadCriticalData = async () => {
  const criticalEndpoints = [
    '/api/kilt-data',
    '/api/rewards/program-analytics',
    '/api/rewards/maximum-apr',
    '/api/blockchain-config'
  ];

  // Fire all requests simultaneously for faster loading
  await Promise.allSettled(
    criticalEndpoints.map(endpoint => 
      fetch(endpoint).then(res => res.json())
    )
  );
};

// Lazy load non-critical components  
import { lazy } from 'react';

export const lazyWithPreload = (importFunc: () => Promise<any>) => {
  const Component = lazy(importFunc);
  // Add preload functionality to lazy component
  (Component as any).preload = importFunc;
  return Component;
};