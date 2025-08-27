'use client';

import React from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
// import connectors from package root (some versions export via root)
let InjectedConnectorClass: any = null;
let WalletConnectConnectorClass: any = null;
try {
  // @ts-ignore
  const pkg = require('@wagmi/connectors');
  const root = pkg?.default || pkg;
  InjectedConnectorClass = root?.InjectedConnector || root?.injected || null;
  WalletConnectConnectorClass = root?.WalletConnectConnector || root?.walletConnect || null;
} catch (e) {
  // ignore - fallback
}

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const chains: any = [mainnet];

// create a stable config per wagmi docs; cast to any to avoid type mismatch
export const config: any = (createConfig as any)({
  chains,
  transports: {
    [mainnet.id]: (http as any)(),
  },
  autoConnect: true,
});

export const injectedConnector = InjectedConnectorClass ? new InjectedConnectorClass({ chains } as any) : ({} as any);
export const walletConnectConnector = WalletConnectConnectorClass ? new WalletConnectConnectorClass({ chains, options: { projectId } } as any) : ({} as any);

export function ReownProviders({ children }: { children: any }) {
  return <WagmiProvider config={config}>{children}</WagmiProvider>;
}
