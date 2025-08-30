'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, polygon } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// Ronin Saigon Testnet
const roninSaigon = {
  id: 2021,
  name: 'Ronin Saigon',
  network: 'ronin-testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
    public: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://saigon-explorer.roninchain.com' }
  },
} as const;

// Get projectId from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');
}

// Set up metadata
const metadata = {
  name: 'Ronin Royale',
  description: 'Ronin dApp with NFT Farming, Staking, and Games',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://roninroyale.com',
  icons: ['/assets/Logo.png']
};

// Create wagmi config with optimizations for faster connection
export const config = createConfig({
  chains: [roninSaigon, mainnet, arbitrum, polygon],
  connectors: [
    walletConnect({
      projectId,
      metadata,
      showQrModal: true
    }),
    injected({
      shimDisconnect: true,
      // Optimize injected connector for faster detection
      target: 'metaMask'
    }),
    coinbaseWallet({
      appName: metadata.name,
      appLogoUrl: metadata.icons[0]
    })
  ],
  transports: {
    [roninSaigon.id]: http('https://saigon-testnet.roninchain.com/rpc', {
      // Add connection optimizations
      batch: true,
      fetchOptions: {
        timeout: 10000, // 10 second timeout
      },
    }),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
  ssr: true,
  // Add storage for connection persistence
  storage: typeof window !== 'undefined' ? {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  } : undefined,
});
