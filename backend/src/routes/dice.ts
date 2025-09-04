import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

// Provably-fair server seed (off-chain MVP)
const SERVER_SEED = process.env.DICE_SERVER_SEED || crypto.randomBytes(32).toString('hex');
const SERVER_SEED_HASH = crypto.createHash('sha256').update(SERVER_SEED).digest('hex');

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function dieFromHexPair(hex: string) {
  const v = parseInt(hex, 16);
  return (v % 6) + 1; // map 0..255 -> 1..6
}

function rollThreeDice(seed: string, tag: string) {
  // Use domain separation via tag to derive different values for player/cpu
  const h1 = sha256Hex(`${seed}:${tag}:1`);
  const h2 = sha256Hex(`${seed}:${tag}:2`);
  const h3 = sha256Hex(`${seed}:${tag}:3`);
  const d1 = dieFromHexPair(h1.slice(0, 2));
  const d2 = dieFromHexPair(h2.slice(2, 4));
  const d3 = dieFromHexPair(h3.slice(4, 6));
  return [d1, d2, d3] as [number, number, number];
}

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Dice Roll API is running (off-chain RNG MVP)',
    serverSeedHash: SERVER_SEED_HASH,
    timestamp: new Date().toISOString(),
  });
});

router.post('/roll', (req, res) => {
  try {
    const body = (req as any).body || {};
    const wager = Number(body.wager);

    if (!Number.isFinite(wager) || wager < 0.01) {
      return res.status(400).json({ error: 'invalid_wager', min: 0.01 });
    }

    // Unique round nonce; client can store this for verification
    const nonce = crypto.randomBytes(8).toString('hex');

    // Round seed derives from server seed + nonce (commit/nonce scheme)
    const roundSeed = `${SERVER_SEED}:${nonce}`;

    // Player vs CPU: each rolls 3 dice
    const playerDice = rollThreeDice(roundSeed, 'player');
    const cpuDice = rollThreeDice(roundSeed, 'cpu');
    const playerTotal = playerDice.reduce((a, b) => a + b, 0);
    const cpuTotal = cpuDice.reduce((a, b) => a + b, 0);

    let result: 'win' | 'lose' | 'tie' = 'tie';
    if (playerTotal > cpuTotal) result = 'win';
    else if (playerTotal < cpuTotal) result = 'lose';

    // Payout policy (as requested):
    // - Win: 2.0x (returns wager*2)
    // - Tie: refund (wager)
    // - Lose: 0
    const payout = result === 'win' ? Number((wager * 2).toFixed(4)) : result === 'tie' ? Number(wager.toFixed(4)) : 0;

    // PRF hash to verify round (optional): hash of concatenated values
    const prfHash = sha256Hex(`${roundSeed}:${playerDice.join(',')}:${cpuDice.join(',')}`);

    res.json({
      roundId: nonce,
      serverSeedHash: SERVER_SEED_HASH,
      prfHash,
      player: { dice: playerDice, total: playerTotal },
      cpu: { dice: cpuDice, total: cpuTotal },
      result,
      wager,
      payout,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'roll_failed', details: e?.message || String(e) });
  }
});

export default router;