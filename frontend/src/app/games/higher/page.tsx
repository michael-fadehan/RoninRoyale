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
  const [isAnimating, setIsAnimating] = useState(false);
  const [deck, setDeck] = useState<number[]>([]);

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
    const s = io(`${backendUrl}/higher`, { transports: ['websocket'] });
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

  // Initialize or shuffle deck
  function initializeDeck() {
    const newDeck = [];
    for (let i = 1; i <= 13; i++) {
      for (let j = 0; j < 4; j++) { // 4 suits
        newDeck.push(i);
      }
    }
    // Shuffle deck
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
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
    
    // Initialize deck if empty or first round
    let currentDeck = deck.length > 0 ? [...deck] : initializeDeck();
    
    // Draw initial card from deck
    const card = currentDeck.pop();
    if (!card) {
      currentDeck = initializeDeck();
      const newCard = currentDeck.pop();
      setCurrentCard(newCard || 1);
    } else {
      setCurrentCard(card);
    }
    
    setDeck(currentDeck);
    setNextCard(null);
    setGameActive(true);
    setLastOutcome(null);
    setIsAnimating(false);
  }

  async function makeGuess(guess: 'higher' | 'lower') {
    if (!gameActive || !currentCard || isAnimating) return;
    
    setIsAnimating(true);
    
    // Draw next card from deck
    let currentDeck = [...deck];
    if (currentDeck.length === 0) {
      currentDeck = initializeDeck();
    }
    
    const card = currentDeck.pop();
    if (!card) return;
    
    setDeck(currentDeck);
    
    // Animate card draw
    setTimeout(() => {
      setNextCard(card);
      
      // Determine outcome based on your specified odds
      let won = false;
      const isHigher = card > currentCard;
      const isLower = card < currentCard;
      const isEqual = card === currentCard;
      
      if (isEqual) {
        // Tie - house wins
        won = false;
      } else if (guess === 'higher') {
        // Higher button: 30% user win chance (house has 60% + 10% tie advantage)
        const randomChance = Math.random();
        won = isHigher && randomChance <= 0.3;
      } else {
        // Lower button: 50%-50% split
        won = isLower;
      }
      
      setLastOutcome(won ? 'win' : 'lose');
      setGameActive(false);
      setIsAnimating(false);
      
      // Calculate payout
      const mult = guess === 'higher' ? multiplier.higher : multiplier.lower;
      const payout = won ? wager * mult : 0;
      const label = won ? `R ${payout.toFixed(2)}` : 'Unlucky!';
      
      // Update history
      setHistory(prev => [{ wager, payout: label }, ...prev].slice(0, 10));
      
      // Update balance (simulate)
      try { refetchBalance?.(); } catch {}
    }, 800); // Animation delay
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
              disabled={!gameActive || isAnimating}
            >
              <div className="bet-label">LOWER</div>
              <div className="bet-payout">Pays: {multiplier.lower}x</div>
              <div className="bet-odds">50%-50%</div>
            </button>
            <button
              className="bet-btn higher"
              onClick={() => makeGuess('higher')}
              disabled={!gameActive || isAnimating}
            >
              <div className="bet-label">HIGHER</div>
              <div className="bet-payout">Pays: {multiplier.higher}x</div>
              <div className="bet-odds">30% win</div>
            </button>
          </div>
        </div>

        {/* Center - Casino Table */}
        <div className="casino-table">
          <div className="table-surface">
            {/* Poker Chips - Upper Left */}
            <div className="poker-chips upper-left">
              <div className="chip-stack">
                <div className="chip chip-1"></div>
                <div className="chip chip-2"></div>
                <div className="chip chip-3"></div>
              </div>
            </div>

            {/* Poker Chips - Lower Left */}
            <div className="poker-chips lower-left">
              <div className="chip-stack">
                <div className="chip chip-1"></div>
                <div className="chip chip-2"></div>
                <div className="chip chip-3"></div>
              </div>
            </div>

            {/* Reserve Cards - Upper Right */}
            <div className="reserve-cards">
              <div className="card-stack">
                <div className="reserve-card card-1"></div>
                <div className="reserve-card card-2"></div>
                <div className="reserve-card card-3"></div>
              </div>
            </div>

            {/* Card Display Area - Center */}
            <div className="card-area">
              {/* Current Card - Always show, default to 4 if no game active */}
              <div className="current-card-container">
                <div className="playing-card open-card">
                  <div className="card-corner top-left">
                    <div className="card-value">{currentCard || 4}</div>
                    <div className="card-suit">♦</div>
                  </div>
                  <div className="card-center">
                    <div className="card-suit-large">♦</div>
                  </div>
                  <div className="card-corner bottom-right">
                    <div className="card-value">{currentCard || 4}</div>
                    <div className="card-suit">♦</div>
                  </div>
                </div>
              </div>
              
              {/* Next Card - Show closed card with indicators when game active, or revealed card when game complete */}
              <div className="next-card-container">
                {gameActive && !nextCard ? (
                  <div className={`playing-card closed-card ${isAnimating ? 'card-animating' : ''}`}>
                    <div className="card-back">
                      <div className="card-back-logo">R</div>
                    </div>
                    <div className="card-indicator top"></div>
                    <div className="card-indicator bottom"></div>
                  </div>
                ) : nextCard ? (
                  <div className="playing-card open-card card-revealed">
                    <div className="card-corner top-left">
                      <div className="card-value">{nextCard}</div>
                      <div className="card-suit">♠</div>
                    </div>
                    <div className="card-center">
                      <div className="card-suit-large">♠</div>
                    </div>
                    <div className="card-corner bottom-right">
                      <div className="card-value">{nextCard}</div>
                      <div className="card-suit">♠</div>
                    </div>
                  </div>
                ) : (
                  <div className="playing-card closed-card">
                    <div className="card-back">
                      <div className="card-back-logo">R</div>
                    </div>
                    <div className="card-indicator top"></div>
                    <div className="card-indicator bottom"></div>
                  </div>
                )}
              </div>
            </div>

            {/* New Round Button - Bottom */}
            <button
              className="new-round-btn"
              onClick={newRound}
              disabled={gameActive || isAutoSwitching || isAnimating}
            >
              {isAutoSwitching ? 'Switching...' : isAnimating ? 'Drawing...' : 'New Round'}
            </button>
            
            {/* Deck Counter */}
            <div className="deck-counter">
              Cards Left: {deck.length}
            </div>
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
          grid-template-rows: 1fr auto auto;
          gap: 16px;
          padding: 88px 16px 16px 16px;
        }

        /* Wager Card - Top Left */
        .wager-card {
          grid-column: 1;
          grid-row: 1;
          background: #3c3c3c;
          border-radius: 12px;
          padding: 20px;
          color: white;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          min-height: 300px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
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
          margin-bottom: 24px;
          flex: 1;
        }

        .wager-label {
          color: white;
          font-weight: 700;
          margin-bottom: 12px;
          font-size: 16px;
        }

        .wager-input-container {
          display: flex;
          align-items: center;
          background: #2c2c2c;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 108px;
        }

        .currency {
          color: white;
          margin-right: 12px;
          font-weight: 700;
          font-size: 16px;
        }

        .wager-input {
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          flex: 1;
          outline: none;
          font-size: 16px;
        }

        .slider-container {
          position: relative;
          margin-bottom: 108px;
          margin-top: 48px;
        }

        .wager-slider {
          width: 100%;
          height: 8px;
          background: #555;
          border-radius: 4px;
          outline: none;
          -webkit-appearance: none;
        }

        .wager-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 18px;
          background: #4285f4;
          border-radius: 50%;
          cursor: pointer;
        }

        .slider-value {
          position: absolute;
          right: 0;
          top: -30px;
          color: white;
          font-weight: 700;
          font-size: 16px;
        }

        .bet-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .bet-btn {
          padding: 20px 16px;
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
          font-size: 18px;
          margin-bottom: 6px;
        }

        .bet-payout {
          font-size: 14px;
          opacity: 0.9;
        }

        .bet-odds {
          font-size: 12px;
          opacity: 0.8;
          margin-top: 2px;
        }

        /* Casino Table - Center */
        .casino-table {
          grid-column: 2;
          grid-row: 1 / 4;
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
          position: relative;
        }

        /* Poker Chips */
        .poker-chips {
          position: absolute;
          z-index: 2;
        }

        .poker-chips.upper-left {
          top: 20px;
          left: 20px;
        }

        .poker-chips.lower-left {
          bottom: 80px;
          left: 20px;
        }

        .chip-stack {
          position: relative;
          width: 90px;
          height: 90px;
        }

        .chip {
          position: absolute;
          width: 90px;
          height: 90px;
          background: url('/assets/Chips.png') center/cover no-repeat;
          box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }

        .chip-1 {
          top: 0;
          left: 0;
          z-index: 3;
        }

        .chip-2 {
          top: -12px;
          left: 0;
          z-index: 2;
        }

        .chip-3 {
          top: -24px;
          left: 0;
          z-index: 1;
        }

        /* Reserve Cards */
        .reserve-cards {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 2;
        }

        .card-stack {
          position: relative;
          width: 210px;
          height: 300px;
        }

        .reserve-card {
          position: absolute;
          width: 210px;
          height: 300px;
          background: #dc3545;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 72px;
          font-weight: bold;
          box-shadow: 0 6px 18px rgba(0,0,0,0.3);
        }

        .reserve-card::after {
          content: 'R';
        }

        .reserve-card.card-1 {
          top: 0;
          left: 0;
          z-index: 3;
        }

        .reserve-card.card-2 {
          top: -12px;
          left: 6px;
          z-index: 2;
        }

        .reserve-card.card-3 {
          top: -24px;
          left: 12px;
          z-index: 1;
        }

        /* Card Display Area */
        .card-area {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          gap: 80px;
          align-items: center;
          z-index: 2;
        }

        .current-card-container, .next-card-container {
          position: relative;
        }

        .playing-card {
          width: 140px;
          height: 200px;
          border-radius: 16px;
          position: relative;
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          border: 3px solid white;
        }

        .open-card {
          background: white;
          color: #dc3545;
        }

        .closed-card {
          background: #dc3545;
          position: relative;
        }

        .card-corner {
          position: absolute;
          font-size: 18px;
          font-weight: bold;
          line-height: 1;
          color: #dc3545;
        }

        .card-corner.top-left {
          top: 12px;
          left: 12px;
        }

        .card-corner.bottom-right {
          bottom: 12px;
          right: 12px;
          transform: rotate(180deg);
        }

        .card-value {
          font-size: 24px;
          margin-bottom: 4px;
          font-weight: bold;
        }

        .card-suit {
          font-size: 16px;
        }

        .card-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .card-suit-large {
          font-size: 60px;
          color: #dc3545;
        }

        .card-back {
          width: 100%;
          height: 100%;
          background: #dc3545;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .card-back-logo {
          color: white;
          font-size: 48px;
          font-weight: bold;
        }

        .card-indicator {
          position: absolute;
          width: 0;
          height: 0;
          left: 50%;
          transform: translateX(-50%);
          opacity: 0.7;
        }

        .card-indicator.top {
          top: -80px;
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-bottom: 50px solid #8fbc8f;
        }

        .card-indicator.bottom {
          bottom: -80px;
          border-left: 70px solid transparent;
          border-right: 70px solid transparent;
          border-top: 50px solid #8b4513;
        }

        /* Card Animations */
        .card-animating {
          animation: cardFlip 0.8s ease-in-out;
        }

        .card-revealed {
          animation: cardReveal 0.5s ease-out;
        }

        @keyframes cardFlip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }

        @keyframes cardReveal {
          0% {
            transform: rotateY(90deg) scale(0.8);
            opacity: 0;
          }
          100% {
            transform: rotateY(0deg) scale(1);
            opacity: 1;
          }
        }

        /* New Round Button */
        .new-round-btn {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
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
          z-index: 2;
        }

        .new-round-btn:hover:not(:disabled) {
          background: #3367d6;
          transform: translateX(-50%) translateY(-2px);
        }

        .new-round-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Deck Counter */
        .deck-counter {
          position: absolute;
          bottom: 70px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          z-index: 2;
        }

        /* Legacy card styles - remove these */
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
          padding: 16px;
          color: white;
          display: flex;
          flex-direction: column;
          height: 280px;
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
          grid-row: 4;
          background: rgba(200, 220, 200, 0.9);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          margin-top: 20px;
          position: relative;
          z-index: 10;
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
            grid-template-rows: auto auto auto auto auto;
          }
          
          .wager-card {
            grid-column: 1;
            grid-row: 1;
            min-height: auto;
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
            margin-top: 0;
          }
        }
      `}</style>
    </>
  );
}