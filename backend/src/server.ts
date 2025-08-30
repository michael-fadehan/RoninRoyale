import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import { createServer } from 'http'
// Use require to avoid type resolution issues in some TS setups
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Server } = require('socket.io') as { Server: any }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Redis = require('ioredis') as any
import crypto from 'crypto'
import coinflipRouter from './routes/coinflip'

dotenv.config()

const app = express()
app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/', (_req, res) => {
  res.json({ message: 'Ronin Royale Backend' })
})

app.use('/api/games/coinflip', coinflipRouter)

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*'} })

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
let redisEnabled = true
let redisWarned = false
const redis = new Redis(redisUrl, {
  lazyConnect: true,
  enableReadyCheck: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
})
redis.on('error', () => {
  if (!redisWarned) {
    // eslint-disable-next-line no-console
    console.warn('[redis] disabled - connection failed; using in-memory rooms')
    redisWarned = true
  }
  redisEnabled = false
})
redis.connect().catch(() => { redisEnabled = false })
const ROOM_PREFIX = 'coinflip:room:'

type Player = { id: string, address?: string, commit?: string, seed?: string }
type Room = {
  id: string
  wager: number
  currency: string
  status: 'waiting'|'commit'|'reveal'|'settled'
  players: Player[]
  result?: { winner: string|null, hash: string }
  commitUntil?: number
  revealUntil?: number
}

const rooms = new Map<string, Room>()
const commitTimers = new Map<string, NodeJS.Timeout>()
const revealTimers = new Map<string, NodeJS.Timeout>()

const COMMIT_WINDOW_MS = 15000
const REVEAL_WINDOW_MS = 15000

function saveRoom(room: Room) {
  rooms.set(room.id, room)
  if (!redisEnabled) return
  redis.set(ROOM_PREFIX + room.id, JSON.stringify(room), 'EX', Math.ceil((COMMIT_WINDOW_MS + REVEAL_WINDOW_MS) / 1000) * 6).catch(() => {})
}

async function listWaitingRooms(): Promise<{ id: string, wager: number, currency: string }[]> {
  if (redisEnabled) {
    try {
      const keys: string[] = await redis.keys(ROOM_PREFIX + '*')
      if (keys.length) {
        const vals = await redis.mget(keys)
        const parsed = vals
          .map((v: string|null) => { try { return v ? JSON.parse(v) as Room : null } catch { return null } })
          .filter((r: Room|null) => r && r.status === 'waiting') as Room[]
        return parsed.map(r => ({ id: r.id, wager: r.wager, currency: r.currency }))
      }
    } catch {
      // fall through to memory
    }
  }
  const mem = Array.from(rooms.values()).filter(r => r.status === 'waiting')
  return mem.map(r => ({ id: r.id, wager: r.wager, currency: r.currency }))
}

