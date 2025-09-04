
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import { useAccount, useDisconnect, useEnsName, useWalletClient } from 'wagmi';
import { useBalance } from 'wagmi';
import WalletHeader from '../../../components/WalletHeader';
import { useWalletContext } from '../../../lib/wallet-context';
import { roninSaigon } from '../../../lib/reown';

export default function BottleFlipPage() {
  const [wager, setWager] = useState(1);
  const [multipleBets, setMultipleBets] = useState(20);
  const [spinning, setSpinning] = useState(false);
  const spinnerRef = useRef<number | null>(null);
  const [selectedSide, setSelectedSide] = useState('up' as 'up'|'down');
  const [bottleRotation, setBottleRotation] = useState(0);
  const PAYOUT_MULT = 1.95; // house keeps 5%
  const [lastResult, setLastResult] = useState(null as null | 'win' | 'lose');
  const [history, setHistory] = useState([] as { wager: number; result: 'win' | 'lose'; payout: number }[]);
  const [chatMessages, setChatMessages] = useState([] as { id: number; user: string; message: string; time: string }[]);
  const [onlineCount, setOnlineCount] = useState(1000);
  const bottleSocketRef = useRef<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const BOTTLE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BOTTLE_ADDRESS || '';
  const BOTTLE_ABI = [
    "function play(bool choice) payable returns (uint256)",
    "event BetPlaced(uint256 indexed requestId, address indexed player, uint256 wager, bool choice)",
    "event BetSettled(uint256 indexed requestId, address indexed player, bool result, bool won, uint256 payout)"
  ];

  const { address, isConnected, chainId } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: false }
  });
  const { disconnect } = useDisconnect();
  const { data: ronBalance } = useBalance({ address, chainId: 2021 });
  const { isWalletModalOpen, setWalletModalOpen, switchError, isAutoSwitching, ensureCorrectNetwork } = useWalletContext();

  function shortenAddress(addr?: string) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  const walletBalance = useMemo(() => (isConnected && ronBalance ? Number(ronBalance.formatted) : 45.00), [isConnected, ronBalance]);

  function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
  }

  async function spin() {
    if (spinning) return;
    setSpinning(true);
    setLastResult(null);

    // start a continuous spin while waiting for result
    const startSpin = () => {
      if (spinnerRef.current) return;
      const step = () => {
        spinnerRef.current = requestAnimationFrame(step);
        setBottleRotation(r => r + 12); // degrees per frame (tweak for speed)
      };
      spinnerRef.current = requestAnimationFrame(step);
    };
    const stopSpin = () => {
      if (spinnerRef.current) {
        cancelAnimationFrame(spinnerRef.current);
        spinnerRef.current = null;
      }
    };

    startSpin();
    try {
      const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
      const res = await fetch(`${backend}/api/games/bottleflip/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wager, choice: selectedSide })
      });
      if (!res.ok) {
        throw new Error(`Spin failed: ${res.status}`);
      }
      const data: {
        outcome: 'up'|'down';
        won: boolean;
        payout: number;
      } = await res.json();

      // Now we have the server-decided outcome: stop continuous spin and smoothly settle
      stopSpin();

      const spinDuration = 2500; // settle animation time (ms)
      // mouth is on the left; flip mapping so 'up' corresponds to 270 and 'down' to 90
      const targetAngle = data.outcome === 'up' ? 270 : 90;
      const currentNormalized = ((bottleRotation % 360) + 360) % 360;
      let adjustment = targetAngle - currentNormalized;
      if (Math.abs(adjustment) > 180) adjustment = adjustment > 0 ? adjustment - 360 : adjustment + 360;
      const extraSpins = 360 * 2; // two extra spins for aesthetics
      const finalRotation = bottleRotation + extraSpins + adjustment;

      // apply final rotation with a transition; ensure transition CSS is applied by toggling spinning state
      setBottleRotation(finalRotation);
      // Wait for settle animation to complete before finalizing result
      await new Promise(r => setTimeout(r, spinDuration));

        const won = data.won;
        setLastResult(won ? 'win' : 'lose');
      const payout = won ? Number((wager * PAYOUT_MULT).toFixed(2)) : 0;
      setHistory(h => [{ wager, result: (won ? 'win' : 'lose') as 'win'|'lose', payout }, ...h].slice(0, 10));
        setSpinning(false);
    } catch (e) {
      console.error(e);
      // fallback: stop spin and clear state
      if (spinnerRef.current) cancelAnimationFrame(spinnerRef.current);
      spinnerRef.current = null;
      setSpinning(false);
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const message = {
      id: Date.now(),
      user: shortenAddress(address) || 'Anonymous',
      message: newMessage,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    };
    // emit to server and update local UI
    try { bottleSocketRef.current && bottleSocketRef.current.emit('chat_message', message) } catch (e) {}
    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  // call on-chain play() from wallet
  async function playOnChain() {
    if (!BOTTLE_CONTRACT_ADDRESS) { setSettlementError('Contract address not configured'); return }
    if (typeof window === 'undefined' || !(window as any).ethereum) { setSettlementError('Wallet not available'); return }
    try {
      const provider = new BrowserProvider((window as any).ethereum as any);
      const signer = await provider.getSigner();
      const contract = new Contract(BOTTLE_CONTRACT_ADDRESS, BOTTLE_ABI, signer);
      // start continuous spin
      const step = () => { spinnerRef.current = requestAnimationFrame(step); setBottleRotation(r => r + 12); };
      if (!spinnerRef.current) spinnerRef.current = requestAnimationFrame(step);

      const tx = await contract.play(selectedSide === 'up', { value: parseUnits(String(wager), 18) });
      await tx.wait();
      // contract event will settle the UI when BetSettled emitted
    } catch (e: any) {
      console.error(e);
      setSettlementError(String(e?.message || e));
      if (spinnerRef.current) { cancelAnimationFrame(spinnerRef.current); spinnerRef.current = null }
      setSpinning(false);
    }
  }

  useEffect(() => {
    const bottleSocket = io(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/bottleflip`, { transports: ['websocket'] })
    bottleSocketRef.current = bottleSocket
    bottleSocket.on('presence', (p: any) => {
      const onlineRaw = (p && typeof p.online === 'number') ? p.online : 0
      // show the real server number but ensure at least 1000
      setOnlineCount(Math.max(1000, Math.max(0, onlineRaw)))
    })
    bottleSocket.on('chat_message', (m: any) => setChatMessages(prev => [...prev, m]))
    return () => { bottleSocket.close() }
  }, [])

  // Listen for on-chain BetSettled events and auto-settle UI for the current signer
  useEffect(() => {
    if (!BOTTLE_CONTRACT_ADDRESS) return;
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    let contract: Contract | null = null;
    const provider = new BrowserProvider((window as any).ethereum as any);
    try {
      contract = new Contract(BOTTLE_CONTRACT_ADDRESS, BOTTLE_ABI, provider);
      const handler = async (requestId: any, player: string, result: boolean, won: boolean, payout: any) => {
        try {
          const signer = await provider.getSigner();
          const addr = await signer.getAddress();
          if (player && addr && player.toLowerCase() === addr.toLowerCase()) {
            // stop any continuous spin and settle UI
            if (spinnerRef.current) { cancelAnimationFrame(spinnerRef.current); spinnerRef.current = null }
            // compute final rotation mapping (mouth left -> up=270, down=90)
            const target = result ? 270 : 90;
            const currentNormalized = ((bottleRotation % 360) + 360) % 360;
            let adjustment = target - currentNormalized;
            if (Math.abs(adjustment) > 180) adjustment = adjustment > 0 ? adjustment - 360 : adjustment + 360;
            const finalRotation = bottleRotation + 360 * 2 + adjustment;
            setBottleRotation(finalRotation);
            setTimeout(() => {
              setLastResult(won ? 'win' : 'lose');
              const payoutNum = Number((payout || 0).toString()) / 1e18;
              setHistory(h => [{ wager, result: (won ? 'win' : 'lose') as 'win'|'lose', payout: payoutNum }, ...h].slice(0, 10));
              setSpinning(false);
            }, 2500);
          }
        } catch (e) { }
      };
      contract.on('BetSettled', handler);
      return () => { contract && contract.removeListener('BetSettled', handler) }
    } catch (e) {
      return () => {}
    }
  }, [BOTTLE_CONTRACT_ADDRESS, bottleRotation, PAYOUT_MULT, wager])

  return (
    <>
      <WalletHeader />

      <div className="bottle-game-container">
        {/* Main Game Area */}
        <div className="game-area">
          <div className="balance-display-top">Ronin Balance : R {walletBalance.toFixed(2)}</div>
          
          <div className="game-layout">
          {/* Circular Game Board */}
            <div className="game-circle">
              <div className="up-section">
              <span className="section-label">UP</span>
            </div>
              <div className="down-section">
              <span className="section-label">DOWN</span>
            </div>
            
            {/* Bottle in center */}
            <div className="bottle-container">
              <div
                className="bottle"
                style={{
                  transform: `rotate(${bottleRotation}deg)`,
                  transition: spinning ? 'transform 3s cubic-bezier(.2,1,.2,1)' : 'transform 300ms ease'
                }}
              >
                  <img src="/assets/3dbottle.png" alt="Bottle" className="bottle-img" />
              </div>
            </div>
          </div>

            {/* Side buttons */}
            <div className="side-buttons">
              <button 
                className={`side-btn up-btn ${selectedSide === 'up' ? 'active' : ''}`}
                onClick={() => !spinning && setSelectedSide('up')}
              >
                UP
              </button>
              <button 
                className={`side-btn down-btn ${selectedSide === 'down' ? 'active' : ''}`}
                onClick={() => !spinning && setSelectedSide('down')}
              >
                DOWN
              </button>
            </div>
          </div>

          {/* Controls Section */}
          <div className="controls-section">
            {/* Wager and Max Payout */}
            <div className="wager-payout-row">
              <div className="input-group">
                <div className="input-label">Wager</div>
              <input
                type="number"
                  min={1}
                  step={0.1}
                value={wager}
                  onChange={e => setWager(clamp(parseFloat(e.target.value || '0') || 0, 1, walletBalance))}
                  className="control-input"
                  placeholder="R : 1"
                />
              </div>
              <div className="input-group">
                <div className="input-label">max Payout</div>
                <input
                  type="text"
                  value={`R : ${(wager * 1.95).toFixed(2)}`}
                  className="control-input"
                  readOnly
              />
            </div>
          </div>

          {/* Multiple Bets Slider */}
          <div className="multiple-bets-section">
            <div className="slider-container">
              <div className="slider-label">
                <span>Multiple Bets</span>
                <span className="slider-value">{multipleBets}</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={multipleBets}
                onChange={e => setMultipleBets(parseInt(e.target.value))}
                className="bets-slider"
              />
            </div>
          </div>

          {/* Spin Button */}
          <button
              className={`spin-btn ${selectedSide === 'up' ? 'spin-up' : 'spin-down'}`}
            onClick={async () => {
              if (!isConnected) {
                setSettlementError('Connect wallet to play');
                setWalletModalOpen(true);
                return;
              }
              if (chainId !== roninSaigon.id) {
                const switched = await ensureCorrectNetwork();
                if (!switched) return;
              }
              setSpinning(true);
              playOnChain();
            }}
            disabled={spinning || !isConnected || wager <= 0 || wager > walletBalance || isAutoSwitching}
            title={!isConnected ? 'Connect wallet to play' : chainId !== roninSaigon.id ? 'Switch to Ronin Saigon network' : ''}
          >
              {isAutoSwitching ? 'Switching Network...' : spinning ? 'Spinning...' : (selectedSide === 'up' ? 'Spin Up' : 'Spin Down')}
          </button>
          
          {settlementError && (
            <div style={{
              marginTop: 12,
              color: '#ff6b6b',
              fontWeight: 700,
              textAlign: 'center',
              background: 'rgba(255,107,107,0.1)',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,107,107,0.2)'
            }}>
              {settlementError}
            </div>
          )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="sidebar">
          {/* Chat Section */}
          <div className="chat-section">
            <div className="chat-header">
              <div className="online-indicator">
                <span className="online-dot"></span>
                <span>online</span>
                <span style={{ marginLeft: 8, fontWeight: 800 }}>{onlineCount >= 1000 ? `1000+` : String(onlineCount)}</span>
              </div>
              <h3>Chat</h3>
            </div>
            
            <div className="chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className="chat-message">
                  <div className="message-avatar"></div>
                  <div className="message-content">
                    <div className="message-user">{msg.user}</div>
                    <div className="message-text">{msg.message}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-input-container">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Write Something"
                className="chat-input"
              />
              <div className="char-count">0/100</div>
              <button onClick={sendMessage} className="send-btn">Send</button>
            </div>
          </div>

          {/* History Section */}
          <div className="history-section">
            <div className="history-header">
              <h3>History</h3>
              <div className="balance-display">Ronin Balance : R {walletBalance.toFixed(2)}</div>
            </div>
            
            <div className="history-table">
              <div className="history-row header">
                <div className="col">Wager</div>
                <div className="col">Payout</div>
              </div>
              {history.map((row, idx) => (
                <div key={idx} className="history-row">
                  <div className="col">R {row.wager.toFixed(1)}</div>
                  <div className="col">{row.result === 'win' ? `R ${row.payout.toFixed(1)}` : 'Unlucky!'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .connect-btn { 
          padding: 10px 14px; 
          border-radius: 10px; 
          font-weight: 800; 
          color: #fff; 
          background: #7e50ff; 
          border: 0; 
          box-shadow: 0 10px 24px rgba(126,80,255,0.35); 
        }
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

        .bottle-game-container {
          display: flex;
          min-height: 100vh;
          padding-top: 72px;
          position: relative;
          isolation: isolate;
          background: url('/assets/wood.png') center/cover no-repeat fixed;
        }
        .bottle-game-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15));
          mix-blend-mode: multiply;
          pointer-events: none;
          z-index: 0;
        }

        .game-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding: 20px 40px;
          position: relative;
          z-index: 1;
        }

        .balance-display-top {
          color: white;
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 20px;
          align-self: flex-end;
        }

        .game-layout {
          display: flex;
          align-items: center;
          gap: 40px;
          margin-bottom: 30px;
        }

        .game-circle {
          width: 350px;
          height: 350px;
          border-radius: 50%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          border: 8px solid #D4A574;
          overflow: visible; /* ensure large bottle render isn't clipped */
        }

        .up-section {
          position: absolute;
          top: 8px;
          left: 8px;
          width: calc(100% - 16px);
          height: calc(50% - 8px);
          background: #4CAF50;
          border-radius: 167px 167px 0 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .down-section {
          position: absolute;
          bottom: 8px;
          left: 8px;
          width: calc(100% - 16px);
          height: calc(50% - 8px);
          background: #D4A574;
          border-radius: 0 0 167px 167px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .section-label {
          font-size: 2.5rem;
          font-weight: 900;
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          letter-spacing: 2px;
          user-select: none;
        }

        .side-buttons {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .side-btn {
          background: #333;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 1.2rem;
          font-weight: 700;
          cursor: pointer;
          min-width: 100px;
          transition: all 0.2s;
        }

        .side-btn.up-btn.active {
          background: #4CAF50;
        }

        .side-btn.down-btn.active {
          background: #D4A574;
        }

        .side-btn:hover:not(.active) {
          background: #555;
        }

        .bottle-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 260px; /* expanded so the full bottle fits */
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none; /* visual only - interactions on side buttons */
          z-index: 6;
        }

        .bottle {
          width: 240px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.45));
          transform-style: preserve-3d;
          pointer-events: none;
        }

        .bottle-3d { display: none; }

        .bottle-img {
          width: 260px;
          height: auto;
          display: block;
          transform-origin: 50% 50%;
          filter: drop-shadow(0 12px 24px rgba(0,0,0,0.55));
          pointer-events: none;
        }

        /* Horizontal dark green glass bottle */
        .bottle-mouth {
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 20px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.28) 36%, rgba(0,0,0,0.6) 62%, rgba(0,0,0,0.95) 100%);
          box-shadow: inset 0 2px 6px rgba(255,255,255,0.5), 0 2px 6px rgba(0,0,0,0.4);
          z-index: 9;
        }

        .bottle-rim {
          position: absolute;
          left: -6px;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 22px;
          border-radius: 6px 4px 4px 6px;
          background: linear-gradient(90deg, rgba(20,80,30,0.4), rgba(6,30,10,0.8));
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.06);
          z-index: 8;
        }

        .bottle-neck {
          position: absolute;
          left: -4px;
          top: 50%;
          transform: translateY(-50%);
          width: 24px;
          height: 20px;
          border-radius: 6px 4px 4px 6px;
          background: linear-gradient(90deg,#133f18 0%, #06280f 100%);
          box-shadow: inset 0 2px 8px rgba(255,255,255,0.08), 0 6px 14px rgba(0,0,0,0.55);
          z-index: 7;
        }

        .bottle-shoulder {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          width: 28px;
          height: 44px;
          border-radius: 14px 26px 26px 14px;
          background: linear-gradient(90deg,#0f5a23 0%, #072912 100%);
          box-shadow: inset 0 4px 10px rgba(255,255,255,0.06), 0 6px 12px rgba(0,0,0,0.5);
          z-index: 6;
        }

        .bottle-body {
          position: absolute;
          left: 44px;
          top: 50%;
          transform: translateY(-50%);
          width: 140px;
          height: 60px;
          border-radius: 26px;
          background: linear-gradient(90deg,#0b4b19 0%, #05240c 45%, #021307 100%);
          box-shadow: inset 0 12px 30px rgba(255,255,255,0.04), inset 0 -10px 28px rgba(0,0,0,0.7), 0 10px 26px rgba(0,0,0,0.6);
          overflow: visible;
          z-index: 3;
        }

        .bottle-body::before {
          content: '';
          position: absolute;
          inset: 4px 6px 4px 6px;
          border-radius: 14px;
          background: radial-gradient(ellipse at 30% 60%, rgba(255,255,255,0.07), transparent 60%),
                      radial-gradient(ellipse at 80% 40%, rgba(255,255,255,0.03), transparent 70%);
          pointer-events: none;
        }

        .bottle-inner-liquid {
          position: absolute;
          inset: 8px 12px 8px 12px;
          border-radius: 16px;
          background: linear-gradient(90deg, rgba(8,36,14,0.9) 0%, rgba(2,12,6,0.98) 100%);
          box-shadow: inset 0 8px 16px rgba(0,0,0,0.75);
          opacity: 0.6;
        }

        .bottle-reflection {
          position: absolute;
          top: 4px;
          left: 18px;
          width: 56px;
          height: 12px;
          background: linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.06));
          border-radius: 8px;
          transform: skewY(-6deg);
          opacity: 0.85;
          filter: blur(0.8px);
          mix-blend-mode: screen;
          z-index: 8;
        }

        .bottle-glass-sheen {
          position: absolute;
          top: 8px;
          left: 34px;
          width: 26px;
          height: 28px;
          background: radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.02) 50%);
          border-radius: 14px;
          transform: rotate(-12deg);
          opacity: 0.7;
          z-index: 9;
        }

        .bottle-edge {
          position: absolute;
          right: 4px;
          top: 6px;
          width: 6px;
          height: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02));
          border-radius: 3px;
          opacity: 0.6;
          z-index: 9;
        }

        .bottle-base {
          position: absolute;
          right: -4px;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 28px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.55), rgba(0,0,0,0.9));
          border-radius: 50%;
          z-index: 2;
        }

        /* Spin button variants matching choice */
        .spin-btn.spin-up { background: linear-gradient(180deg, #38b24a 0%, #2f9a3f 100%); box-shadow: 0 8px 24px rgba(63, 175, 94, 0.35); }
        .spin-btn.spin-down { background: linear-gradient(180deg, #D4A574 0%, #b98f5a 100%); box-shadow: 0 8px 24px rgba(210,165,116,0.35); }

        .controls-section {
          width: 100%;
          max-width: 600px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .wager-payout-row {
          display: flex;
          gap: 20px;
          justify-content: center;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .input-label {
          color: white;
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .control-input {
          background: rgba(0,0,0,0.4);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          padding: 12px 16px;
          color: white;
          font-size: 1rem;
          font-weight: 700;
          text-align: center;
          width: 150px;
          backdrop-filter: blur(10px);
        }

        .control-input:focus {
          outline: none;
          border-color: rgba(255,255,255,0.5);
        }

        .control-input[readonly] {
          background: rgba(0,0,0,0.2);
          border-color: rgba(255,255,255,0.2);
        }

        .multiple-bets-section {
          width: 300px;
          align-self: center;
        }

        .slider-container {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 20px;
          backdrop-filter: blur(10px);
        }

        .slider-label {
          color: white;
          font-weight: 700;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .slider-value {
          color: #FFB300;
          font-weight: 800;
          font-size: 1.2rem;
        }

        .bets-slider {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(90deg, #9C27B0 0%, rgba(255,255,255,0.3) 100%);
          outline: none;
          -webkit-appearance: none;
          margin-top: 12px;
        }

        .bets-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .spin-btn {
          background: linear-gradient(180deg, #9C27B0 0%, #7B1FA2 100%);
          color: white;
          border: none;
          border-radius: 25px;
          padding: 15px 60px;
          font-size: 1.3rem;
          font-weight: 900;
          letter-spacing: 1px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(156, 39, 176, 0.4);
          transition: all 0.3s ease;
          margin-top: 8px;
          align-self: center;
        }

        .spin-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(156, 39, 176, 0.6);
        }

        .spin-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .sidebar {
          width: 350px;
          background: rgba(0,0,0,0.2);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          position: relative;
          z-index: 1;
        }

        .chat-section {
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          padding: 16px;
          height: 400px;
          display: flex;
          flex-direction: column;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .online-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.7);
          font-size: 0.9rem;
        }

        .online-dot {
          width: 8px;
          height: 8px;
          background: #4CAF50;
          border-radius: 50%;
        }

        .chat-header h3 {
          color: white;
          margin: 0;
          font-size: 1.2rem;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 16px;
        }

        .chat-message {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(45deg, #FFB300, #FF8F00);
          flex-shrink: 0;
        }

        .message-content {
          flex: 1;
        }

        .message-user {
          color: rgba(255,255,255,0.8);
          font-size: 0.85rem;
          margin-bottom: 4px;
        }

        .message-text {
          color: white;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .chat-input-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .chat-input {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
          font-size: 0.9rem;
        }

        .chat-input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .chat-input:focus {
          outline: none;
          border-color: rgba(255,255,255,0.4);
        }

        .char-count {
          color: rgba(255,255,255,0.5);
          font-size: 0.8rem;
          min-width: 40px;
        }

        .send-btn {
          background: #FFB300;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }

        .send-btn:hover {
          background: #FF8F00;
        }

        .history-section {
          background: rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 16px;
          flex: 1;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .history-header h3 {
          color: white;
          margin: 0;
          font-size: 1.2rem;
        }

        .balance-display {
          color: rgba(255,255,255,0.8);
          font-size: 0.9rem;
        }

        .history-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 8px 0;
        }

        .history-row.header {
          font-weight: 700;
          color: rgba(255,255,255,0.8);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 8px;
        }

        .history-row .col {
          color: white;
          font-size: 0.9rem;
        }

        @media (max-width: 1200px) {
          .bottle-game-container {
            flex-direction: column;
          }
          
          .sidebar {
            width: 100%;
            flex-direction: row;
          }
          
          .chat-section,
          .history-section {
            flex: 1;
          }
        }

        @media (max-width: 768px) {
          .game-circle {
            width: 300px;
            height: 300px;
          }
          
          .section-label {
            font-size: 2rem;
          }
          
          .sidebar {
            flex-direction: column;
          }
          
          .game-area {
            padding: 20px;
          }
        }
      `}</style>

    </>
  );
}