'use client';

import React, { useEffect, useState } from 'react';
import { useConnect, useAccount, useDisconnect, useEnsName } from 'wagmi';
import { injectedConnector, walletConnectConnector } from '../lib/reown';

export default function WalletModal({ open, onClose, onConnect }) {
  const { connect, connectors, error: connectError } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address });

  const [showQR, setShowQR] = useState(false);
  const [localError, setLocalError] = useState(null as any);
  const [wcUri, setWcUri] = useState('');
  const wcListenersRef = React.useRef([] as any[]);
  const [diagnostics, setDiagnostics] = useState([] as string[]);
  const [showDiagVisible, setShowDiagVisible] = useState(false);

  function pushDiag(msg: string) {
    console.debug('[WC DIAG]', msg);
    setDiagnostics(d => [...d, `${new Date().toISOString()} ${msg}`].slice(-30));
  }

  function getConnectorByKeys(keys: string[]) {
    if (!connectors || connectors.length === 0) return null;
    return connectors.find((c: any) => {
      const lname = (c.name || c.id || '').toString().toLowerCase();
      return keys.some(k => lname.includes(k));
    }) || null;
  }

  async function handleWalletClick(type: 'metamask' | 'ronin' | 'trust' | 'coinbase' | 'walletconnect') {
    try {
      setLocalError(null);
      let connectorToUse: any = null;
      if (type === 'walletconnect' || type === 'trust' || type === 'coinbase') {
        // try find a walletconnect-style connector first
        connectorToUse = getConnectorByKeys(['walletconnect', 'walletconnectv2', 'walletconnect']) || walletConnectConnector;
        // attach listeners to capture display URI if available
        try {
          const attachUriHandler = (c: any) => {
            if (!c) return;
            const handler = (uri: string) => { setWcUri(uri || ''); };
            // try common event names
            if (typeof c.on === 'function') {
              c.on('display_uri', handler);
              c.on('displayUri', handler);
              c.on('uri', handler);
              wcListenersRef.current.push({ connector: c, name: 'display_uri', handler });
            }
            // some connectors expose 'qrUrl' property after prepare
          };
          attachUriHandler(connectorToUse as any);
        } catch (e) {
          // ignore
        }
      } else if (type === 'metamask') {
        connectorToUse = getConnectorByKeys(['metamask', 'meta mask']) || getConnectorByKeys(['injected']) || injectedConnector;
      } else if (type === 'ronin') {
        // Ronin often injects under 'ronin' or falls back to injected
        connectorToUse = getConnectorByKeys(['ronin']) || getConnectorByKeys(['injected']) || injectedConnector;
      }

      if (!connectorToUse) {
        setLocalError('No connector available for that wallet');
        console.error('No connector found; connectors list:', connectors);
        return;
      }

      // Diagnostics: log connector and projectId (if present)
      try {
        console.info('Attempting connect with connector:', connectorToUse);
        pushDiag(`Attempting connect with connector: ${((connectorToUse && (connectorToUse as any).name) || 'unnamed')}`);
        if ((connectorToUse as any).options) {
          console.info('connector.options:', (connectorToUse as any).options);
          pushDiag(`connector.options: ${JSON.stringify((connectorToUse as any).options).slice(0,200)}`);
        }
        const pid = process?.env?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || (window as any)?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'unknown';
        console.info('env NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=', pid);
        pushDiag(`projectId=${pid}`);
      } catch (e) { console.info('diagnostics log error', e); pushDiag(`diagnostics log error ${String(e)}`); }

      // attempt to attach provider event listeners if available (diagnostics)
      try {
        const maybeProvider = (connectorToUse as any).getProvider ? await (connectorToUse as any).getProvider() : (connectorToUse as any).provider || null;
        if (maybeProvider) {
          try {
            pushDiag('provider resolved for connector');
            // provider may be an EventEmitter-like object
            if (typeof (maybeProvider as any).on === 'function') {
              (maybeProvider as any).on('open', (...args: any[]) => { console.info('WC provider open', args); pushDiag('provider open'); });
              (maybeProvider as any).on('close', (...args: any[]) => { console.warn('WC provider close', args); pushDiag('provider close'); });
              (maybeProvider as any).on('error', (...args: any[]) => { console.error('WC provider error', args); pushDiag(`provider error ${String(args?.[0] || args)}`); });
            } else {
              pushDiag('provider exists but has no .on method');
            }
          } catch (err) { console.warn('attach provider listeners err', err); pushDiag(`attach provider listeners err ${String(err)}`); }
        } else {
          console.info('no provider exposed on connector (diagnostic)');
          pushDiag('no provider exposed on connector');
        }
      } catch (e) {
        console.warn('error resolving provider for diagnostics', e);
      }

      await connect({ connector: connectorToUse });
    } catch (err: any) {
      setLocalError(err?.message || 'Connection failed');
      console.error('connect() failed:', err);
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      const res = { address, provider: 'wallet' };
      onConnect && onConnect(res);
      try { localStorage.setItem('connectedWallet', JSON.stringify({ provider: 'wallet' })); } catch (e) {}
      onClose && onClose();
    }
    // cleanup any attached listeners when modal closes/unmounts
    return () => {
      try {
        wcListenersRef.current.forEach(l => {
          const c = l.connector;
          if (!c || typeof c.off !== 'function') return;
          try { c.off('display_uri', l.handler); } catch (e) {}
          try { c.off('displayUri', l.handler); } catch (e) {}
          try { c.off('uri', l.handler); } catch (e) {}
        });
      } catch (e) {}
      wcListenersRef.current = [];
      setWcUri('');
      setShowQR(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: 360, background: '#000000', padding: 20, borderRadius: 8, color: '#fff', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 10, top: 10, background: 'transparent', border: 'none', color: '#fff', fontSize: 18 }}>✕</button>
        <h3 style={{ textAlign: 'center', margin: '8px 0 18px 0' }}>CONNECT WALLET</h3>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 18px' }}>
          <img src="/assets/Logo.png" alt="Logo" style={{ width: 96, height: 72, borderRadius: 6 }} />
        </div>

        {(connectError || localError) && (
          <div style={{ color: '#ffb3b3', textAlign: 'center', marginBottom: 8 }}>
            {connectError ? ((connectError as any).message || 'Connection failed') : (typeof localError === 'string' ? localError : 'Connection failed')}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          <button onClick={() => handleWalletClick('ronin')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8 }}>
            <img src="/assets/ronin_icon.png" alt="ronin" style={{ width: 36, height: 36 }} />
            <div style={{ flex: 1, textAlign: 'left' }}>RONIN WALLET</div>
          </button>

          <button onClick={() => handleWalletClick('metamask')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8 }}>
            <img src="/assets/metamask_icon.png" alt="metamask" style={{ width: 36, height: 36 }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/metamask_icon.png'; }} />
            <div style={{ flex: 1, textAlign: 'left' }}>METAMASK</div>
          </button>

          <button onClick={() => handleWalletClick('trust')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8 }}>
            <img src="/assets/trustwallet_icon.png" alt="trust" style={{ width: 36, height: 36 }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/trustwallet_icon.png'; }} />
            <div style={{ flex: 1, textAlign: 'left' }}>TRUST WALLET</div>
          </button>

          <button onClick={() => handleWalletClick('coinbase')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8 }}>
            <img src="/assets/coinbase_icon.png.svg" alt="coinbase" style={{ width: 36, height: 36 }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/coinbase_icon.png'; }} />
            <div style={{ flex: 1, textAlign: 'left' }}>COINBASE</div>
          </button>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button onClick={async () => {
            setLocalError(null);
            if (!showQR) {
              try {
                // start WalletConnect flow
                const wc = getConnectorByKeys(['walletconnect', 'walletconnectv2', 'walletconnect']) || walletConnectConnector;
                await connect({ connector: wc });
                setShowQR(true);
              } catch (e: any) {
                setLocalError(e?.message || 'Failed to start WalletConnect');
              }
            } else {
              setShowQR(false);
            }
          }} style={{ background: 'transparent', color: '#fff', border: '1px dashed rgba(255,255,255,0.12)', padding: '8px 12px', borderRadius: 6 }}>Use QR (mobile)</button>
        </div>

        {showQR && (
          <div style={{ marginTop: 12, background: '#111', padding: 12, borderRadius: 6, textAlign: 'center' }}>
            {wcUri ? (
              <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(wcUri)}&size=300x300`} alt="WC QR" style={{ maxWidth: '100%' }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                <div>Waiting for WalletConnect QR…</div>
              </div>
            )}
          </div>
        )}

        {/* Diagnostics viewer (dev) */}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button onClick={() => setShowDiagVisible(v => !v)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 10px', borderRadius: 6, marginTop: 8 }}>Toggle Diagnostics</button>
          {showDiagVisible && (
            <div style={{ marginTop: 8, maxHeight: 220, overflow: 'auto', background: '#0b0b0b', padding: 8, borderRadius: 6, textAlign: 'left', color: '#ddd', fontSize: 12 }}>
              {diagnostics.length === 0 ? <div style={{ opacity: 0.6 }}>No diagnostics yet.</div> : diagnostics.map((d, idx) => <div key={idx}>{d}</div>)}
            </div>
          )}
        </div>

        {!showQR && !isConnected && (
          <div style={{ marginTop: 12, background: '#222', padding: 12, borderRadius: 6, textAlign: 'center', color: '#ccc' }}>
            <div style={{ fontSize: 24 }}>👻</div>
            <div>No supported wallets detected or not connected.</div>
          </div>
        )}

        {isConnected && (
          <div style={{ marginTop: 12, color: '#bfe9b4' }}>
            Connected: {ensName ?? (address ? `${address.slice(0,6)}...${address.slice(-4)}` : '')}
            <div><button onClick={() => { disconnect(); localStorage.removeItem('connectedWallet'); }} style={{ marginTop: 8, padding: '6px 10px' }}>Disconnect</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
