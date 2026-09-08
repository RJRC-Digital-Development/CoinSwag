# Multi-stage production build for CoinSwag
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/blockchain/package*.json ./packages/blockchain/
COPY packages/liquidity/package*.json ./packages/liquidity/
COPY apps/api/package*.json ./apps/api/
COPY apps/bot/package*.json ./apps/bot/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy full source tree
COPY . .

# Compile TypeScript packages and build web frontend
RUN npm run build

# -------------------------------------------------------------
# Runner stage
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173
ENV API_PORT=3001

# Copy compiled bundles and manifests
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/server-prod.js ./server-prod.js

EXPOSE 5173 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5173/health || exit 1

CMD ["node", "server-prod.js"]
