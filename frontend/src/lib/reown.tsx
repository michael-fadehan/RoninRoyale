'use client';

import { createConfig, http } from 'wagmi';
import { mainnet, arbitrum, polygon } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// Ronin Saigon Testnet - Enhanced with proper chain configuration
const roninSaigon = {
  id: 2021,
  name: 'Ronin Saigon Testnet',
  network: 'ronin-testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
    public: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Ronin Explorer', url: 'https://saigon-explorer.roninchain.com' }
  },
  testnet: true,
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

// Enhanced wagmi config with better chain management
export const config = createConfig({
  chains: [roninSaigon, mainnet, arbitrum, polygon],
  connectors: [
    walletConnect({
      projectId,
      metadata,
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark',
        themeVariables: {
          '--wcm-z-index': '9999'
        }
      }
    }),
    injected({
      shimDisconnect: true,
      target: 'metaMask'
    }),
    coinbaseWallet({
      appName: metadata.name,
      appLogoUrl: metadata.icons[0]
    })
  ],
  transports: {
    [roninSaigon.id]: http('https://saigon-testnet.roninchain.com/rpc', {
      batch: true,
      fetchOptions: {
        timeout: 15000, // Increased timeout for better reliability
      },
      retryCount: 3,
      retryDelay: 1000,
    }),
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
  },
  ssr: true,
  // Enhanced storage with better error handling
  storage: typeof window !== 'undefined' ? {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('Failed to get item from localStorage:', e);
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Failed to set item in localStorage:', e);
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to remove item from localStorage:', e);
      }
    },
  } : undefined,
});

// Export the Ronin Saigon chain for use in other components
export { roninSaigon };
