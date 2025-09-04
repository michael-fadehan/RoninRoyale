
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, useDisconnect, useEnsName, useWalletClient } from 'wagmi';
import { useBalance } from 'wagmi';
import WalletHeader from '../../../components/WalletHeader';
import { useWalletContext } from '../../../lib/wallet-context';
import { roninSaigon } from '../../../lib/reown';
import { io, Socket } from 'socket.io-client';
import { BrowserProvider, Contract, parseUnits, Interface } from 'ethers';

export default function CoinFlipPage() {
  const [mode, setMode] = useState('single' as 'single' | 'multi');
  const [wager, setWager] = useState(0.01);
  const [bets, setBets] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [selectedSide, setSelectedSide] = useState('heads' as 'heads'|'tails');
  const [coinRotation, setCoinRotation] = useState(0);
  // animation duration (ms) for coin flip - allow up to 6s so tx can confirm during animation
  const ANIMATION_MS = 6000
  const coinRef = useRef(null as null | HTMLDivElement);
  const spinnerRef = useRef(null as number | null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Start a continuous JS-driven spin (uses requestAnimationFrame to update rotation)
  function startSpin() {
    if (spinnerRef.current) return;
    const step = () => {
      spinnerRef.current = requestAnimationFrame(step);
      setCoinRotation(r => r + 8); // deg per frame, tweak for speed
    };
    spinnerRef.current = requestAnimationFrame(step);
  }
  function stopSpin() {
    if (spinnerRef.current) {
      cancelAnimationFrame(spinnerRef.current);
      spinnerRef.current = null;
    }
  }

  async function waitForCoinSettle(ms: number) {
    if (!coinRef.current) { await new Promise(r => setTimeout(r, ms)); return; }
    await new Promise<void>(resolve => {
      const el = coinRef.current!;
      let done = false;
      const onEnd = (e: TransitionEvent) => {
        if ((e as any).propertyName === 'transform') {
          done = true;
          el.removeEventListener('transitionend', onEnd as any);
          clearTimeout(timer);
          resolve();
        }
      };
      el.addEventListener('transitionend', onEnd as any);
      const timer = setTimeout(() => {
        if (!done) {
          el.removeEventListener('transitionend', onEnd as any);
          resolve();
        }
      }, ms + 120);
    });
  }

  // Cleanup spinner if component unmounts
  useEffect(() => () => { stopSpin(); }, []);
  const [lastResult, setLastResult] = useState(null as null | 'win' | 'lose');
  const [history, setHistory] = useState([] as { wager: number; result: 'win' | 'lose'; payout: number }[]);
  const { address, isConnected, chainId } = useAccount();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1, // Only try ENS on Ethereum mainnet
    query: { enabled: false } // Disable ENS lookup for now since we're on Ronin
  });
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { data: ronBalance, refetch: refetchBalance } = useBalance({ address, chainId: 2021 });
  const [settlementError, setSettlementError] = useState(null as string | null);
  const { isWalletModalOpen, setWalletModalOpen, switchError, isAutoSwitching, ensureCorrectNetwork } = useWalletContext();

  const houseAbi = [
    { "inputs": [ { "internalType": "bool", "name": "choice", "type": "bool" } ], "name": "flip", "outputs": [ { "internalType": "bool", "name": "won", "type": "bool" }, { "internalType": "uint256", "name": "payout", "type": "uint256" } ], "stateMutability": "payable", "type": "function" },
    { "inputs": [], "name": "getHouseStats", "outputs": [ { "internalType": "uint256", "name": "balance", "type": "uint256" }, { "internalType": "uint256", "name": "games", "type": "uint256" }, { "internalType": "uint256", "name": "wagered", "type": "uint256" }, { "internalType": "uint256", "name": "paidOut", "type": "uint256" }, { "internalType": "uint256", "name": "houseProfit", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "fund", "outputs": [], "stateMutability": "payable", "type": "function" }
  ]

  function shortenAddress(addr?: string) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // Multiplayer wiring (off-chain commit-reveal over sockets)
  const socketRef = useRef(null as null | Socket)
  const [room, setRoom] = useState(null as null | { id: string, status: string, players: any[] })
  const [phase, setPhase] = useState('idle' as 'idle'|'waiting'|'commit'|'reveal'|'settled')
  const [deadline, setDeadline] = useState(0)
  const [mySeed, setMySeed] = useState('')
  const [myCommit, setMyCommit] = useState('')
  const [roomError, setRoomError] = useState('')
  const [lobby, setLobby] = useState([] as { id: string, wager: number, currency: string }[])

  useEffect(() => {
    const s = io(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/coinflip`, { transports: ['websocket'] })
    socketRef.current = s
    s.on('room_update', (r: any) => { setRoom(r); setPhase(r.status as any); setDeadline((r.revealUntil||r.commitUntil)||0) })
    s.on('commit_phase', () => setPhase('commit'))
    s.on('reveal_phase', () => setPhase('reveal'))
    s.on('result', (payload: any) => {
      setPhase('settled')
      const didWin = payload?.winner && payload.winner === s.id
      setLastResult(didWin ? 'win' : 'lose')
      const payout = didWin ? wager * 2 : 0
      setHistory(h => [{ wager, result: (didWin ? 'win' : 'lose') as 'win' | 'lose', payout }, ...h].slice(0, 10))
    })
    // fetch lobby initially and every 5s
    const load = () => s.emit('list_rooms', (list: any) => setLobby(list || []))
    load()
    const intv = setInterval(load, 5000)
    return () => { s.close(); clearInterval(intv) }
  }, [])

  function sha256Hex(input: string) {
    if (typeof window === 'undefined') return ''
    const enc = new TextEncoder().encode(input)
    // simple browser SHA-256
    return (window.crypto?.subtle?.digest('SHA-256', enc) as Promise<ArrayBuffer>).then(buf =>
      Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    )
  }

  async function createRoom() {
    setRoomError('')
    socketRef.current?.emit('create_room', { wager, currency: 'R' }, (r: any) => {
      if (r?.error) setRoomError(r.error)
      else setRoom(r), setPhase('waiting')
    })
  }
  async function joinRoom(roomId: string) {
    setRoomError('')
    socketRef.current?.emit('join_room', { roomId }, (r: any) => {
      if (r?.error) setRoomError(r.error)
      else setRoom(r)
    })
  }
  async function doCommit() {
    const seed = Math.random().toString(36).slice(2) + Date.now().toString(36)
    setMySeed(seed)
    const commit = await sha256Hex(seed)
    setMyCommit(commit)
    socketRef.current?.emit('commit', { roomId: room?.id, commit })
  }
  function doReveal() {
    if (!mySeed) return
    socketRef.current?.emit('reveal', { roomId: room?.id, seed: mySeed })
  }

  const totalWager = useMemo(() => Math.max(0, Number((wager * bets).toFixed(2))), [wager, bets]);
  const potentialWin = useMemo(() => Number((wager * 1.95).toFixed(2)), [wager]); // ~95% RTP with 2.5% house edge
  const payoutMult = 1.95;
  const walletBalance = useMemo(() => (isConnected && ronBalance ? Number(ronBalance.formatted) : 0), [isConnected, ronBalance]);

  function clamp(val: number, min: number, max: number) {
    return Math.min(max, Math.max(min, val));
  }

  function onQuick(action: 'min' | 'half' | 'x2' | 'max') {
    if (action === 'min') setWager(0.01);
    if (action === 'half') setWager(v => Math.max(0.01, Number((v / 2).toFixed(2))));
    if (action === 'x2') setWager(v => clamp(Number((v * 2).toFixed(2)), 0.01, walletBalance));
    if (action === 'max') setWager(Number(walletBalance.toFixed(2)));
  }

  async function flip() {
    if (flipping) return;
    if (wager <= 0 || wager > walletBalance) return;
    if (!process.env.NEXT_PUBLIC_HOUSE_ADDRESS) {
      setSettlementError('NEXT_PUBLIC_HOUSE_ADDRESS not configured');
      return;
    }

    setFlipping(true);
    setLastResult(null);
    setSettlementError(null);

    try {
      // Ensure the injected provider's selected account matches the connected wallet
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const accs = await (window as any).ethereum.request({ method: 'eth_accounts' });
          const injected = Array.isArray(accs) && accs.length ? accs[0]?.toLowerCase() : null;
          if (injected && address && injected !== address.toLowerCase()) {
            setSettlementError('Connected wallet does not match injected provider. Please reconnect with your wallet and retry.');
            setFlipping(false);
            return;
          }
        } catch (ie) {
          // continue, we will try to use signer anyway
        }
      }

      const abi = houseAbi;
      const choice = selectedSide === 'heads'; // true for heads, false for tails
      let gameResult: { won: boolean; payout: number; actualResult: boolean } | null = null;

      // Submit the flip transaction
      if (walletClient && (walletClient as any).writeContract) {
        try {
          // Skip preflight simulation to avoid ENS issues - submit transaction directly
          console.log('Submitting flip transaction directly...');

          // Submit the transaction
          const txResp = await (walletClient as any).writeContract({
            address: process.env.NEXT_PUBLIC_HOUSE_ADDRESS as `0x${string}`,
            abi: abi as any,
            functionName: 'flip',
            args: [choice],
            value: parseUnits(String(wager), 18)
          });

          const txHash = (typeof txResp === 'string') ? txResp : (txResp?.hash || txResp?.transactionHash || txResp?.request?.hash);
          console.log('Flip tx submitted:', txHash);

          // Start coin animation immediately after transaction is submitted
          // This entertains users during the waiting time for confirmation
          const spinMs = Math.floor(4000 + Math.random() * 2000); // 4-6 seconds
          const fullSpins = 3;
          const normalized = ((coinRotation % 360) + 360) % 360;
          // We don't know the result yet, so just spin continuously
          const continuousSpinTarget = coinRotation + (fullSpins * 360) + 180; // Add extra spins
          
          console.log('Starting coin animation while waiting for confirmation...');
          startSpin();

          // Wait for transaction confirmation and get result
          if (txHash) {
            const provider = new BrowserProvider((window as any).ethereum, {
              name: 'ronin-testnet',
              chainId: 2021,
              ensAddress: null // Explicitly disable ENS
            });
            const receipt = await provider.waitForTransaction(txHash as string);
            
            if (receipt && receipt.status === 1) {
              console.log('Flip tx confirmed successfully');
              
              // Parse the GamePlayed event to get the result
              try {
                const iface = new Interface([
                  "event GamePlayed(address indexed player, uint256 wager, bool playerChoice, bool result, bool won, uint256 payout, uint256 gameId)"
                ]);
                
                const gamePlayedEvent = receipt.logs.find(log => {
                  try {
                    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
                    return parsed?.name === 'GamePlayed';
                  } catch { return false; }
                });

                if (gamePlayedEvent) {
                  const parsed = iface.parseLog({ topics: gamePlayedEvent.topics as string[], data: gamePlayedEvent.data });
                  gameResult = {
                    won: parsed?.args.won || false,
                    payout: Number(parsed?.args.payout || 0) / 1e18, // Convert from wei to ether
                    actualResult: parsed?.args.result || false // true = heads, false = tails
                  };
                  console.log('Game result from event:', gameResult);

                  // Now that we have the actual result, adjust the coin to land on the correct side
                  const landingSide = gameResult.actualResult ? 'heads' : 'tails';
                  const currentRotation = coinRotation;
                  const currentNormalized = ((currentRotation % 360) + 360) % 360;
                  const desired = landingSide === 'heads' ? 0 : 180;
                  
                  // Calculate the shortest path to the desired result
                  let adjustment = desired - currentNormalized;
                  if (Math.abs(adjustment) > 180) {
                    adjustment = adjustment > 0 ? adjustment - 360 : adjustment + 360;
                  }
                  
                  const finalTarget = currentRotation + adjustment;
                  console.log('Adjusting coin to land on', landingSide, 'final rotation:', finalTarget);
                  
                  // Stop continuous spin and smoothly settle to final rotation
                  stopSpin();
                  setIsFinalizing(true);
                  // small delay to ensure style updates apply
                  setTimeout(() => { setCoinRotation(finalTarget); }, 16);
                }
              } catch (eventErr) {
                console.warn('Could not parse GamePlayed event:', eventErr);
              }

              // Update balance
              try { 
                refetchBalance && await refetchBalance(); 
              } catch (e) {}
            } else {
              console.warn('Flip tx failed on-chain');
              setSettlementError('Transaction failed on-chain');
              setFlipping(false);
              return;
            }
          }
        } catch (e) {
          console.error('Flip tx failed (walletClient):', e);
          setSettlementError(String((e as any)?.message || e));
          setFlipping(false);
          return;
        }
      } else {
        // Fallback to direct signer
        try {
          const provider = new BrowserProvider((window as any).ethereum, {
            name: 'ronin-testnet',
            chainId: 2021,
            ensAddress: null // Explicitly disable ENS
          });
          const signer = await provider.getSigner();
          const house = new Contract(process.env.NEXT_PUBLIC_HOUSE_ADDRESS as string, abi, signer);

          const tx = await house.flip(choice, { value: parseUnits(String(wager), 18) });
          console.log('Flip tx submitted:', tx.hash);

          // Start coin animation immediately after transaction is submitted (fallback path)
          const spinMs = Math.floor(4000 + Math.random() * 2000); // 4-6 seconds
          const fullSpins = 3;
          const normalized = ((coinRotation % 360) + 360) % 360;
          const continuousSpinTarget = coinRotation + (fullSpins * 360) + 180;
          
          console.log('Starting coin animation while waiting for confirmation (fallback)...');
          startSpin();
          
          const receipt = await tx.wait();
          if (receipt && receipt.status === 1) {
            console.log('Flip tx confirmed successfully');
            
            // Parse the GamePlayed event
            try {
              const gamePlayedEvent = receipt.logs.find((log: any) => {
                try {
                  return house.interface.parseLog(log)?.name === 'GamePlayed';
                } catch { return false; }
              });

              if (gamePlayedEvent) {
                const parsed = house.interface.parseLog(gamePlayedEvent);
                gameResult = {
                  won: parsed?.args.won || false,
                  payout: Number(parsed?.args.payout || 0) / 1e18,
                  actualResult: parsed?.args.result || false
                };
                console.log('Game result from event:', gameResult);

                // Adjust coin to land on correct result (fallback path)
                const landingSide = gameResult.actualResult ? 'heads' : 'tails';
                const currentRotation = coinRotation;
                const currentNormalized = ((currentRotation % 360) + 360) % 360;
                const desired = landingSide === 'heads' ? 0 : 180;
                
                let adjustment = desired - currentNormalized;
                if (Math.abs(adjustment) > 180) {
                  adjustment = adjustment > 0 ? adjustment - 360 : adjustment + 360;
                }
                
                const finalTarget = currentRotation + adjustment;
                console.log('Adjusting coin to land on', landingSide, 'final rotation (fallback):', finalTarget);
                
                // Stop continuous spin and smoothly settle to final rotation (fallback path)
                stopSpin();
                setIsFinalizing(true);
                setTimeout(() => { setCoinRotation(finalTarget); }, 16);
              }
            } catch (eventErr) {
              console.warn('Could not parse GamePlayed event:', eventErr);
            }

            // Update balance
            try { 
              refetchBalance && await refetchBalance(); 
            } catch (e) {}
          } else {
            console.warn('Flip tx failed on-chain');
            setSettlementError('Transaction failed on-chain');
            setFlipping(false);
            return;
          }
        } catch (e) {
          console.error('Flip tx failed (signer):', e);
          setSettlementError(String((e as any)?.message || e));
          setFlipping(false);
          return;
        }
      }

      // Final UI updates after transaction confirmation
      const didWin = gameResult?.won || false;
      const payout = gameResult?.payout || 0;
      const landingSide = gameResult?.actualResult ? 'heads' : 'tails';

      console.log('Final result - Landing:', landingSide, 'Won:', didWin, 'Payout:', payout);

      // Wait for the coin animation to finish settling before updating UI
      await waitForCoinSettle(1000);
      setIsFinalizing(false);
      // tiny extra delay to ensure final pose renders
      await new Promise(r => setTimeout(r, 120));

      // Update UI with results
      setFlipping(false);
      setLastResult(didWin ? 'win' : 'lose');
      setHistory(h => [{ wager, result: (didWin ? 'win' : 'lose') as 'win' | 'lose', payout }, ...h].slice(0, 10));

    } catch (e) {
      console.error('Flip failed:', e);
      setSettlementError(String((e as any)?.message || e));
      setFlipping(false);
    }
  }

  return (
    <>
      <WalletHeader />

      <div className="game-wrap">
      <div className="panel">
        <div className="tabs">
          <button className={`tabBtn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single Player</button>
          <button className={`tabBtn ${mode === 'multi' ? 'active' : ''}`} onClick={() => setMode('multi')}>Multiplayer</button>
        </div>
        <div className="panel-row head">
          <div className="label">Wager</div>
          <div className="balance">Ronin Balance : R {ronBalance ? Number(ronBalance.formatted).toFixed(2) : (isConnected ? '...' : 'Connect wallet')}</div>
        </div>

        <div className="input-row">
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={wager}
            onChange={e => setWager(clamp(parseFloat(e.target.value || '0') || 0, 0.01, walletBalance))}
          />
        </div>

        <div className="quick-row">
          <button onClick={() => onQuick('min')}>MIN</button>
          <button onClick={() => onQuick('half')}>1/2</button>
          <button onClick={() => onQuick('x2')}>x2</button>
          <button onClick={() => onQuick('max')}>MAX</button>
        </div>

        <div className="panel-row" style={{ marginTop: 22 }}>
          <div className="label">Multiple Bets (0-100)</div>
          <div className="bets-value">{bets}</div>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          value={bets}
          onChange={e => setBets(parseInt(e.target.value))}
        />

        <div className="max-payout-box">
          <div className="mp-label">MAX PAYOUT (Single Bet)</div>
          <div className="mp-value">R {potentialWin.toFixed(2)}</div>
        </div>

        <div className="stats two">
          <div className="stat">
            <div className="stat-label">Max Wager</div>
            <div className="stat-val">R {(wager * bets).toFixed(2)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Max Payout</div>
            <div className="stat-val">R {(wager * bets * payoutMult).toFixed(2)}</div>
          </div>
        </div>

        {mode === 'single' ? (
          <button
            className="flip-btn"
            onClick={async () => {
              if (!isConnected) {
                setWalletModalOpen(true);
                return;
              }
              if (chainId !== roninSaigon.id) {
                const switched = await ensureCorrectNetwork();
                if (!switched) return;
              }
              flip();
            }}
            disabled={flipping || !isConnected || isAutoSwitching}
          >
            {isAutoSwitching ? 'Switching Network...' : 'FLIP'}
          </button>
        ) : (
          <div className="mp-controls">
            {!room && <button className="flip-btn" onClick={createRoom}>Create Room</button>}
            {room && phase === 'waiting' && (
              <div className="mp-row">Waiting for opponent… Share Room ID: <code>{room.id}</code></div>
            )}
            {room && phase === 'commit' && (
              <>
                <div className="mp-row">Commit phase {deadline ? `(~${Math.max(0, Math.ceil((deadline - Date.now())/1000))}s)` : ''}</div>
                <button className="flip-btn" onClick={doCommit} disabled={!!myCommit}>Commit</button>
              </>
            )}
            {room && phase === 'reveal' && (
              <>
                <div className="mp-row">Reveal phase {deadline ? `(~${Math.max(0, Math.ceil((deadline - Date.now())/1000))}s)` : ''}</div>
                <button className="flip-btn" onClick={doReveal}>Reveal</button>
              </>
            )}
            {!room && (
              <div className="lobby">
                <div className="mp-row" style={{ marginTop: 6, marginBottom: 6 }}>Open Rooms</div>
                {lobby.length === 0 && <div className="mp-row">No rooms yet.</div>}
                {lobby.map((r) => (
                  <div key={r.id} className="lobby-row">
                    <div>R {typeof r.wager === 'number' ? r.wager.toFixed(2) : r.wager} • {r.currency}</div>
                    <button className="join-btn" onClick={() => joinRoom(r.id)}>Join</button>
                  </div>
                ))}
              </div>
            )}
            {roomError && <div className="mp-error">{roomError}</div>}
            {!room && (
              <div className="join-row">
                <input className="join-input" placeholder="Enter Room ID" onKeyDown={(e) => {
                  if (e.key === 'Enter') joinRoom((e.target as HTMLInputElement).value)
                }} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="stage">
        <div className={`platform ${lastResult ? lastResult : ''}`}>
          <div
            className="coin"
            ref={coinRef}
            style={{
              transform: `rotateX(10deg) rotateY(${coinRotation}deg)`,
              transition: isFinalizing ? `transform 1000ms cubic-bezier(.2,1,.2,1)` : (flipping ? 'none' : 'transform 300ms ease')
            }}
          >
            <div className="coin-face front"><div className="face-letter">H</div></div>
            <div className="coin-face back"><div className="face-letter">T</div></div>
          </div>
          <div className="glow" />
        </div>
        <div className="choice">
          <button className={`sideTab ${selectedSide === 'heads' ? 'active' : ''}`} onClick={() => !flipping && setSelectedSide('heads')}>HEADS</button>
          <button className={`sideTab ${selectedSide === 'tails' ? 'active' : ''}`} onClick={() => !flipping && setSelectedSide('tails')}>TAILS</button>
        </div>
        {chainId && chainId !== roninSaigon.id && isConnected && (
          <div style={{ marginTop: 12, color: '#ffcc66', fontWeight: 700, textAlign: 'center' }}>
            Please switch your wallet network to <strong>Ronin Saigon (chainId 2021)</strong> — currently on {String(chainId)}
          </div>
        )}
        <button
          className="stageFlip"
          onClick={async () => {
            if (!isConnected) {
              setWalletModalOpen(true);
              return;
            }
            if (chainId !== roninSaigon.id) {
              const switched = await ensureCorrectNetwork();
              if (!switched) return;
            }
            flip();
          }}
          disabled={flipping || !isConnected || wager <= 0 || wager > walletBalance || isAutoSwitching}
        >
          {isAutoSwitching ? 'Switching Network...' : flipping ? 'Flipping...' : 'Flip'}
        </button>
        {(settlementError || switchError) && (
          <div style={{ marginTop: 12, color: '#ffb4b4', fontWeight: 700, textAlign: 'center' }}>
            Error: {switchError || settlementError}
          </div>
        )}
      </div>

      <div className="history">
        <div className="history-head">
          <div className="h-title">History</div>
          <div className="h-balance">Ronin Balance : {ronBalance ? `${Number(ronBalance.formatted).toFixed(4)} RON` : (isConnected ? '...' : 'Connect wallet')}</div>
        </div>
        <div className="history-grid">
          <div className="col head">Wager</div>
          <div className="col head">Payout</div>
          {history.map((row, idx) => (
            <>
              <div key={`w-${idx}`} className="col">R {row.wager.toFixed(2)}</div>
              <div key={`p-${idx}`} className="col">{row.result === 'win' ? `R ${row.payout.toFixed(2)}` : 'Unlucky!'}</div>
            </>
          ))}
        </div>
      </div>

      <style>{`
        .connect-btn { padding: 10px 14px; border-radius: 10px; font-weight: 800; color: #fff; background: #7e50ff; border: 0; box-shadow: 0 10px 24px rgba(126,80,255,0.35); }
        .nav-link { text-decoration: none; color: #ffffff; padding: 6px 10px; border-radius: 6px; font-weight: 700 }
        .nav-link:hover { background: rgba(255,255,255,0.16); color: #ffffff }
        .game-wrap {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 32px;
          padding: 48px;
          padding-top: 120px;
          min-height: calc(100vh - 120px);
        }
        @media (max-width: 980px) {
          .game-wrap { grid-template-columns: 1fr; padding: 32px 20px; }
        }

        .panel {
          background: linear-gradient(180deg, rgba(30,30,30,0.8), rgba(22,22,22,0.9));
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 18px 16px 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(6px);
        }
        .tabs { display: flex; gap: 0; margin-bottom: 12px; }
        .tabBtn { flex: 1; padding: 10px 12px; font-weight: 800; color: #ddd; background: #2d2d2d; border: 1px solid rgba(255,255,255,0.06); }
        .tabBtn:first-child { border-radius: 10px 0 0 10px; }
        .tabBtn:last-child { border-radius: 0 10px 10px 0; }
        .tabBtn.active { background: #7e50ff; color: #fff; border-color: transparent; }
        .panel-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .panel-row.head .label { font-weight: 700; letter-spacing: .3px; }
        .label { color: #f3f3f3; font-size: 14px; }
        .balance { color: #90CAF9; font-weight: 700; }

        .input-row { margin-top: 10px; }
        .input-row input {
          width: 100%;
          background: #2c2c2c;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 12px 14px;
          font-weight: 700;
          box-sizing: border-box;
        }

        .quick-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
        .quick-row button {
          background: #3a3a3a;
          color: #ddd;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 0;
          font-weight: 700;
        }
        .quick-row button:hover { background: #474747; }

        .slider { width: 100%; margin-top: 8px; }
        .slider { accent-color: #9575CD; }

        .max-payout-box { margin: 14px 0; background: #2c2c2c; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px; }
        .mp-label { color: #bdbdbd; font-size: 12px; margin-bottom: 6px; }
        .mp-value { color: #fff; font-weight: 800; }

        .stats.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
        .stat {
          background: #2c2c2c;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 12px;
        }
        .stat-label { color: #bdbdbd; font-size: 12px; margin-bottom: 6px; }
        .stat-val { color: #fff; font-weight: 800; }

        .flip-btn {
          width: 100%;
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 0;
          font-weight: 900;
          letter-spacing: 1px;
          color: #fff;
          background: linear-gradient(180deg,#a46eff,#7e50ff 60%,#6e49ff);
          box-shadow: 0 16px 36px rgba(110,73,255,0.45);
        }
        .flip-btn:disabled { opacity: .75; cursor: not-allowed; }

        .mp-controls { display: grid; gap: 10px; }
        .mp-row { color: #e0e0e0; font-size: 0.95rem; }
        .mp-error { color: #ef9a9a; font-weight: 700; }
        .join-row { display: flex; gap: 8px; }
        .join-input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: #2c2c2c; color: #fff; }
        .lobby { display: grid; gap: 8px; }
        .lobby-row { display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.04); padding: 10px 12px; border-radius: 10px; }
        .join-btn { padding: 8px 12px; border-radius: 8px; background: #7e50ff; color: #fff; border: 0; font-weight: 800; }

        .stage {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          min-height: 600px;
          background: #3a3a3a;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 0 80px rgba(0,0,0,0.35), 0 30px 60px rgba(0,0,0,0.35);
          overflow: hidden;
        }

        .platform {
          position: relative;
          width: 420px;
          height: 320px;
          display: grid;
          place-items: center;
          transform-style: preserve-3d;
          perspective: 900px;
        }
        .glow {
          position: absolute;
          inset: auto 0 10px 0;
          margin: auto;
          width: 62%;
          height: 28px;
          background: radial-gradient(closest-side, rgba(126,77,255,0.45), rgba(0,0,0,0));
          filter: blur(10px);
          transform: translateZ(-50px);
        }

        .coin {
          width: 220px;
          height: 220px;
          position: relative;
          transform-style: preserve-3d;
        }

        .coin-face {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #e2c162, #b48a2f 60%, #8f6a1f);
          box-shadow: inset 0 8px 18px rgba(255,255,255,0.25), inset 0 -10px 20px rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.45);
          backface-visibility: hidden;
          border: 4px solid rgba(34,24,4,0.35);
        }
        .coin-face.back { transform: rotateY(180deg); }

        .face-letter { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 900; font-size: 110px; color: rgba(0,0,0,0.6); text-shadow: 0 2px 0 rgba(255,255,255,0.45); transform: translateZ(1px); }

        .stageFlip { position: absolute; bottom: 28px; padding: 12px 26px; border-radius: 24px; font-weight: 800; color: #fff; background: #7e50ff; border: 0; box-shadow: 0 10px 30px rgba(126,80,255,0.45); }
        .choice { position: absolute; bottom: 84px; display: flex; gap: 10px; }
        .sideTab { min-width: 140px; padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); color: #e8e8e8; background: rgba(22,22,22,0.6); font-weight: 800; }
        .sideTab.active { background: linear-gradient(180deg,#a46eff,#7e50ff 60%,#6e49ff); box-shadow: 0 12px 30px rgba(110,73,255,0.35); border-color: transparent; }

        .history { grid-column: 1 / -1; margin-top: 10px; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; background: rgba(180,200,190,0.18); }
        .history-head { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 700; }
        .history-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; align-items: center; }
        .history-grid .head { color: #333; opacity: .8; }
        .col { background: rgba(255,255,255,0.04); padding: 8px 10px; border-radius: 8px; }
      `}</style>
      </div>
      <footer style={{ width: '100vw', background: '#232323', color: '#aaa', textAlign: 'center', padding: '32px 0 24px 0', fontSize: '1rem', marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
          <span>© {new Date().getFullYear()} Ronin Royale</span>
          <span>|</span>
          <span>Privacy Policy</span>
          <span>|</span>
          <span>Terms of Service</span>
          <span>|</span>
          <span>Contact: info@roninroyale.com</span>
        </div>
      </footer>
    </>
  );
}
