'use client';

import React, { useState, useEffect } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';

interface WalletSelectionModalProps {
  open: boolean;
  onClose: () => void;
}

export default function WalletSelectionModal({ open, onClose }: WalletSelectionModalProps) {
  const { connect, connectors, isPending, error } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [connectingConnector, setConnectingConnector] = useState(null as string | null);

  // Close modal when successfully connected - faster response
  useEffect(() => {
    if (isConnected) {
      setConnectingConnector(null);
      // Faster close for better UX
      setTimeout(() => {
        onClose();
      }, 800); // Reduced from 1500ms to 800ms
    }
  }, [isConnected, onClose]);

  // Reset connecting state when modal closes
  useEffect(() => {
    if (!open) {
      setConnectingConnector(null);
    }
  }, [open]);

  const handleConnect = async (connector: any) => {
    try {
      setConnectingConnector(connector.id);
      
      if (connector.id === 'walletConnect') {
        // Close our modal completely and let WalletConnect handle its own modal
        onClose();
      }
      
      await connect({ connector });
      
      if (connector.id !== 'walletConnect') {
        // Don't close immediately, let the useEffect handle it
        // This prevents race conditions
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setConnectingConnector(null);
    }
  };


  const getWalletIcon = (connector: any) => {
    const connectorId = connector.id;
    const connectorName = connector.name?.toLowerCase() || '';
    
    // Handle specific connector IDs first
    switch (connectorId) {
      case 'walletConnect':
        return '/assets/walletconnect_icon.svg';
      case 'coinbaseWallet':
        return '/assets/coinbase_icon.svg';
      case 'injected':
        // For injected connectors, check the name to determine the specific wallet
        if (connectorName.includes('phantom')) {
          return '/assets/phantom_icon.svg';
        } else if (connectorName.includes('ronin')) {
          return '/assets/ronin_icon.png';
        } else if (connectorName.includes('metamask')) {
          return '/assets/metamask_icon.png';
        } else if (connectorName.includes('coinbase')) {
          return '/assets/coinbase_icon.svg';
        } else if (connectorName.includes('trust')) {
          return '/assets/trustwallet_icon.png';
        }
        // Default for injected
        return '/assets/metamask_icon.png';
      default:
        // Check connector name for other cases
        if (connectorName.includes('phantom')) {
          return '/assets/phantom_icon.svg';
        } else if (connectorName.includes('ronin')) {
          return '/assets/ronin_icon.png';
        } else if (connectorName.includes('coinbase')) {
          return '/assets/coinbase_icon.svg';
        } else if (connectorName.includes('trust')) {
          return '/assets/trustwallet_icon.png';
        }
        return '/assets/metamask_icon.png'; // fallback
    }
  };

  const getWalletName = (connector: any) => {
    switch (connector.id) {
      case 'injected':
        return 'MetaMask / Injected';
      case 'walletConnect':
        return 'WalletConnect';
      case 'coinbaseWallet':
        return 'Coinbase Wallet';
      default:
        return connector.name || 'Unknown Wallet';
    }
  };

  if (!open) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.8)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 9999 
    }}>
      <div style={{ 
        width: 420, 
        background: '#1a1a1a', 
        padding: 24, 
        borderRadius: 16, 
        color: '#fff', 
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            right: 16, 
            top: 16, 
            background: 'transparent', 
            border: 'none', 
            color: '#fff', 
            fontSize: 20,
            cursor: 'pointer',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/assets/Logo.png" alt="Logo" style={{ width: 64, height: 64, marginBottom: 16 }} />
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Connect Wallet</h3>
          <p style={{ margin: '8px 0 0 0', color: '#aaa', fontSize: '0.9rem' }}>
            Choose your preferred wallet to connect
          </p>
        </div>

        {error && (
          <div style={{ 
            color: '#ff6b6b', 
            background: 'rgba(255,107,107,0.1)', 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 16,
            fontSize: '0.9rem',
            border: '1px solid rgba(255,107,107,0.2)'
          }}>
            {error.message || 'Connection failed'}
          </div>
        )}

        {isConnected ? (
          <div style={{ 
            background: 'rgba(76,175,80,0.1)', 
            border: '1px solid rgba(76,175,80,0.3)',
            borderRadius: 12, 
            padding: 16, 
            textAlign: 'center',
            marginBottom: 16
          }}>
            <div style={{ color: '#4caf50', fontSize: '2rem', marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Connected Successfully!</div>
            <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 16 }}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </div>
            <button 
              onClick={() => { disconnect(); onClose(); }}
              style={{
                background: 'rgba(255,107,107,0.2)',
                color: '#ff6b6b',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {connectors.map((connector) => {
              const isConnecting = connectingConnector === connector.id;
              const isDisabled = isPending || isConnecting;
              
              return (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  disabled={isDisabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 20px',
                    background: isConnecting ? 'rgba(255,179,0,0.1)' : 'rgba(255,255,255,0.05)',
                    border: isConnecting ? '1px solid rgba(255,179,0,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#fff',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    fontSize: '1rem',
                    fontWeight: 600,
                    opacity: isDisabled ? 0.6 : 1
                  }}
                onMouseOver={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255,179,0,0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }
                }}
              >
                <img
                  src={getWalletIcon(connector)}
                  alt={connector.name}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/assets/metamask_icon.png';
                  }}
                />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div>{getWalletName(connector)}</div>
                  {connector.id === 'walletConnect' && (
                    <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: 4 }}>
                      Scan QR with mobile wallet
                    </div>
                  )}
                </div>
                {isConnecting && (
                  <div style={{
                    width: 20,
                    height: 20,
                    border: '2px solid rgba(255,179,0,0.3)',
                    borderTop: '2px solid #FFB300',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                )}
              </button>
              );
            })}
          </div>
        )}


        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}