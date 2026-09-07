#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "======================================================================"
echo "          COINSWAG AUTOMATED ZERO-KYC CRYPTO SWAP ENGINE"
echo "              Monero (XMR) Zero-Knowledge Privacy Hub"
echo "======================================================================"

echo "[1/3] Building all monorepo packages..."
npm run build

echo "[2/3] Launching production cluster via PM2..."
npx pm2 start ecosystem.config.cjs
npx pm2 status

echo "======================================================================"
echo "[3/3] COINSWAG PRODUCTION CLUSTER RUNNING LIVE!"
echo "  * Web App:          http://localhost:5173"
echo "  * Backend REST API: http://localhost:3001"
echo "  * Health Check:     http://localhost:3001/health"
echo "======================================================================"
