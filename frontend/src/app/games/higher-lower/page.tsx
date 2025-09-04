'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import WalletHeader from '../../../components/WalletHeader';
import { useAccount, useBalance, useEnsName } from 'wagmi';
import { useWalletContext } from '../../../lib/wallet-context';
import { roninSaigon } from '../../../lib/reown';
import { io, Socket } from 'socket.io-client';

export default function HigherLowerPage() {
  // Game state
  const [wager, setWager] = useState(20);
  const [currentCard, setCurrentCard] = useState<number | null>(null);
  const [nextCard, setNextCard] = useState<number | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<null | 'win' | 'lose'>(null);
  const [multiplier, setMultiplier] = useState({ higher: 3.2, lower: 1.3 });

  // History
  const [history, setHistory] = useState<{ wager: number; payout: string }[]>([
    { wager: 0.5, payout: 'R 1.0' },
    { wager: 0.5, payout: 'Unlucky!' },
    { wager: 0.5, payout: 'Unlucky!' },
    { wager: 0.5, payout: 'R 1.0' },
    { wager: 0.5, payout: 'Unlucky!' }
  ]);

  // Chat
  const socketRef = useRef<null | Socket>(null);
  const [chatMessages, setChatMessages] = useState<{ id: number; user: string; message: string; time: string }[]>([
    { id: 1, user: '0x75.....4', message: 'hey, do you want to play some game, Ronin Royale is the best', time: '12:34' }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);

  // Wallet
  const { address, isConnected, chainId } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: 1, query: { enabled: false } });
  const { data: ronBalance, refetch: refetchBalance } = useBalance({ address, chainId: 2021 });
  const { setWalletModalOpen, ensureCorrectNetwork, isAutoSwitching } = useWalletContext();

  // Derived
  const backendUrl = useMemo(
    () => (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, ''),
    []
  );
  const walletBalance = useMemo(
    () => (isConnected && ronBalance ? Number(ronBalance.formatted) : 45.00),
    [isConnected, ronBalance]
  );

  // Helpers
  function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
  }
  function shorten(addr?: string) { return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : ''; }

  // Socket: chat/presence
  useEffect(() => {
    const s = io(`${backendUrl}/higher-lower`, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('presence', (p: any) => {
      const n = typeof p?.online === 'number' ? p.online : 1;
      setOnlineCount(Math.max(1, n));
    });
    s.on('chat_message', (m: any) => {
      setChatMessages(prev => [...prev, m]);
    });

    return () => {
      try { s.close(); } catch {}
      socketRef.current = null;
    };
  }, [backendUrl]);

  function sendChat() {
    const msg = newMessage.trim();
    if (!msg) return;
    const out = {
      id: Date.now(),
      user: ensName || shorten(address) || 'Anonymous',
      message: msg,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    };
    try { socketRef.current?.emit('chat_message', out); } catch {}
    setChatMessages(prev => [...prev, out]);
    setNewMessage('');
  }

  async function newRound() {
    if (!isConnected) {
      setWalletModalOpen(true);
      return;
    }
    if (chainId !== roninSaigon.id) {
      const ok = await ensureCorrectNetwork();
      if (!ok) return;
    }
    
    // Start new round - draw initial card
    const card = Math.floor(Math.random() * 13) + 1; // 1-13 (Ace to King)
    setCurrentCard(card);
    setNextCard(null);
    setGameActive(true);
    setLastOutcome(null);
  }

  async function makeGuess(guess: 'higher' | 'lower') {
    if (!gameActive || !currentCard) return;
    
    // Draw next card
    const card = Math.floor(Math.random() * 13) + 1;
    setNextCard(card);
    
    // Determine outcome
    const isHigher = card > currentCard;
    const isLower = card < currentCard;
    const won = (guess === 'higher' && isHigher) || (guess === 'lower' && isLower);
    
    setLastOutcome(won ? 'win' : 'lose');
    setGameActive(false);
    
    // Calculate payout
    const mult = guess === 'higher' ? multiplier.higher : multiplier.lower;
    const payout = won ? wager * mult : 0;
    const label = won ? `R ${payout.toFixed(2)}` : 'Unlucky!';
    
    // Update history
    setHistory(prev => [{ wager, payout: label }, ...prev].slice(0, 10));
    
    // Update balance (simulate)
    try { await refetchBalance?.(); } catch {}
  }

  return (
    <>
      <WalletHeader />

      <div className="higher-lower-page">
        {/* Left Panel - Wager Card */}
        <div className="wager-card">
          <div className="balance-display">
            Ronin Balance : R {walletBalance.toFixed(2)}
          </div>
          
          <div className="wager-section">
            <div className="wager-label">Wager</div>
            <div className="wager-input-container">
              <span className="currency">R :</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={wager}
                onChange={e => setWager(clamp(parseFloat(e.target.value || '0') || 0, 0.01, walletBalance))}
                className="wager-input"
              />
            </div>
            
            <div className="slider-container">
              <input
                type="range"
                min={0.01}
                max={walletBalance}
                step={0.01}
                value={wager}
                onChange={e => setWager(parseFloat(e.target.value))}
                className="wager-slider"
              />
              <div className="slider-value">{wager}</div>
            </div>
          </div>

          <div className="bet-buttons">
            <button 
              className="bet-btn lower"
              onClick={() => makeGuess('lower')}
              disabled={!gameActive}
            >
              <div className="bet-label">LOWER</div>
              <div className="bet-payout">Pays: {multiplier.lower}x</div>
            </button>
            <button 
              className="bet-btn higher"
              onClick={() => makeGuess('higher')}
              disabled={!gameActive}
            >
              <div className="bet-label">HIGHER</div>
              <div className="bet-payout">Pays: {multiplier.higher}x</div>
            </button>
          </div>
        </div>

        {/* Center - Casino Table */}
        <div className="casino-table">
          <div className="table-surface">
            <button 
              className="new-round-btn"
              onClick={newRound}
              disabled={gameActive || isAutoSwitching}
            >
              {isAutoSwitching ? 'Switching...' : 'New Round'}
            </button>
            
            {/* Card Display Area */}
            {currentCard && (
              <div className="card-area">
                <div className="current-card">
                  <div className="card">{currentCard}</div>
                  <div className="card-label">Current</div>
                </div>
                {nextCard && (
                  <div className="next-card">
                    <div className="card">{nextCard}</div>
                    <div className="card-label">Next</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Left Bottom - Chat Card */}
        <div className="chat-card">
          <div className="chat-header">
            <div className="online-indicator">
              <div className="online-dot"></div>
              <span>online</span>
            </div>
            <div className="chat-title">Chat</div>
          </div>

          <div className="chat-messages">
            {chatMessages.map(msg => (
              <div key={msg.id} className="chat-message">
                <div className="user-avatar"></div>
                <div className="message-content">
                  <strong>{msg.user}</strong> {msg.message}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Write Something"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              className="chat-input"
            />
            <button onClick={sendChat} className="send-btn">Send</button>
          </div>
        </div>

        {/* Right Bottom - History Card */}
        <div className="history-card">
          <div className="history-header">
            <div className="history-title">History</div>
            <div className="history-balance">Ronin Balance : R {walletBalance.toFixed(2)}</div>
          </div>
          
          <div className="history-content">
            <div className="history-grid">
              <div className="history-col-header">Wager</div>
              <div className="history-col-header">Payout</div>
              {history.map((entry, index) => (
                <div key={index} className="history-row">
                  <div className="history-cell">R {entry.wager.toFixed(1)}</div>
                  <div className="history-cell">{entry.payout}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .higher-lower-page {
          padding-top: 72px;
          min-height: 100vh;
          background: #d8f0db;
          display: grid;
          grid-template-columns: 350px 1fr;
          grid-template-rows: auto 1fr auto;
          gap: 16px;
          padding: 88px 16px 16px 16px;
        }

        /* Wager Card - Top Left */
        .wager-card {
          grid-column: 1;
          grid-row: 1;
          background: #3c3c3c;
          border-radius: 12px;
          padding: 16px;
          color: white;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .balance-display {
          color: white;
          font-weight: 700;
          margin-bottom: 16px;
          text-align: center;
          background: rgba(255,255,255,0.1);
          padding: 8px;
          border-radius: 8px;
        }

        .wager-section {
          margin-bottom: 20px;
        }

        .wager-label {
          color: white;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .wager-input-container {
          display: flex;
          align-items: center;
          background: #2c2c2c;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }

        .currency {
          color: white;
          margin-right: 8px;
          font-weight: 700;
        }

        .wager-input {
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          flex: 1;
          outline: none;
        }

        .slider-container {
          position: relative;
        }

        .wager-slider {
          width: 100%;
          height: 6px;
          background: #555;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }

        .wager-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: #4285f4;
          border-radius: 50%;
          cursor: pointer;
        }

        .slider-value {
          position: absolute;
          right: 0;
          top: -25px;
          color: white;
          font-weight: 700;
          font-size: 14px;
        }

        .bet-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .bet-btn {
          padding: 16px 12px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-weight: 700;
          text-align: center;
          transition: all 0.2s;
        }

        .bet-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .bet-btn.lower {
          background: #4CAF50;
          color: white;
        }

        .bet-btn.higher {
          background: #f44336;
          color: white;
        }

        .bet-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .bet-label {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .bet-payout {
          font-size: 12px;
          opacity: 0.9;
        }

        /* Casino Table - Center */
        .casino-table {
          grid-column: 2;
          grid-row: 1 / 3;
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        }

        .table-surface {
          width: 100%;
          height: 100%;
          min-height: 500px;
          background: url('/assets/Casino table.png') center/cover no-repeat;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .new-round-btn {
          background: #4285f4;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
          transition: all 0.2s;
        }

        .new-round-btn:hover:not(:disabled) {
          background: #3367d6;
          transform: translateY(-2px);
        }

        .new-round-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .card-area {
          display: flex;
          gap: 40px;
          margin-top: 40px;
          align-items: center;
        }

        .current-card, .next-card {
          text-align: center;
        }

        .card {
          width: 80px;
          height: 120px;
          background: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #333;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          margin-bottom: 8px;
        }

        .card-label {
          color: white;
          font-weight: 700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }

        /* Chat Card - Bottom Left */
        .chat-card {
          grid-column: 1;
          grid-row: 2;
          background: #3c3c3c;
          border-radius: 12px;
          padding: 12px;
          color: white;
          display: flex;
          flex-direction: column;
          max-height: 300px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
        }

        .online-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: #4CAF50;
          border-radius: 50%;
        }

        .chat-title {
          font-weight: 700;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 12px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          padding: 8px;
        }

        .chat-message {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }

        .user-avatar {
          width: 24px;
          height: 24px;
          background: linear-gradient(45deg, #FFB300, #FF8F00);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .message-content {
          background: rgba(255,255,255,0.1);
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 14px;
        }

        .chat-input-area {
          display: flex;
          gap: 8px;
        }

        .chat-input {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 8px 10px;
          border-radius: 6px;
          outline: none;
        }

        .chat-input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .send-btn {
          background: #FFB300;
          color: black;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          font-weight: 700;
          cursor: pointer;
        }

        /* History Card - Bottom Right */
        .history-card {
          grid-column: 2;
          grid-row: 3;
          background: rgba(200, 220, 200, 0.9);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .history-title {
          font-weight: 700;
          color: #333;
        }

        .history-balance {
          font-weight: 700;
          color: #333;
        }

        .history-content {
          background: rgba(255,255,255,0.5);
          border-radius: 8px;
          padding: 12px;
        }

        .history-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .history-col-header {
          font-weight: 700;
          color: #333;
          padding: 8px;
          text-align: center;
        }

        .history-row {
          display: contents;
        }

        .history-cell {
          padding: 6px 8px;
          background: rgba(255,255,255,0.3);
          border-radius: 4px;
          text-align: center;
          color: #333;
          font-size: 14px;
        }

        @media (max-width: 1200px) {
          .higher-lower-page {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto auto;
          }
          
          .wager-card {
            grid-column: 1;
            grid-row: 1;
          }
          
          .casino-table {
            grid-column: 1;
            grid-row: 2;
          }
          
          .chat-card {
            grid-column: 1;
            grid-row: 3;
          }
          
          .history-card {
            grid-column: 1;
            grid-row: 4;
          }
        }
      `}</style>
    </>
  );
}