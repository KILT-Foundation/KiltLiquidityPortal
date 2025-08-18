import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options?: {
    method?: string;
    data?: unknown;
  }
): Promise<T> {
  const headers: HeadersInit = options?.data ? { "Content-Type": "application/json" } : {};
  
  // Add admin token for admin routes
  if (url.includes('/api/admin/')) {
    const adminToken = localStorage.getItem('admin-token');
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }, 30000); // 30 second timeout for position loading

    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers,
      body: options?.data ? JSON.stringify(options.data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    await throwIfResNotOk(res);
    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Request timed out:', url);
      throw new Error('Request timeout after 25 seconds');
    }
    // Handle all errors gracefully to prevent runtime error overlays
    if (error instanceof Error) {
      console.warn('API request failed:', url, error.message);
      throw error;
    }
    console.warn('Unknown API error:', url, error);
    throw new Error('Unknown API error');
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    
    // Add admin token for admin routes
    if (typeof queryKey[0] === 'string' && queryKey[0].includes('/api/admin/')) {
      const adminToken = localStorage.getItem('admin-token');
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort('Request timeout after 25 seconds');
      }
    }, 25000); // 25 second timeout for query functions

    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Request timed out:', queryKey[0]);
        // Gracefully handle timeout errors without throwing
        const url = queryKey[0] as string;
        if (url.includes('program-analytics')) {
          return {
            totalLiquidity: 0,
            participantCount: 0,
            averageAPR: 0,
            totalRewardsDistributed: 0
          };
        }
        if (url.includes('positions/wallet')) {
          return [];
        }
        if (url.includes('user-apr')) {
          return { apr: 0, range: "0% - 0%" };
        }
        // For other endpoints, return null instead of throwing
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: 45 * 1000, // Auto-refresh every 45 seconds
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      staleTime: 1000 * 15, // 15 seconds for faster updates
      gcTime: 1000 * 60 * 5, // Keep cache for 5 minutes
      retry: (failureCount, error) => {
        // Retry network errors but not other types of errors
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          return failureCount < 2;
        }
        if (error instanceof Error && error.message.includes('Request timeout')) {
          return failureCount < 1;
        }
        return false;
      },

    },
    mutations: {
      retry: false,
    },
  },
});
