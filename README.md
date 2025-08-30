# Ronin Royale

Monorepo for Ronin Royale dApp: NFT Farming, Staking, and Games.

Workspaces:
- frontend — Next.js + Tailwind
- backend — Express + TypeScript
- contracts — Hardhat + Solidity

Run locally:

1. Install dependencies
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill values

3. Start dev servers
   ```bash
   npm run dev
   ```


### Contracts - Deploying CoinflipHouse to Ronin Saigon (testnet)

1. Create `contracts/.env` with:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
HOUSE_SIGNER=0xBACKEND_SIGNER_ADDRESS
```

2. From `contracts/`:

```
npm i
npm run deploy:house:ronin-testnet
```

After deployment, note the address and add to frontend `.env.local` as `NEXT_PUBLIC_HOUSE_ADDRESS`, and backend `.env` as `HOUSE_ADDRESS`.


