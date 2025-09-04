
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import WalletHeader from '../../../components/WalletHeader';
import { useAccount, useBalance, useEnsName } from 'wagmi';
import { useWalletContext } from '../../../lib/wallet-context';
import { roninSaigon } from '../../../lib/reown';
import { io, Socket } from 'socket.io-client';

type DiceTriplet = [number, number, number];
type Phase = 'idle' | 'player' | 'cpu' | 'final';

export default function DiceRollPage() {
  // Gameplay state
  const [wager, setWager] = useState(0.5);
  const [playerDice, setPlayerDice] = useState<DiceTriplet>([1, 1, 1]);
  const [cpuDice, setCpuDice] = useState<DiceTriplet>([1, 1, 1]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [cpuTotal, setCpuTotal] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lastOutcome, setLastOutcome] = useState<null | 'win' | 'lose' | 'tie'>(null);
  const [playerLog, setPlayerLog] = useState<string[]>([]);
  const [cpuLog, setCpuLog] = useState<string[]>([]);

  // History (wager/payout)
  const [history, setHistory] = useState<{ wager: number; payout: number; label: string }[]>([]);

  // Chat
  const socketRef = useRef<null | Socket>(null);
  const [chatMessages, setChatMessages] = useState<{ id: number; user: string; message: string; time: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);

  // Wallet
  const { address, isConnected, chainId } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: 1, query: { enabled: false } });
  const { data: ronBalance, refetch: refetchBalance } = useBalance({ address, chainId: 2021 });
  const { setWalletModalOpen, ensureCorrectNetwork, isAutoSwitching } = useWalletContext();

  // 3D dice animation state
  const [diceRotations, setDiceRotations] = useState([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }
  ]);
  const animPlayerRef = useRef<number | null>(null);
  const animCpuRef = useRef<number | null>(null);

  // Derived
  const backendUrl = useMemo(
    () => (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, ''),
    []
  );
  const walletBalance = useMemo(
    () => (isConnected && ronBalance ? Number(ronBalance.formatted) : 0),
    [isConnected, ronBalance]
  );

  // Helpers
  function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
  }
  function shorten(addr?: string) { return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : ''; }

  // Socket: chat/presence (namespace /dice)
  useEffect(() => {
    const s = io(`${backendUrl}/dice`, { transports: ['websocket'] });
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

  function startAnim(which: 'player' | 'cpu') {
    if (which === 'player') {
      if (animPlayerRef.current) return;
      const step = () => {
        animPlayerRef.current = requestAnimationFrame(step);
        // Realistic 3D rolling animation
        setDiceRotations(prev => prev.map(() => ({
          x: Math.random() * 720 - 360,
          y: Math.random() * 720 - 360,
          z: Math.random() * 720 - 360
        })));
        setPlayerDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      };
      animPlayerRef.current = requestAnimationFrame(step);
    } else {
      if (animCpuRef.current) return;
      const step = () => {
        animCpuRef.current = requestAnimationFrame(step);
        setDiceRotations(prev => prev.map(() => ({
          x: Math.random() * 720 - 360,
          y: Math.random() * 720 - 360,
          z: Math.random() * 720 - 360
        })));
        setCpuDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      };
      animCpuRef.current = requestAnimationFrame(step);
    }
  }

  function stopAnim(which: 'player' | 'cpu', finalDice?: DiceTriplet) {
    if (which === 'player') {
      if (animPlayerRef.current) cancelAnimationFrame(animPlayerRef.current);
      animPlayerRef.current = null;
    } else {
      if (animCpuRef.current) cancelAnimationFrame(animCpuRef.current);
      animCpuRef.current = null;
    }
    
    // Set final rotations to show correct face
    if (finalDice) {
      setDiceRotations(prev => prev.map((_, i) => {
        const value = finalDice[i];
        // Map dice values to specific rotations to show correct face
        const rotationMap = {
          1: { x: 0, y: 0, z: 0 },
          2: { x: 0, y: 90, z: 0 },
          3: { x: 0, y: 180, z: 0 },
          4: { x: 0, y: 270, z: 0 },
          5: { x: 90, y: 0, z: 0 },
          6: { x: -90, y: 0, z: 0 }
        };
        return rotationMap[value as keyof typeof rotationMap] || { x: 0, y: 0, z: 0 };
      }));
    }
  }

  async function ensureMin(ms: number, startedAt: number) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < ms) {
      await new Promise(r => setTimeout(r, ms - elapsed));
    }
  }

  async function roll() {
    try {
      if (!isConnected) {
        setWalletModalOpen(true);
        return;
      }
      if (chainId !== roninSaigon.id) {
        const ok = await ensureCorrectNetwork();
        if (!ok) return;
      }
      if (!Number.isFinite(wager) || wager < 0.01) return;
      if (wager > walletBalance) return;
      if (rolling) return; // prevent concurrent presses

      setRolling(true);
      setLastOutcome(null);

      // Fetch result once (player+cpu), but reveal sequentially
      const reqStart = Date.now();
      const respPromise = fetch(`${backendUrl}/api/games/dice/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wager }),
      });

      // Phase 1: Player roll (5s animation)
      setPhase('player');
      startAnim('player');
      const resp = await respPromise;
      if (!resp.ok) throw new Error(`Dice roll failed: ${resp.status}`);
      const data: {
        roundId: string;
        player: { dice: DiceTriplet; total: number };
        cpu: { dice: DiceTriplet; total: number };
        result: 'win' | 'lose' | 'tie';
        payout: number;
        wager: number;
      } = await resp.json();

      await ensureMin(5000, reqStart); // minimum 5s for player
      stopAnim('player', data.player.dice);
      // Reveal player's result
      setPlayerDice(data.player.dice);
      setPlayerTotal(data.player.total);
      setPlayerLog((prev) => [
        `Player rolled ${data.player.dice.join('-')} (=${data.player.total})`,
        ...prev,
      ].slice(0, 8));

      // Phase 2: CPU roll (5s animation)
      setPhase('cpu');
      const cpuStart = Date.now();
      startAnim('cpu');
      await ensureMin(5000, cpuStart);
      stopAnim('cpu', data.cpu.dice);
      setCpuDice(data.cpu.dice);
      setCpuTotal(data.cpu.total);
      setCpuLog((prev) => [
        `CPU rolled ${data.cpu.dice.join('-')} (=${data.cpu.total})`,
        ...prev,
      ].slice(0, 8));

      // Finalize
      setPhase('final');
      setLastOutcome(data.result);

      const label = data.result === 'win' ? `R ${data.payout.toFixed(2)}` : (data.result === 'tie' ? 'Refund' : 'Unlucky!');
      setHistory((h) => [{ wager: data.wager, payout: data.payout, label }, ...h].slice(0, 10));

      try { await refetchBalance?.(); } catch {}

      // small delay to feel complete
      await new Promise(r => setTimeout(r, 180));
    } catch (e) {
      console.error(e);
      // stop any running anims
      stopAnim('player');
      stopAnim('cpu');
    } finally {
      setPhase('idle');
      setRolling(false);
    }
  }

  // 3D Dice Component
  function Dice3D({ value, rotation, index }: { value: number; rotation: { x: number; y: number; z: number }; index: number }) {
    const isAnimating = phase === 'player' || phase === 'cpu';
    
    return (
      <div 
        className={`dice-3d dice-${index}`}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
          transition: isAnimating ? 'none' : 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        <div className="face front" data-value="1">
          <div className="dot center" />
        </div>
        <div className="face back" data-value="6">
          <div className="dot top-left" />
          <div className="dot top-right" />
          <div className="dot middle-left" />
          <div className="dot middle-right" />
          <div className="dot bottom-left" />
          <div className="dot bottom-right" />
        </div>
        <div className="face right" data-value="3">
          <div className="dot top-left" />
          <div className="dot center" />
          <div className="dot bottom-right" />
        </div>
        <div className="face left" data-value="4">
          <div className="dot top-left" />
          <div className="dot top-right" />
          <div className="dot bottom-left" />
          <div className="dot bottom-right" />
        </div>
        <div className="face top" data-value="2">
          <div className="dot top-left" />
          <div className="dot bottom-right" />
        </div>
        <div className="face bottom" data-value="5">
          <div className="dot top-left" />
          <div className="dot top-right" />
          <div className="dot center" />
          <div className="dot bottom-left" />
          <div className="dot bottom-right" />
        </div>
      </div>
    );
  }

  return (
    <>
      <WalletHeader />

      <div className="dice-page">
        <div className="left-panel">
          <div className="stage-wrap">
            <div className="stage-bg" />

            {/* 3D dice positioned naturally on the table */}
            <div className="dice-container">
              <Dice3D value={playerDice[0]} rotation={diceRotations[0]} index={0} />
              <Dice3D value={playerDice[1]} rotation={diceRotations[1]} index={1} />
              <Dice3D value={playerDice[2]} rotation={diceRotations[2]} index={2} />
            </div>

            <button
              className="roll-btn"
              onClick={roll}
              disabled={rolling || !isConnected || isAutoSwitching || wager < 0.01 || wager > walletBalance}
              title={!isConnected ? 'Connect wallet' : (chainId !== roninSaigon.id ? 'Switch to Saigon' : '')}
            >
              {phase === 'player' ? 'Rolling Player...' : phase === 'cpu' ? 'Rolling CPU...' : (isAutoSwitching ? 'Switching...' : 'Roll')}
            </button>
          </div>

          {/* Scoreboard: Player | CPU | Controls */}
          <div className="scoreboard">
            <div className="panel player">
              <div className="panel-head">Player 1</div>
              <div className="panel-score">{playerTotal}</div>
              <div className="logs">
                <div className="logs-head">Roll Logs</div>
                <div className="logs-body">
                  {playerLog.length === 0 ? 'Player 1 rolled ...' : playerLog.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>

            <div className="panel cpu">
              <div className="panel-head">CPU</div>
              <div className="panel-score">{cpuTotal}</div>
              <div className="logs">
                <div className="logs-head">Roll Logs</div>
                <div className="logs-body">
                  {cpuLog.length === 0 ? 'CPU rolled ...' : cpuLog.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            </div>

            {/* Controls moved here (left bottom third card) */}
            <div className="panel controls-card">
              <div className="panel-head">Wager</div>
              <div className="controls">
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={wager}
                  onChange={e => setWager(clamp(parseFloat(e.target.value || '0') || 0, 0.01, walletBalance))}
                />
                <div className="quick">
                  <button onClick={() => setWager(0.01)}>MIN</button>
                  <button onClick={() => setWager(v => Math.max(0.01, Number((v / 2).toFixed(2))))}>1/2</button>
                  <button onClick={() => setWager(v => clamp(Number((v * 2).toFixed(2)), 0.01, walletBalance))}>x2</button>
                  <button onClick={() => setWager(Number(walletBalance.toFixed(2)))}>MAX</button>
                </div>
                <div className="payout-note">Win pays 2.0x • Tie refunds wager</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Chat on top, History at bottom */}
        <div className="right-panel">
          <div className="chat-card">
            <div className="chat-head">
              <div className="online-dot" />
              <div>online</div>
              <div className="spacer" />
              <div className="title">Chat</div>
            </div>

            <div className="chat-body">
              {chatMessages.map(m => (
                <div key={m.id} className="msg">
                  <div className="avatar" />
                  <div className="bubble"><strong>{m.user}</strong> {m.message}</div>
                </div>
              ))}
            </div>

            <div className="chat-foot">
              <input
                placeholder="Write Something"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>

          {/* History moved here */}
          <div className="history">
            <div className="history-head">
              <div>History</div>
              <div className="bal">Ronin Balance : {ronBalance ? `R ${Number(ronBalance.formatted).toFixed(2)}` : (isConnected ? '...' : 'Connect wallet')}</div>
            </div>
            <div className="history-grid">
              <div className="col head">Wager</div>
              <div className="col head">Payout</div>
              {history.map((h, i) => (
                <div key={i} className="row2">
                  <div className="col">R {h.wager.toFixed(2)}</div>
                  <div className="col">{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dice-page {
          padding-top: 72px;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 16px;
          background: #d8f0db;
        }
        .left-panel {
          padding: 16px 16px 24px 16px;
        }
        .right-panel {
          padding: 16px 16px 24px 0;
          display: grid;
          grid-template-rows: 1fr auto;
          gap: 16px;
        }

        .stage-wrap {
          position: relative;
          height: 420px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.35);
          background: #2f2f2f;
        }
        .stage-bg {
          position: absolute;
          inset: 0;
          background: url('/assets/wood.png') center/cover no-repeat;
          opacity: 0.85;
          filter: saturate(0.9);
        }

        /* 3D Dice Container */
        .dice-container {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 30px;
          perspective: 1200px;
          perspective-origin: center center;
        }

        /* 3D Dice */
        .dice-3d {
          position: relative;
          width: 80px;
          height: 80px;
          transform-style: preserve-3d;
          margin: 10px;
        }

        .dice-0 { transform: translateX(-50px) translateY(-15px) translateZ(10px); }
        .dice-1 { transform: translateX(0px) translateY(20px) translateZ(5px); }
        .dice-2 { transform: translateX(50px) translateY(-10px) translateZ(15px); }

        .face {
          position: absolute;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #e8e8e8 100%);
          border: 2px solid #ddd;
          border-radius: 12px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-around;
          align-items: center;
          padding: 8px;
          box-shadow: 
            inset 0 0 20px rgba(255,255,255,0.9),
            inset 0 0 10px rgba(0,0,0,0.05),
            0 12px 25px rgba(0,0,0,0.4);
        }

        .face.front { transform: rotateY(0deg) translateZ(40px); }
        .face.back { transform: rotateY(180deg) translateZ(40px); }
        .face.right { transform: rotateY(90deg) translateZ(40px); }
        .face.left { transform: rotateY(-90deg) translateZ(40px); }
        .face.top { transform: rotateX(90deg) translateZ(40px); }
        .face.bottom { transform: rotateX(-90deg) translateZ(40px); }

        .dot {
          width: 14px;
          height: 14px;
          background: #222;
          border-radius: 50%;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }

        /* Dot positioning for each face */
        .face[data-value="1"] .dot:not(.center) { display: none; }
        .face[data-value="1"] .center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }

        .face[data-value="2"] .dot:not(.top-left):not(.bottom-right) { display: none; }
        .face[data-value="2"] .top-left { position: absolute; top: 18px; left: 18px; }
        .face[data-value="2"] .bottom-right { position: absolute; bottom: 18px; right: 18px; }

        .face[data-value="3"] .dot:not(.top-left):not(.center):not(.bottom-right) { display: none; }
        .face[data-value="3"] .top-left { position: absolute; top: 18px; left: 18px; }
        .face[data-value="3"] .center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .face[data-value="3"] .bottom-right { position: absolute; bottom: 18px; right: 18px; }

        .face[data-value="4"] .dot:not(.top-left):not(.top-right):not(.bottom-left):not(.bottom-right) { display: none; }
        .face[data-value="4"] .top-left { position: absolute; top: 18px; left: 18px; }
        .face[data-value="4"] .top-right { position: absolute; top: 18px; right: 18px; }
        .face[data-value="4"] .bottom-left { position: absolute; bottom: 18px; left: 18px; }
        .face[data-value="4"] .bottom-right { position: absolute; bottom: 18px; right: 18px; }

        .face[data-value="5"] .dot:not(.top-left):not(.top-right):not(.center):not(.bottom-left):not(.bottom-right) { display: none; }
        .face[data-value="5"] .top-left { position: absolute; top: 18px; left: 18px; }
        .face[data-value="5"] .top-right { position: absolute; top: 18px; right: 18px; }
        .face[data-value="5"] .center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .face[data-value="5"] .bottom-left { position: absolute; bottom: 18px; left: 18px; }
        .face[data-value="5"] .bottom-right { position: absolute; bottom: 18px; right: 18px; }

        .face[data-value="6"] .top-left { position: absolute; top: 18px; left: 18px; }
        .face[data-value="6"] .top-right { position: absolute; top: 18px; right: 18px; }
        .face[data-value="6"] .middle-left { position: absolute; top: 50%; left: 18px; transform: translateY(-50%); }
        .face[data-value="6"] .middle-right { position: absolute; top: 50%; right: 18px; transform: translateY(-50%); }
        .face[data-value="6"] .bottom-left { position: absolute; bottom: 18px; left: 18px; }
        .face[data-value="6"] .bottom-right { position: absolute; bottom: 18px; right: 18px; }

        .roll-btn {
          position: absolute;
          left: 50%;
          bottom: 18px;
          transform: translateX(-50%);
          background: #111;
          color: #fff;
          border: 0;
          border-radius: 14px;
          padding: 10px 26px;
          font-weight: 800;
          letter-spacing: .3px;
          box-shadow: 0 10px 20px rgba(0,0,0,0.35);
          cursor: pointer;
        }
        .roll-btn:disabled { opacity: .7; cursor: not-allowed; }

        .scoreboard {
          margin-top: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr 1.2fr;
          gap: 14px;
        }
        .panel {
          background: #f3f3f3;
          border-radius: 12px;
          padding: 10px;
          border: 1px solid rgba(0,0,0,0.08);
          box-shadow: 0 8px 18px rgba(0,0,0,0.12);
        }
        .panel-head {
          background: #FFA000;
          color: #fff;
          font-weight: 800;
          text-align: center;
          padding: 8px 10px;
          border-radius: 10px;
          margin-bottom: 10px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.12);
        }
        .panel-score {
          font-size: 60px;
          font-weight: 900;
          color: #fff;
          background: #f5c36c;
          text-shadow: 0 3px 1px rgba(0,0,0,0.15);
          border-radius: 12px;
          display: grid;
          place-items: center;
          height: 120px;
          margin-bottom: 10px;
          box-shadow: inset 0 2px 10px rgba(255,255,255,0.5), 0 8px 18px rgba(0,0,0,0.12);
        }
        .logs {
          background: #e9ecef;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .logs-head { text-align: center; font-weight: 800; padding: 8px 10px; border-bottom: 1px solid rgba(0,0,0,0.08); }
        .logs-body { height: 96px; overflow: auto; padding: 8px 10px; font-size: 12px; color: #333; }

        .controls-card .controls {
          display: grid;
          gap: 8px;
        }
        .controls-card input {
          width: 100%;
          background: #f5f5f5;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          padding: 8px 10px;
          font-weight: 700;
        }
        .controls-card .quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .controls-card .quick button {
          background: #3a3a3a;
          color: #fff;
          border: 0;
          border-radius: 8px;
          padding: 8px 0;
          font-weight: 800;
          cursor: pointer;
        }
        .payout-note { font-size: 12px; color: #333; text-align: center; margin-top: 2px; }

        .chat-card {
          background: #3c3c3c;
          border-radius: 14px;
          padding: 10px;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 8px;
        }
        .chat-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
          font-weight: 800;
        }
        .online-dot { width: 8px; height: 8px; border-radius: 50%; background: #44d160; }
        .spacer { flex: 1; }
        .title { font-weight: 900; }
        .chat-body {
          overflow: auto;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          padding: 8px;
          max-height: 300px;
        }
        .msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
        .avatar { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(45deg,#FFB300,#FF8F00); flex: 0 0 auto; }
        .bubble { background: rgba(255,255,255,0.08); padding: 8px 10px; border-radius: 10px; }
        .chat-foot { display: flex; gap: 8px; }
        .chat-foot input {
          flex: 1;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.18);
          color: #fff;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .chat-foot button {
          background: #FFB300;
          color: #000;
          border: 0;
          border-radius: 8px;
          padding: 8px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .history {
          background: #e8f2ea;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          padding: 10px;
        }
        .history-head { display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 8px; }
        .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
        .history-grid .head { font-weight: 800; }
        .row2 { display: contents; }
      `}</style>
    </>
  );
}
