import { Router } from 'express'
import { JsonRpcProvider, Contract } from 'ethers'

const router = Router()

// House contract ABI for reading stats
const houseAbi = [
  { "inputs": [], "name": "getHouseStats", "outputs": [ { "internalType": "uint256", "name": "balance", "type": "uint256" }, { "internalType": "uint256", "name": "games", "type": "uint256" }, { "internalType": "uint256", "name": "wagered", "type": "uint256" }, { "internalType": "uint256", "name": "paidOut", "type": "uint256" }, { "internalType": "uint256", "name": "houseProfit", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "houseEdge", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "maxWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "minWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }
]

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

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Coinflip API is running - Single player games now handled entirely on-chain!',
    timestamp: new Date().toISOString()
  })
})

// Legacy endpoint for backwards compatibility - now returns info about on-chain gaming
router.post('/play', (_req, res) => {
  res.status(410).json({
    error: 'deprecated_endpoint',
    message: 'Single player coinflip is now handled entirely on-chain. Use the smart contract flip() function directly.',
    migration: {
      old_flow: 'Frontend -> Backend API -> Settlement',
      new_flow: 'Frontend -> Smart Contract (single transaction)',
      benefits: ['Faster gameplay', 'True decentralization', 'No backend dependency', 'Immediate settlement']
    }
  })
})

// Legacy signing endpoint - no longer needed
router.post('/sign', (_req, res) => {
  res.status(410).json({
    error: 'deprecated_endpoint',
    message: 'Settlement signatures are no longer needed. The new contract handles everything in one transaction.',
    migration: 'Use the smart contract flip() function which handles betting, randomness, and payout in a single transaction.'
  })
})

export default router


