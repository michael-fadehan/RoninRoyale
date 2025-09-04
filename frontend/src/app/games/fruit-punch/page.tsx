'use client';

import { useState, useRef, useEffect } from 'react';
import WalletHeader from '../../../components/WalletHeader';
import { useAccount, useBalance } from 'wagmi';
import { useWalletContext } from '../../../lib/wallet-context';
import { io, Socket } from 'socket.io-client';

export default function FruitPunchPage() {
  // Wallet integration
  const { address, isConnected, chainId } = useAccount();
  const { data: ronBalance } = useBalance({ address, chainId: 2021 });
  const { setWalletModalOpen } = useWalletContext();
  const [cycle, setCycle] = useState(2);
  const [wager, setWager] = useState(2);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const adjust = (setter: (fn: (prev: number) => number) => void, delta: number, min = 1, max = 9999) => {
    setter(prev => clamp(prev + delta, min, max));
  };

  const fruitPaths = [
    '/assets/berry.png',
    '/assets/coconut.png',
    '/assets/mango.png',
    '/assets/orange.png',
    '/assets/pineapple.png',
    '/assets/watermelon.png',
  ];

  // fruits state so we can mark them sliced
  const initialFruits = Array.from({ length: 8 }).map((_, i) => {
    const src = fruitPaths[i % fruitPaths.length];
    const offsetY = 20 + (i % 4) * 36; // spread vertically
    const delay = `${-(Math.random() * 8).toFixed(2)}s`;
    const duration = `${8 + (i % 4) * 2 + cycle}s`;
    const isRotten = Math.random() < 0.5; // 50% chance of being rotten
    return { id: i, src, offsetY, delay, duration, sliced: false, isRotten };
  });

  const [fruits, setFruits] = useState(initialFruits);
  const fruitRefs = useRef(new Map<number, HTMLDivElement>());
  const leftCardRef = useRef<HTMLDivElement | null>(null);
  const bigDotRef = useRef<HTMLDivElement | null>(null);
  const knifeRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(true);
  const [knifeActive, setKnifeActive] = useState(false);
  const [slices, setSlices] = useState<Array<any>>([]);
  const [particles, setParticles] = useState<Array<any>>([]);
  const [history, setHistory] = useState<Array<{ wager: number; payout: string; result: string; time: number }>>([]);
  const socketRef = useRef<Socket | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: number; user: string; message: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [resultFeedback, setResultFeedback] = useState<{ text: string; type: 'win' | 'loss' | 'miss'; show: boolean; payout?: number }>({ text: '', type: 'miss', show: false });
  const KNIFE_TRAVEL_MS = 180;

  function playSliceSound(isWin?: boolean) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      
      if (isWin) {
        // Success sound - higher pitch, longer duration
        o.type = 'sine';
        o.frequency.value = 1200;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        o.stop(now + 0.45);
      } else {
        // Regular slice sound
        o.type = 'sine';
        o.frequency.value = 900;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(ctx.destination);
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        o.stop(now + 0.3);
      }
    } catch (e) {
      // ignore if audio not available
    }
  }

  function getFruitColor(src: string) {
    if (src.includes('berry')) return '#E91E63';
    if (src.includes('coconut')) return '#A1887F';
    if (src.includes('mango')) return '#FFB74D';
    if (src.includes('orange')) return '#FF9800';
    if (src.includes('pineapple')) return '#FDD835';
    if (src.includes('watermelon')) return '#66BB6A';
    return '#FFD54F';
  // Socket connection and chat functionality
  useEffect(() => {
    const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
    const s = io(`${backendUrl}/fruit-punch`, { transports: ['websocket'] });
    socketRef.current = s;

    s.on('presence', (p: any) => {
      const n = typeof p?.online === 'number' ? p.online : 0;
      setOnlineCount(Math.max(0, n));
    });
    s.on('chat_message', (m: any) => {
      setChatMessages(prev => [...prev, m]);
    });

    return () => {
      try { s.close(); } catch {}
      socketRef.current = null;
    };
  }, []);

  // Infinite fruit regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setFruits(prev => {
        // Remove sliced fruits and add new ones to maintain flow
        const activeFruits = prev.filter(f => !f.sliced);
        const needNewFruits = 8 - activeFruits.length;
        
        if (needNewFruits > 0) {
          const newFruits = Array.from({ length: needNewFruits }).map((_, i) => {
            const src = fruitPaths[(activeFruits.length + i) % fruitPaths.length];
            const offsetY = 20 + ((activeFruits.length + i) % 4) * 36;
            const delay = `${-(Math.random() * 8).toFixed(2)}s`;
            const duration = `${8 + ((activeFruits.length + i) % 4) * 2 + cycle}s`;
            const isRotten = Math.random() < 0.5;
            return { 
              id: Date.now() + i, 
              src, 
              offsetY, 
              delay, 
              duration, 
              sliced: false, 
              isRotten 
            };
          });
          return [...activeFruits, ...newFruits];
  function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    const out = {
      id: Date.now(),
      user: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous',
      message: msg,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    };
    try { socketRef.current?.emit('chat_message', out); } catch {}
    setChatMessages(prev => [...prev, out]);
    setChatInput('');
  }
  
        }
        return prev;
  
      });
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [cycle, fruitPaths]);

  
  }

  function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    const out = {
      id: Date.now(),
      user: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous',
      message: msg,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    };
    try { socketRef.current?.emit('chat_message', out); } catch {}
    setChatMessages(prev => [...prev, out]);
    setChatInput('');
  }

  return (
    <>
      <WalletHeader />

      <div className="fruit-punch-page">
        <div className="left-card">
          <div className="forest-stage" />
          <div className="fruit-strip" ref={leftCardRef}>
            {fruits.filter(f => !f.sliced).map(f => (
              <div
                key={f.id}
                className={`fruit ${f.isRotten ? 'rotten' : 'fresh'}`}
                ref={(el) => { if (el) fruitRefs.current.set(f.id, el); else fruitRefs.current.delete(f.id); }}
                style={{ ['--duration' as any]: f.duration, ['--delay' as any]: f.delay, ['--ty' as any]: `${f.offsetY}px` }}
              >
                <svg width="168" height="168" viewBox="0 0 168 168" xmlns="http://www.w3.org/2000/svg">
                  <image href={f.src} width="168" height="168" />
                  
                </svg>
              </div>
            ))}

            {/* slice visuals overlay (SVG clipPath halves with animated motion) */}
            <svg className="slice-layer" width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
              {slices.map((s, idx) => {
                const leftId = `clipL-${s.key}`;
                const rightId = `clipR-${s.key}`;
                return (
                  <g key={s.key} transform={`translate(${s.left}, ${s.top})`}>
                    <defs>
                      <clipPath id={leftId}><rect x={0} y={0} width={s.width / 2} height={s.height} /></clipPath>
                      <clipPath id={rightId}><rect x={s.width / 2} y={0} width={s.width / 2} height={s.height} /></clipPath>
                    </defs>

                    <image className="slice-left" href={s.src} width={s.width} height={s.height} clipPath={`url(#${leftId})`} />
                    <image className="slice-right" href={s.src} width={s.width} height={s.height} clipPath={`url(#${rightId})`} />
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="controls">
            <div className="control-item">
              <div
                className="control-circle"
                onWheel={(e) => { e.preventDefault(); adjust(setCycle, e.deltaY < 0 ? 1 : -1, 1, 60); }}
              >
                <input
                  type="number"
                  value={cycle}
                  onChange={(e) => setCycle(Number(e.target.value) || 0)}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp') adjust(setCycle, 1, 1, 60); if (e.key === 'ArrowDown') adjust(setCycle, -1, 1, 60); }}
                />
              </div>
              <div className="control-label">Cycle (s)</div>
            </div>
            {/* start/clear removed - fruits flow immediately */}
            <div className={`knife ${knifeActive ? 'active' : ''}`} ref={knifeRef} onClick={() => {
              // wallet and wager checks
              if (!isConnected) { alert('Please connect your wallet before playing.'); return; }
              if (!wager || wager <= 0) { alert('Please set a wager before playing.'); return; }
              if (!running) return;
              setKnifeActive(true);
              // small timeout to reset active state
              setTimeout(() => setKnifeActive(false), 400);

              // collision detection: check fruits in the knife's path
              const leftCard = leftCardRef.current;
              if (!leftCard) return;
              const cardRect = leftCard.getBoundingClientRect();
              const hit: number[] = [];
              
              // Define knife path - vertical line through center of card
              const knifeCenterX = cardRect.left + cardRect.width / 2;
              const knifeWidth = 40; // collision width for knife
              
              fruitRefs.current.forEach((el, id) => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                // Check if fruit intersects with knife's vertical path
                const fruitCenterX = r.left + r.width / 2;
                const horizontalDistance = Math.abs(fruitCenterX - knifeCenterX);
                
                // Fruit is hit if it's within knife width and in the fruit strip area
                if (horizontalDistance < knifeWidth && r.top < cardRect.bottom && r.bottom > cardRect.top + 48) {
                  hit.push(id);
                }
              });

              if (hit.length > 0) {
                // mark sliced
                setFruits(prev => prev.map(f => hit.includes(f.id) ? { ...f, sliced: true } : f));
                const newSlices = hit.map(id => {
                  const el = fruitRefs.current.get(id);
                  const rect = el?.getBoundingClientRect();
                  const leftCardRect = leftCardRef.current?.getBoundingClientRect();
                  const relLeft = leftCardRect ? (rect!.left - leftCardRect.left) : (rect!.left);
                  return {
                    key: `${id}-${Date.now()}`,
                    id,
                    left: relLeft,
                    top: rect!.top - (leftCardRect?.top || 0),
                    width: rect!.width,
                    height: rect!.height,
                    src: fruits.find(f => f.id === id)?.src,
                    side: 'both'
                  };
                });
                // Outcome resolution based on fruit quality
                const slicedFruit = fruits.find(f => hit.includes(f.id));
                const isWin = slicedFruit && !slicedFruit.isRotten; // Win only if fruit is fresh/good
                const houseEdge = 0.10;
                const payoutMultiplier = 1.8; // 2x payout minus 10% house edge
                const payout = isWin ? Number((wager * payoutMultiplier).toFixed(4)) : 0;
                const result = slicedFruit ? (slicedFruit.isRotten ? 'rotten' : 'win') : 'blank';

                // record history (primary hit) at slice time
                setTimeout(() => {
                  const payoutText = isWin ? `R ${payout}` : 'R 0';
                  const resultText = result === 'rotten' ? 'Rotten!' : result === 'win' ? 'Fresh!' : 'Miss!';
                  setHistory(h => [{ wager, payout: payoutText, result: resultText, time: Date.now() }, ...h]);
                  
                  // Show result feedback
                  const feedbackType = result === 'win' ? 'win' : 'loss';
                  const feedbackText = result === 'rotten' ? 'ROTTEN FRUIT!' : result === 'win' ? 'FRESH FRUIT!' : 'MISSED!';
                  setResultFeedback({ text: feedbackText, type: feedbackType, show: true });
                  setTimeout(() => setResultFeedback(prev => ({ ...prev, show: false })), 2000);
                }, KNIFE_TRAVEL_MS);

                // delay adding slice visuals and particles until knife travel completes (visual sync)
                setTimeout(() => {
                  setSlices(s => [...s, ...newSlices]);

                  // spawn several colored juice particles per slice
                  const juiceParticles: any[] = [];
                  newSlices.forEach(ns => {
                    const color = getFruitColor(ns.src);
                    for (let k = 0; k < 8; k++) {
                      const rx = (Math.random() - 0.5) * ns.width * 0.5;
                      const ry = (Math.random() - 0.5) * ns.height * 0.3;
                      juiceParticles.push({ x: ns.left + ns.width/2 + rx, y: ns.top + ns.height/2 + ry, t: Date.now(), id: ns.id + '-' + k, color });
                    }
                  });
                  setParticles(p => [...p, ...juiceParticles]);

                  // play slice sound based on result
                  playSliceSound(isWin);
                }, KNIFE_TRAVEL_MS);
              } else {
                // blank slice -> house wins
                setHistory(h => [{ wager, payout: 'R 0', result: 'Miss!', time: Date.now() }, ...h]);
                playSliceSound();
                
                // Show miss feedback
                setResultFeedback({ text: 'MISSED!', type: 'miss', show: true });
                setTimeout(() => setResultFeedback(prev => ({ ...prev, show: false })), 2000);
              }
            }}>
              <div className="knife-path">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
                <div className="dot big" ref={bigDotRef} />
                <div className="triangle top" />
              </div>

              <div className="tri-left" />
              <div className="tri-right" />

              <div className="knife-img">
                <img src="/assets/knife.png" alt="knife" />
              </div>
            </div>
            <div className="control-item">
              <div
                className="control-circle"
                onWheel={(e) => { e.preventDefault(); adjust(setWager, e.deltaY < 0 ? 1 : -1, 1, 1000); }}
              >
                <input
                  type="number"
                  value={wager}
                  onChange={(e) => setWager(Number(e.target.value) || 0)}
                  onKeyDown={(e) => { if (e.key === 'ArrowUp') adjust(setWager, 1, 1, 1000); if (e.key === 'ArrowDown') adjust(setWager, -1, 1, 1000); }}
                />
              </div>
              <div className="control-label">Wager</div>
            </div>
          </div>
        </div>

        <div className="right-column">
          <div className="chat-card">
            <div className="chat-header">Chat <span className="online">{onlineCount} online</span></div>
            <div className="chat-body">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="chat-message">
                  <span className="chat-time">{msg.time}</span>
                  <span className="chat-user">{msg.user}:</span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input 
                placeholder="Write Something" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>

          <div className="history-card">
            <div className="history-header">
              <div>History</div>
              <div className="balance">Ronin Balance : R <strong>45.00</strong></div>
            </div>
            <div className="history-body">
              <table>
                <thead>
                  <tr><th>Wager</th><th>Payout</th></tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((h, i) => (
                    <tr key={h.time}>
                      <td>R {h.wager}</td>
                      <td className={h.result === 'Fresh!' ? 'win' : 'loss'}>{h.payout}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={2} style={{textAlign: 'center', opacity: 0.6}}>No games played yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* particle layer */}
      <div className="particle-layer">
        {particles.map((p, i) => (
          <div key={p.id + '-' + p.t} className="particle" style={{ left: p.x + 'px', top: p.y + 'px', ['--pcolor' as any]: p.color || '#FFD54F' }} />
        ))}
      {/* Result feedback overlay */}
      {resultFeedback.show && (
        <div className={`result-feedback ${resultFeedback.type}`}>
          <div className="result-text">{resultFeedback.text}</div>
          {resultFeedback.type === 'win' && resultFeedback.payout && <div className="result-payout">+R {resultFeedback.payout}</div>}
        </div>
      )}
      </div>

      <style jsx>{`
        .fruit-punch-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 20px;
          align-items: start;
          padding: 24px;
          padding-top: 120px; /* space for the header */
          /* reuse home hero background without particle/illustration overlays */
          background: linear-gradient(120deg, rgba(19,58,27,0.98) 10%, rgba(38,82,36,0.96) 50%, rgba(38,82,36,0.65) 72%, rgba(38,82,36,0) 100%);
          position: relative;
          z-index: 2; /* ensure content sits above global overlays */
        }

        .left-card {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          position: relative;
          height: 780px;
          overflow: hidden;
        }

        .forest-stage {
          position: absolute;
          inset: 0;
          background-image: url('/assets/forest.jpg');
          background-size: cover;
          background-position: center;
        }

        .controls {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 40px;
          pointer-events: none;
        }

        .control-item {
          text-align: center;
          color: white;
          pointer-events: auto;
        }

        .control-circle {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #59a7ff, #0a58d1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 2rem;
          margin-bottom: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .control-circle input {
          width: 56px;
          background: transparent;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 1.6rem;
          text-align: center;
          -moz-appearance: textfield;
        }
        .control-circle input::-webkit-outer-spin-button,
        .control-circle input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .control-label { color: white; font-weight: 700; }

        .knife { pointer-events: auto; }
        .knife-img {
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: #111;
          margin: 0 auto;
          box-shadow: 0 6px 12px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .knife-img img { width: 120px; transform: rotate(0deg); }
        .knife.active .knife-img img { transform: translateY(-600px) scale(1.1); transition: transform 220ms ease }
        .knife-path { position: absolute; left: 50%; top: -120px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none }
        /* Chat message styles */
        .chat-message {
          margin-bottom: 8px;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        
        .chat-time {
          color: #888;
          font-size: 0.8rem;
          margin-right: 8px;
        }
        
        .chat-user {
          font-weight: 600;
          color: #333;
          margin-right: 6px;
        }
        
        .chat-text {
          color: #555;
        }
        
        .chat-body {
          max-height: 300px;
          overflow-y: auto;
        }
        .knife-path .dot { width: 14px; height: 14px; background: #2aa3ff; border-radius: 50%; box-shadow: 0 4px 8px rgba(42,163,255,0.24); }
        .knife-path .dot.big { width: 22px; height: 22px; }
        .knife-path .triangle.top { width: 0; height: 0; border-left: 18px solid transparent; border-right: 18px solid transparent; border-bottom: 26px solid #2aa3ff; margin-top: -6px }
        .knife-path .dot.big { position: relative }
        .knife-path .dot.big::after { content: ''; position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 36px; height: 36px; border-radius: 50%; box-shadow: 0 8px 20px rgba(42,163,255,0.12); }

        .tri-left, .tri-right { position: absolute; top: -40px; width: 0; height: 0; border-left: 16px solid transparent; border-right: 16px solid transparent; border-bottom: 26px solid rgba(255,255,255,0.85); opacity: 0.95 }
        .tri-left { left: calc(50% - 90px); transform: rotate(-18deg) }
        .tri-right { right: calc(50% - 90px); transform: rotate(18deg) }

        .right-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .fruit-strip { position: absolute; top: 48px; left: 36px; right: 36px; height: 420px; pointer-events: none; overflow: hidden }
        .fruit { position: absolute; top: var(--ty); left: -240px; animation: fruitMove var(--duration) linear infinite; animation-delay: var(--delay); }
        .fruit svg { width: 168px; height: 168px; display: block }
        
        @keyframes fruitMove { 0% { left: -240px } 100% { left: calc(100% + 240px) } }

        /* slice visuals */
        .slice { position: absolute; background-size: cover; background-position: center; pointer-events: none; transform-origin: center; }
        .slice-layer image.slice-left { transform-origin: left center; animation: sliceLeftMove calc(var(--knife-ms, 220ms)) ease forwards }
        .slice-layer image.slice-right { transform-origin: right center; animation: sliceRightMove calc(var(--knife-ms, 220ms)) ease forwards }
        @keyframes sliceLeftMove { 0% { transform: translate(0px,0px) rotate(0deg); opacity: 1 } 50% { transform: translate(-18px,28px) rotate(-6deg); opacity: 1 } 100% { transform: translate(-60px,140px) rotate(-24deg); opacity: 0 } }
        @keyframes sliceRightMove { 0% { transform: translate(0px,0px) rotate(0deg); opacity: 1 } 50% { transform: translate(18px,38px) rotate(6deg); opacity: 1 } 100% { transform: translate(60px,160px) rotate(18deg); opacity: 0 } }
        /* start/clear removed - fruits flow immediately */
        .particle-layer { position: absolute; inset: 0; pointer-events: none }
        .particle { position: absolute; width: 8px; height: 8px; border-radius: 50%; background: var(--pcolor, #FFD54F); box-shadow: 0 4px 12px rgba(255,213,79,0.24); animation: particleMove 900ms ease forwards }
        @keyframes particleMove { 0% { transform: translateY(0) scale(1); opacity: 1 } 100% { transform: translateY(160px) scale(0.4); opacity: 0 } }

        .chat-card {
          background: #3f3f3f;
          color: #fff;
          border-radius: 8px;
          height: 460px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-header {
          padding: 18px 20px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0,0,0,0.2);
        }

        .chat-header .online { color: #6ee56e; font-weight: 600; margin-left: 8px }

        .chat-body { flex: 1; padding: 20px; overflow: auto; }

        .chat-input { display: flex; gap: 8px; padding: 12px; background: rgba(255,255,255,0.03);} 
        .chat-input input { flex: 1; padding: 8px 12px; border-radius: 6px; border: none; }
        .chat-input button { padding: 8px 12px; border-radius: 6px; background: #2b2b2b; color: white; border: none; }

        .history-card {
          background: #dbe6de;
          border-radius: 8px;
          height: 280px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .history-header { display: flex; justify-content: space-between; padding: 18px; font-weight: 700; }
        .history-body { padding: 12px 18px; overflow: auto; flex: 1 }
        /* Result feedback overlay */
        .result-feedback {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          text-align: center;
          pointer-events: none;
          animation: resultFeedbackShow 2s ease forwards;
        }
        
        .result-text {
          font-size: 3rem;
          font-weight: 900;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
          margin-bottom: 8px;
        }
        
        .result-payout {
          font-size: 2rem;
          font-weight: 700;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        
        .result-feedback.win .result-text { color: #4CAF50; }
        .result-feedback.win .result-payout { color: #66BB6A; }
        .result-feedback.loss .result-text { color: #f44336; }
        .result-feedback.miss .result-text { color: #FF9800; }
        
        @keyframes resultFeedbackShow {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
        .history-body table { width: 100%; border-collapse: collapse }
        .history-body th, .history-body td { text-align: left; padding: 6px 8px }
        .history-body .win { color: #4CAF50; font-weight: 600; }
        .history-body .loss { color: #f44336; font-weight: 600; }

      `}</style>
    </>
  );
}