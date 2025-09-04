'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAccount, useDisconnect, useConnect, useSwitchChain } from 'wagmi';
import { roninSaigon } from './reown';

interface WalletContextType {
  isWalletModalOpen: boolean;
  setWalletModalOpen: (open: boolean) => void;
  isAutoSwitching: boolean;
  switchError: string | null;
  clearSwitchError: () => void;
  ensureCorrectNetwork: () => Promise<boolean>;
  isInitialized: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isWalletModalOpen, setWalletModalOpen] = useState(false);
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { disconnect } = useDisconnect();

  // Initialize the context after first render to avoid hydration issues
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const clearSwitchError = useCallback(() => {
    setSwitchError(null);
  }, []);

  // Function to ensure we're on the correct network
  const ensureCorrectNetwork = useCallback(async (): Promise<boolean> => {
    if (!isConnected || chainId === roninSaigon.id) {
      return true;
    }

    try {
      setIsAutoSwitching(true);
      setSwitchError(null);
      
      console.log(`Auto-switching from chain ${chainId} to Ronin Saigon (${roninSaigon.id})`);
      
      if (switchChain) {
        await switchChain({ chainId: roninSaigon.id });
        return true;
      } else {
        // Fallback to manual switch request
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${roninSaigon.id.toString(16)}` }],
          });
          return true;
        }
      }
      
      throw new Error('No method available to switch chains');
    } catch (error: any) {
      console.error('Failed to switch to Ronin Saigon:', error);
      
      // Try to add the network if it doesn't exist
      if (error.code === 4902 || error.message?.includes('Unrecognized chain ID')) {
        try {
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${roninSaigon.id.toString(16)}`,
                chainName: roninSaigon.name,
                nativeCurrency: roninSaigon.nativeCurrency,
                rpcUrls: roninSaigon.rpcUrls.default.http,
                blockExplorerUrls: [roninSaigon.blockExplorers.default.url],
              }],
            });
            return true;
          }
        } catch (addError) {
          console.error('Failed to add Ronin Saigon network:', addError);
          setSwitchError('Failed to add Ronin Saigon network. Please add it manually in your wallet.');
        }
      } else {
        setSwitchError('Please switch to Ronin Saigon network manually in your wallet.');
      }
      
      return false;
    } finally {
      setIsAutoSwitching(false);
    }
  }, [isConnected, chainId, switchChain]);

  // Auto-switch network when wallet connects or changes
  useEffect(() => {
    if (isConnected && chainId && chainId !== roninSaigon.id) {
      console.log('Wallet connected to wrong network, attempting auto-switch...');
      ensureCorrectNetwork();
    }
  }, [isConnected, chainId, ensureCorrectNetwork]);

  // Close wallet modal when successfully connected
  useEffect(() => {
    if (isConnected && isWalletModalOpen) {
      const timer = setTimeout(() => {
        setWalletModalOpen(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isWalletModalOpen]);

  // Clear errors when disconnecting
  useEffect(() => {
    if (!isConnected) {
      setSwitchError(null);
      setIsAutoSwitching(false);
    }
  }, [isConnected]);

  const value: WalletContextType = {
    isWalletModalOpen,
    setWalletModalOpen,
    isAutoSwitching,
    switchError,
    clearSwitchError,
    ensureCorrectNetwork,
    isInitialized,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}