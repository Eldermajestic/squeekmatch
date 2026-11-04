# SqueekMatch

Find the missing match for your next Squeek merge. A non-custodial, fee-free merge-partner finder and peer-to-peer Squeek market for [Squeekchain](https://squeekchain.com) on Sepolia.

Live: https://squeekmatch.xyz

## What it does

- **My singles**: any address's Squeeks by level, in the wallet and in Staking, with the lone Squeeks and the power they're missing.
- **Chain planner**: the fewest purchases that unlock the most merges, bought in one transaction (`fillAsks`).
- **Match board**: every holder's lone Squeek by level, from a full on-chain snapshot.
- **Trade**: asks, SQK bids for any (merge-ready) Squeek of a level, and Squeek-for-Squeek swaps with an SQK difference.
- **Merge**: pick a pair, choose the survivor, sign the official `merge` (wallet) or `mergeDeposited` (Staking).
- **Telegram alerts**: a match for your single is listed, a bid appears for your level, your order fills, a pair becomes merge-ready.

## How it uses Squeekchain

- Reads `SqueekNFT.level`, `nextMergeHeight`, `ownerOf` and `SqueekCore.state().blockHeight` on chain for every Squeek.
- Reads `api.squeekchain.com` for contract identities, the level table (`maximumLevel`, `cooldownBlocks`, `basePower`) and Staking custody.
- The escrow checks level and merge readiness live at every fill; nothing in a transaction is taken from the API.

## Layout

- `contracts/`: `SqueekMatchEscrow` (Foundry). No owner, no fee, no upgrade, no pause.
- `server/`: Node service. Squeek snapshot, escrow event indexer, JSON API, Telegram bot.
- `web/`: React + wagmi app, built to `dist/`.
- `shared/escrow-abi.json`: the escrow ABI used by the server and the web app.
- `deploy/`: Caddy site block and the escrow deploy script.

## Run

```
cd contracts && forge test
cd server && npm ci && cp .env.example .env && npm start
cd web && npm ci && npm run build
```

Serve `dist/` and proxy `/api/*` to the server (see `deploy/Caddyfile`).

Version 2 builds on the SqueekMatch escrow first produced through IMD job b9a939c1, retargeted to Squeekchain's current NFT model and extended with batch fills, a server, Telegram alerts and a new web app.

Fan-made and unofficial. Testnet only: Sepolia SQK and Squeeks have no monetary value. MIT licensed.