io.of('/coinflip').on('connection', (socket) => {
  socket.on('create_room', (payload: { wager: number, currency: string }, cb?: (r: Room)=>void) => {
    const id = crypto.randomBytes(8).toString('hex')
    const room: Room = { id, wager: payload.wager, currency: payload.currency, status: 'waiting', players: [{ id: socket.id }] }
    saveRoom(room)
    socket.join(id)
    cb && cb(room)
    io.of('/coinflip').to(id).emit('room_update', room)
  })

  socket.on('join_room', (payload: { roomId: string }, cb?: (r: Room|{error:string})=>void) => {
    const room = rooms.get(payload.roomId)
    if (!room) return cb && cb({ error: 'Room not found' })
    if (room.players.length >= 2) return cb && cb({ error: 'Room full' })
    room.players.push({ id: socket.id })
    room.status = 'commit'
    room.commitUntil = Date.now() + COMMIT_WINDOW_MS
    saveRoom(room)
    socket.join(room.id)
    cb && cb(room)
    io.of('/coinflip').to(room.id).emit('room_update', room)
    io.of('/coinflip').to(room.id).emit('commit_phase')

    // start commit timer
    const t = setTimeout(() => {
      const current = rooms.get(room.id)
      if (!current || current.status !== 'commit') return
      const committed = current.players.filter(p => !!p.commit)
      if (committed.length === 1) {
        current.status = 'settled'
        current.result = { winner: committed[0].id, hash: 'timeout-commit' }
        saveRoom(current)
        io.of('/coinflip').to(current.id).emit('room_update', current)
        io.of('/coinflip').to(current.id).emit('result', { winner: committed[0].id, timeout: 'commit' })
      } else {
        io.of('/coinflip').to(current.id).emit('result', { error: 'Commit timeout' })
      }
      commitTimers.delete(room.id)
    }, COMMIT_WINDOW_MS + 200)
    commitTimers.set(room.id, t)
  })

  socket.on('commit', (payload: { roomId: string, commit: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) return
    const p = room.players.find(p => p.id === socket.id)
    if (p) p.commit = payload.commit
    if (room.players.length === 2 && room.players.every(p => !!p.commit)) {
      room.status = 'reveal'
      room.revealUntil = Date.now() + REVEAL_WINDOW_MS
      const ct = commitTimers.get(room.id)
      if (ct) { clearTimeout(ct); commitTimers.delete(room.id) }
      // start reveal timer
      const rt = setTimeout(() => {
        const current = rooms.get(room.id)
        if (!current || current.status !== 'reveal') return
        const revealed = current.players.filter(p => !!p.seed)
        if (revealed.length === 1) {
          current.status = 'settled'
          current.result = { winner: revealed[0].id, hash: 'timeout-reveal' }
          saveRoom(current)
          io.of('/coinflip').to(current.id).emit('room_update', current)
          io.of('/coinflip').to(current.id).emit('result', { winner: revealed[0].id, timeout: 'reveal' })
        } else {
          io.of('/coinflip').to(current.id).emit('result', { error: 'Reveal timeout' })
        }
        revealTimers.delete(room.id)
      }, REVEAL_WINDOW_MS + 200)
      revealTimers.set(room.id, rt)
      io.of('/coinflip').to(room.id).emit('reveal_phase')
    }
    saveRoom(room)
    io.of('/coinflip').to(room.id).emit('room_update', room)
  })

  socket.on('reveal', (payload: { roomId: string, seed: string }) => {
    const room = rooms.get(payload.roomId)
    if (!room) return
    const p = room.players.find(p => p.id === socket.id)
    if (p) p.seed = payload.seed
    if (room.players.length === 2 && room.players.every(p => !!p.seed && !!p.commit)) {
      // verify commits
      const valid = room.players.every(pl => crypto.createHash('sha256').update(pl.seed || '').digest('hex') === pl.commit)
      if (!valid) {
        io.of('/coinflip').to(room.id).emit('result', { error: 'Commit mismatch' })
        return
      }
      const matchId = room.id
      const hash = crypto.createHash('sha256').update(matchId + (room.players[0].seed||'') + (room.players[1].seed||'')).digest('hex')
      const bit = parseInt(hash.slice(-2), 16) & 1
      const winner = room.players[bit]?.id || null
      room.status = 'settled'
      room.result = { winner, hash }
      const rt = revealTimers.get(room.id)
      if (rt) { clearTimeout(rt); revealTimers.delete(room.id) }
      io.of('/coinflip').to(room.id).emit('result', { winner, hash, players: room.players })
    }
    saveRoom(room)
    io.of('/coinflip').to(room.id).emit('room_update', room)
  })

  socket.on('list_rooms', async (cb?: (rooms: Pick<Room,'id'|'wager'|'currency'>[])=>void) => {
    const list = await listWaitingRooms()
    cb && cb(list)
  })

  socket.on('disconnect', () => {
    // Best-effort cleanup: if a player leaves, keep room for rejoin; could add TTL.
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`)
})

export default app


