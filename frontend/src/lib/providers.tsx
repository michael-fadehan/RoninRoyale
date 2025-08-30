'use client';

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './reown';

// Optimized QueryClient for faster wallet state sync
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce stale time for wallet-related queries to get faster updates
      staleTime: 1000, // 1 second
      // Cache wallet data longer to avoid re-fetching
      gcTime: 1000 * 60 * 5, // 5 minutes (was cacheTime in older versions)
      // Retry failed queries less aggressively for faster UX
      retry: 1,
      // Reduce retry delay
      retryDelay: 500,
      // Enable background refetching for wallet state
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Reduce refetch interval for real-time wallet updates
      refetchInterval: false, // Disable automatic refetching to improve performance
    },
    mutations: {
      retry: 1,
      retryDelay: 500,
    },
  },
});

export function Providers({ children }: { children: any }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}


