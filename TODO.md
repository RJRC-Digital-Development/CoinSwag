# CoinSwag: Project Status, Roadmap & Production TODO

This document outlines the completed milestones, immediate deployment tasks, and future roadmap for **CoinSwag**, the automated Zero-KYC multi-chain swap engine with Monero Privacy Hub.

---

## ✅ Completed Milestones

### Phase 1: Core Architecture & Privacy Hub
- [x] **Monero Zero-Knowledge Privacy Hub**: Double-hop routing (`Coin A -> XMR -> Coin B`) decoupling source deposits from destination payouts via RingCT, stealth addresses, and subaddress churn.
- [x] **Single-Hop Fast Routing**: Direct swaps when entering or exiting with Monero (`XMR -> Coin B` or `Coin A -> XMR`).
- [x] **Fee Engine**:
  - `0.45%` flat fee for single-hop routes (undercutting FixedFloat 0.50% and MajesticBank 0.50%).
  - `0.75%` all-in fee for double-hop privacy routes (0.375% per leg, half the cost of typical 1.2%–1.8% aggregators).
  - Dynamic miner/gas fee pass-through.
- [x] **Strict Zero-KYC Enforcement**:
  - Ephemeral session memory (UUID + private secret access token).
  - Automated Janitor background worker permanently shredding addresses and transaction metadata post-settlement.
- [x] **Multi-Chain Address Format Validators**: Regex and checksum validation for BTC (SegWit/Taproot/Legacy), ETH/EVM (`0x...`), SOL (Base58), XMR (95-char / 106-char subaddresses), and major L1s.

### Phase 2: Top 20+ Blockchains & Decentralized Liquidity
- [x] **Top 20+ Asset Support**: BTC, ETH, XMR, SOL, USDT, USDC, BNB, XRP, LTC, DOGE, AVAX, ADA, DOT, POL/MATIC, LINK, ATOM, NEAR, KAS, etc.
- [x] **Automated Revenue Sweeper (`FeeSweeperEngine`)**:
  - Multi-chain revenue routing (`FEE_RECIPIENT_XMR`, `FEE_RECIPIENT_BTC`, `FEE_RECIPIENT_EVM`, `FEE_RECIPIENT_SOL`).
  - Dual modes: `REALTIME` (instant sweep) or `BATCH` (accumulates until e.g. $50 threshold to save network fees).
  - Manual flush API (`POST /api/v1/fees/sweep-now`).
- [x] **THORChain DEX Liquidity Integration (`ThorchainProvider`)**:
  - Midgard & Thornode live pool depth querying.
  - Native cross-chain routing for large ticket swaps exceeding local reserves.
- [x] **Anti-Timing Stealth Churn**:
  - Configurable delay (0m to 60m) breaking statistical cross-chain timing-correlation analysis.
- [x] **Mobile Wallet Support**: Instant SVG QR code rendering for Cake Wallet, Exodus, Phantom, Trust Wallet, MetaMask.
- [x] **Operator Dashboard (`OperatorDrawer`)**: Live fee statistics, 1-click manual fee sweep, and 40+ remote RPC node status monitor.

### Phase 3: Production Hardening & Bot Integration
- [x] **Tor SOCKS5 Network Shielding (`USE_TOR_PROXY=true`)**: Outgoing RPC queries route through `127.0.0.1:9050` with automated failover and IP masking.
- [x] **Telegram Swap Bot (`apps/bot`)**:
  - Interactive bot supporting `/start`, `/quote`, `/swap`, `/track`, and `/rates`.
  - Ephemeral in-memory session tracking.
- [x] **Dynamic Mempool Gas Optimizer**:
  - Real-time Bitcoin fee estimation via `mempool.space` API.
  - EVM EIP-1559 base fee + priority tip estimation.
- [x] **Zero-Docker 1-Click Production Launcher**:
  - PM2 configuration (`ecosystem.config.cjs`) running API, Telegram Bot, and Web servers.
  - Windows (`start-production.bat`, `start-production.ps1`) and Linux (`start-production.sh`) launchers.

---

## 📌 Immediate Production Deployment Checklist (TODO)

### 1. Environment & Secrets Configuration
- [ ] Copy `.env.example` to `.env` on the host/VPS.
- [ ] Configure `FEE_RECIPIENT_*` addresses with your cold storage wallets:
  - `FEE_RECIPIENT_XMR` (Monero primary stealth subaddress)
  - `FEE_RECIPIENT_BTC` (Bitcoin SegWit/Taproot address)
  - `FEE_RECIPIENT_EVM` (Ethereum / Arbitrum / Polygon address)
  - `FEE_RECIPIENT_SOL` (Solana address)
- [ ] Add `TELEGRAM_BOT_TOKEN` from [@BotFather](https://t.me/BotFather) into `.env`.
- [ ] *(Optional)* Set `USE_TOR_PROXY=true` if running a local Tor daemon (`127.0.0.1:9050`).

### 2. Node & Wallet Infrastructure
- [ ] **Monero Wallet RPC**:
  - Start `monero-wallet-rpc` with RPC login and bind to port `18083`.
  - Verify remote node connection to `node.community.rino.io:18081` or Cake Wallet nodes.
- [ ] **RPC Endpoints**:
  - Review default public RPC endpoints in `packages/blockchain/src/config/rpc.config.ts`.
  - *(Recommended)* Add private RPC keys (Alchemy, Infura, QuickNode, Helius) for high-load production.

### 3. Web & Network Exposure
- [ ] Configure domain name DNS (A/AAAA records) pointing to host/VPS.
- [ ] Set up reverse proxy (Caddy or Nginx) with automatic HTTPS/SSL:
  - Reverse proxy port `3001` for `/api` and WebSocket/SSE.
  - Reverse proxy port `5173` (or static `dist/`) for frontend web interface.
- [ ] Firewall configuration: allow ports `80`, `443`; block external access to ports `3001` and `18083`.

### 4. Verification & Pilot Testing
- [ ] Run complete test suite: `npm test`.
- [ ] Execute test micro-swap ($5–$10 equivalent) on mainnet:
  - Test single-hop: `LTC -> XMR`.
  - Test double-hop: `SOL -> XMR -> BTC`.
- [ ] Verify automatic fee sweep triggers correctly in both `REALTIME` and `BATCH` mode.
- [ ] Verify Zero-KYC Janitor correctly purges order data post-expiration.

---

## 🚀 Phase 4 Roadmap & Future Enhancements

- [ ] **Lightning Network Integration**: Native Bitcoin Lightning invoice deposits and payouts for sub-second, ultra-low fee swaps.
- [ ] **Cross-Chain Atomic Swaps**: Direct peer-to-peer atomic swaps (BTC-XMR via Farcaster/COMIT protocol) as a zero-trust alternative route.
- [ ] **Decentralized Relay / P2P Order Book**: P2P order matching between liquidity providers without centralized hot-wallet custody.
- [ ] **Onion Site (.onion Hidden Service)**: Native Tor hidden service hosting for zero-clearnet accessibility.
- [ ] **Telegram Mini App (TMA)**: Embedded React web view inside Telegram for a seamless native GUI swapping experience inside chats.
- [ ] **Affiliate / Partner Referral System**: Zero-KYC cryptographic referral codes allowing wallet and website integrators to earn a rev-share on swaps.
