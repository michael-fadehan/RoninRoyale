'use client';

import React from 'react';
import { useAccount, useDisconnect, useEnsName } from 'wagmi';
import { useBalance } from 'wagmi';
import { useWalletContext } from '../lib/wallet-context';
import { roninSaigon } from '../lib/reown';
import WalletSelectionModal from './WalletSelectionModal';

interface WalletHeaderProps {
  showBalance?: boolean;
}

export default function WalletHeader({ showBalance = true }: WalletHeaderProps) {
  const { address, isConnected, chainId } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: false }
  });
  const { disconnect } = useDisconnect();
  const { data: ronBalance } = useBalance({ address, chainId: 2021 });
  const { isWalletModalOpen, setWalletModalOpen, switchError, isAutoSwitching, isInitialized } = useWalletContext();

  function shortenAddress(addr?: string) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  const isOnCorrectNetwork = chainId === roninSaigon.id;

  return (
    <>
      <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        width: '100%',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#000000',
        padding: '0 32px',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Logo and Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <img src="/assets/Logo.png" alt="Logo" style={{ width: 58, height: 58 }} />
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          <a href="/" className="nav-link">Home</a>
          <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
          <a href="/staking" className="nav-link">Staking</a>
          <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
          <a href="/#quest" className="nav-link">Quest</a>
          <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
          <a href="/#casino" className="nav-link">Casino</a>
          <span style={{ width: 1, height: 24, background: '#666', margin: '0 12px' }} />
          <a href="/profile" className="nav-link">Profile</a>
        </nav>
      </div>

      {/* Wallet Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {!isInitialized ? (
          <div style={{
            padding: '10px 14px',
            color: '#aaa',
            fontSize: 14
          }}>
            Loading...
          </div>
        ) : !isConnected ? (
          <button 
            className="connect-btn" 
            onClick={() => setWalletModalOpen(true)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 800,
              color: '#fff',
              background: '#7e50ff',
              border: 0,
              boxShadow: '0 10px 24px rgba(126,80,255,0.35)',
              cursor: 'pointer'
            }}
          >
            CONNECT WALLET
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Wallet Address/ENS */}
            <button 
              onClick={() => setWalletModalOpen(true)}
              style={{
                background: isOnCorrectNetwork ? 'transparent' : 'rgba(255,179,0,0.1)',
                color: isOnCorrectNetwork ? '#fff' : '#ffb300',
                border: `1px solid ${isOnCorrectNetwork ? 'rgba(255,255,255,0.08)' : 'rgba(255,179,0,0.3)'}`,
                borderRadius: 6,
                padding: '8px 16px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {!isOnCorrectNetwork && <span style={{ fontSize: 12 }}>⚠</span>}
              {ensName ?? shortenAddress(address)}
            </button>

            {/* Balance Display */}
            {showBalance && (
              <div style={{ 
                color: '#B2FF59', 
                fontWeight: 800,
                fontSize: 14
              }}>
                {ronBalance ? `${Number(ronBalance.formatted).toFixed(4)} RON` : '...'}
              </div>
            )}

            {/* Network Warning */}
            {!isOnCorrectNetwork && (
              <div style={{
                color: '#ffb300',
                fontSize: 12,
                fontWeight: 600,
                background: 'rgba(255,179,0,0.1)',
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid rgba(255,179,0,0.3)'
              }}>
                Wrong Network
              </div>
            )}

            {/* Status Indicators */}
            {(switchError || isAutoSwitching) && (
              <div style={{
                color: isAutoSwitching ? '#ffb300' : '#ff6b6b',
                fontSize: 12,
                fontWeight: 600
              }}>
                {isAutoSwitching ? 'Switching...' : 'Network Error'}
              </div>
            )}

            {/* Disconnect Button */}
            <button 
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <style>{`
        .nav-link {
          text-decoration: none;
          color: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          font-weight: 700;
        }
        .nav-link:hover {
          background: rgba(255,255,255,0.16);
          color: #ffffff;
        }
      `}</style>
      </header>
      
      <WalletSelectionModal
        open={isWalletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </>
  );
}