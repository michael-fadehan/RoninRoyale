import { Router } from 'express'
import { JsonRpcProvider, Contract } from 'ethers'
import crypto from 'crypto'

const router = Router()

// House contract ABI for reading stats (same as coinflip since they use the same contract)
const houseAbi = [
  { "inputs": [], "name": "getHouseStats", "outputs": [ { "internalType": "uint256", "name": "balance", "type": "uint256" }, { "internalType": "uint256", "name": "games", "type": "uint256" }, { "internalType": "uint256", "name": "wagered", "type": "uint256" }, { "internalType": "uint256", "name": "paidOut", "type": "uint256" }, { "internalType": "uint256", "name": "houseProfit", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "houseEdge", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "maxWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "minWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }
]

// Simple provably-fair RNG (pre-contract phase)
// A secret server seed is committed via its hash; each spin exposes a unique nonce.
// Clients can verify outcome = sha256(serverSeed:nonce) -> first 32 bits -> parity.
const SERVER_SEED = process.env.BOTTLEFLIP_SERVER_SEED || crypto.randomBytes(32).toString('hex')
const SERVER_SEED_HASH = crypto.createHash('sha256').update(SERVER_SEED).digest('hex')

function computeOutcome(nonce: string) {
  const hash = crypto.createHash('sha256').update(`${SERVER_SEED}:${nonce}`).digest('hex')
  const bit = parseInt(hash.slice(0, 8), 16) & 1
  return { outcome: (bit === 0 ? 'up' as const : 'down' as const), hash }
}

// Get house statistics from the smart contract
router.get('/stats', async (_req, res) => {
  try {
    const houseAddress = process.env.NEXT_PUBLIC_HOUSE_ADDRESS || process.env.HOUSE_ADDRESS
    if (!houseAddress) {
      return res.status(500).json({ error: 'House contract address not configured' })
    }

    const provider = new JsonRpcProvider('https://saigon-testnet.roninchain.com/rpc')
    const house = new Contract(houseAddress, houseAbi, provider)

    const [stats, houseEdge, maxWager, minWager] = await Promise.all([
      house.getHouseStats(),
      house.houseEdge(),
      house.maxWager(),
      house.minWager()
    ])

    res.json({
      balance: Number(stats[0]) / 1e18, // Convert from wei to RON
      totalGames: Number(stats[1]),
      totalWagered: Number(stats[2]) / 1e18,
      totalPaidOut: Number(stats[3]) / 1e18,
      houseProfit: Number(stats[4]) / 1e18,
      houseEdge: Number(houseEdge) / 100, // Convert from basis points to percentage
      maxWager: Number(maxWager) / 1e18,
      minWager: Number(minWager) / 1e18,
      rtp: (10000 - Number(houseEdge)) / 100 // Calculate RTP from house edge
    })
  } catch (e: any) {
    console.error('Failed to fetch house stats:', e)
    res.status(500).json({ error: 'Failed to fetch house statistics', details: e.message })
  }
})

// Spin endpoint (temporary backend RNG until on-chain contract is integrated)
router.post('/spin', (req, res) => {
 try {
   const body = (req as any).body || {}
   const wager = Number(body.wager)
   const rawChoice = body.choice
   const choice = (typeof rawChoice === 'string'
     ? rawChoice.toLowerCase()
     : (rawChoice === true ? 'up' : 'down')) as 'up'|'down'

   if (!Number.isFinite(wager) || wager <= 0) {
     return res.status(400).json({ error: 'invalid_wager' })
   }
   if (choice !== 'up' && choice !== 'down') {
     return res.status(400).json({ error: 'invalid_choice' })
   }

   const nonce = crypto.randomBytes(8).toString('hex')
   const { outcome, hash } = computeOutcome(nonce)
   const won = outcome === choice
   const houseEdgePct = 5.0
   const payout = won ? Number((wager * (2 - houseEdgePct / 100)).toFixed(4)) : 0

   res.json({
     roundId: nonce,
     outcome,
     won,
     payout,
     serverSeedHash: SERVER_SEED_HASH,
     nonce,
     houseEdge: houseEdgePct,
     rtp: 100 - houseEdgePct,
     prfHash: hash,
     timestamp: new Date().toISOString(),
   })
 } catch (e: any) {
   res.status(500).json({ error: 'spin_failed', details: e?.message || String(e) })
 }
})

// Health check endpoint
router.get('/health', (_req, res) => {
 res.json({
   status: 'ok',
   message: 'Bottle Flip API is running - Backend RNG mode (pre-contract)',
   timestamp: new Date().toISOString(),
   game: 'bottle-flip'
 })
})

// Temporary play endpoint aliasing /spin for current phase
router.post('/play', (req, res) => {
 // Delegate to /spin logic for now
 try {
   const body = (req as any).body || {}
   const wager = Number(body.wager)
   const rawChoice = body.choice
   const choice = (typeof rawChoice === 'string'
     ? rawChoice.toLowerCase()
     : (rawChoice === true ? 'up' : 'down')) as 'up'|'down'

   if (!Number.isFinite(wager) || wager <= 0) {
     return res.status(400).json({ error: 'invalid_wager' })
   }
   if (choice !== 'up' && choice !== 'down') {
     return res.status(400).json({ error: 'invalid_choice' })
   }

   const nonce = crypto.randomBytes(8).toString('hex')
   const { outcome, hash } = computeOutcome(nonce)
   const won = outcome === choice
   const houseEdgePct = 5.0
   const payout = won ? Number((wager * (2 - houseEdgePct / 100)).toFixed(4)) : 0

   res.json({
     roundId: nonce,
     outcome,
     won,
     payout,
     serverSeedHash: SERVER_SEED_HASH,
     nonce,
     houseEdge: houseEdgePct,
     rtp: 100 - houseEdgePct,
     prfHash: hash,
     timestamp: new Date().toISOString(),
   })
 } catch (e: any) {
   res.status(500).json({ error: 'play_failed', details: e?.message || String(e) })
 }
})

// Legacy signing endpoint - no longer needed
router.post('/sign', (_req, res) => {
  res.status(410).json({
    error: 'deprecated_endpoint',
    message: 'Settlement signatures are no longer needed. The new contract handles everything in one transaction.',
    migration: 'Use the smart contract flip() function which handles betting, randomness, and payout in a single transaction.',
    game: 'bottle-flip'
  })
})

export default router