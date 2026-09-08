# CoinSwag: Monero-Routed Multi-Chain Swap Engine

> **Monero Routing Architecture**: Eligible cross-chain routes use **Monero (XMR)** as an intermediate conversion leg, subject to applicable law and the platform’s terms.

---

## ⚡ Key Features

1. **Monero Routing Layer**:
   - **Cross-Chain Decoupling**: For public-to-public swaps (e.g. `BTC -> SOL`), CoinSwag automatically routes through Monero (`BTC -> XMR -> SOL`).
   - Routes use Monero’s native protocol features as part of the conversion flow; no claim of anonymity or untraceability is made.
   - If the swap starts or ends with Monero (`XMR -> Coin B` or `Coin A -> XMR`), the engine skips the redundant leg and executes directly.
2. **Competitive Pricing & Fee Engine**:
   - **Single-Hop Swaps**: **0.45%** flat fee (beats FixedFloat 0.50% float rate and MajesticBank 0.50%).
   - **Double-Hop Privacy Swaps**: **0.75% all-in** (0.375% per leg), undercutting privacy aggregators that charge 1.0% to 1.8% for multi-hop swaps.
   - Dynamic real-time network/miner fee pass-through.
3. **Ephemeral Order Data**:
   - No user registration, no accounts, no cookies, no tracking.
   - Ephemeral swap sessions identified by single-use order tokens.
   - Integrated data-retention janitor that permanently scrubs transaction metadata post-settlement.
4. **Phase 1 Top 10+ Native Blockchains & Tokens**:
   - **BTC**: Bitcoin Native (Native SegWit Bech32 & Taproot)
   - **ETH**: Ethereum Native
   - **XMR**: Monero (Central Privacy Hub)
   - **SOL**: Solana Native
   - **USDT**: Multi-chain (ERC-20 & TRC-20)
   - **USDC**: Multi-chain (ERC-20 & SPL)
   - **BNB**: BNB Smart Chain (BEP-20)
   - **XRP**: Ripple Ledger (with Destination Tag support)
   - **LTC**: Litecoin Native
   - **DOGE**: Dogecoin Native

---

## 📁 Repository Structure

```
CoinSwag/
├── packages/
│   ├── core/            # Domain models, pricing engine, address validators, state machine
│   ├── blockchain/      # Multi-chain adapters (Bitcoin, EVM, Monero RPC, Solana, Generic)
│   └── liquidity/       # Liquidity providers (Internal Reserves, Bridges, Simulator) & Router
└── apps/
    ├── api/             # Express REST API, Event-Stream (SSE), Order Manager, Janitor
    └── web/             # Vite + React + Tailwind CSS modern privacy swap interface
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Verification Tests
```bash
# Core fee engine, address validation, and state machine tests
node packages/core/dist/test-suite.js

# Full API endpoint and Monero Hub integration test
node apps/api/dist/test-api.js
```

### 3. Start Backend API & Engine
```bash
npm run start --workspace=@coinswag/api
# Starts on http://localhost:3001
```

### 4. Start Web Interface
```bash
npm run dev --workspace=@coinswag/web
# Starts on http://localhost:5173
```
