import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { TOP_ASSETS, CreateSplitQuoteRequest } from '@coinswag/core';
import { OrderManager } from './services/order.manager';
import {
  securityHeadersMiddleware,
  inputValidationMiddleware,
  globalRateLimit,
  quoteRateLimit,
  orderRateLimit,
  keyVaultRateLimit,
  rateLimiterSentinel
} from './security';

export function createServer(orderManager: OrderManager = new OrderManager()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeadersMiddleware);
  app.use(cors());
  app.use(
    express.json({
      limit: '1mb',
      reviver: (key, value) => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error(`Prototype pollution vector detected: forbidden key "${key}"`);
        }
        return value;
      }
    })
  );

  // Catch body-parser and reviver syntax/pollution errors
  app.use((err: any, req: Request, res: Response, next: any) => {
    if (err) {
      return res.status(400).json({
        error: 'Malicious payload rejected (Anti-Tampering Sentinel)',
        reason: err.message
      });
    }
    next();
  });

  app.use(inputValidationMiddleware);
  app.use(globalRateLimit);

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'CoinSwag Crypto Swap Automator',
      hub: 'Monero (XMR) Zero-Knowledge Privacy Hub',
      features: ['Single-Hop', 'Double-Hop', 'Address-Splitting', 'Time-Release-Hold', 'Keypair-Generation'],
      kyc: 'STRICTLY_NO_KYC',
      timestamp: Date.now()
    });
  });

  // GET /api/v1/assets - List all top supported cryptocurrencies
  app.get('/api/v1/assets', (req: Request, res: Response) => {
    const prices = orderManager.getPriceFeed().getAllPrices();
    const assetsWithPrices = TOP_ASSETS.map(asset => ({
      ...asset,
      priceUsd: prices[asset.id] || 0
    }));
    res.json({ assets: assetsWithPrices });
  });

  // GET /api/v1/legal/disclaimer - Autonomous non-custodial protocol disclosures & terms
  app.get('/api/v1/legal/disclaimer', (req: Request, res: Response) => {
    res.json({
      protocol: 'CoinSwag Non-Custodial Autonomous Crypto Routing Protocol',
      lastUpdated: 'September 2026',
      custody: 'NON_CUSTODIAL',
      kycPolicy: 'ZERO_KYC_NO_LOGS',
      summary: 'CoinSwag is an open, autonomous non-custodial software protocol. All blockchain transactions are final and irreversible. Users maintain 100% unilateral custody and responsibility for their cryptographic keys, transactions, and legal compliance.',
      keyDisclosures: [
        'Non-custodial: CoinSwag never holds, manages, or custodies private keys or user funds.',
        'Blockchain finality: All on-chain broadcasts are immutable and cannot be canceled, refunded, or reversed.',
        'Zero-persistence: Generated split keypairs are ephemeral in volatile memory and wiped after TTL. Users must backup their own vaults.',
        'Market risk: Cryptocurrency exchange rates fluctuate dynamically. Output amounts are subject to slippage and network miner fees.',
        'Sanctions & AML: Strictly prohibited in OFAC/UN sanctioned territories (Cuba, Iran, North Korea, Syria, Crimea/Donetsk/Luhansk). Illicit usage strictly prohibited.',
        'As-Is software: Protocol and code provided without warranties of any kind under applicable law.'
      ],
      legalDocumentUri: '/LEGAL.md',
      acceptedByUsingService: true
    });
  });

  // ============================================================================
  // Standard Swap Endpoints
  // ============================================================================

  // POST /api/v1/quotes - Calculate instant swap quote & competitive fees
  app.post('/api/v1/quotes', quoteRateLimit, (req: Request, res: Response) => {
    try {
      const { fromAssetId, toAssetId, amountIn, rateType } = req.body;
      if (!fromAssetId || !toAssetId || !amountIn) {
        return res.status(400).json({ error: 'Missing required fields: fromAssetId, toAssetId, amountIn' });
      }

      const numAmount = parseFloat(amountIn);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amountIn' });
      }

      const quote = orderManager.createQuote(fromAssetId, toAssetId, numAmount, rateType || 'FLOAT');
      res.json({ quote });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/swaps - Create new swap session with single-use deposit address
  app.post('/api/v1/swaps', orderRateLimit, async (req: Request, res: Response) => {
    try {
      const {
        quoteId,
        destinationAddress,
        refundAddress,
        destinationExtraId,
        anonymizationDelaySeconds
      } = req.body;

      if (!quoteId || !destinationAddress || !refundAddress) {
        return res.status(400).json({
          error: 'Missing required parameters: quoteId, destinationAddress, refundAddress'
        });
      }

      const order = await orderManager.createOrder(
        quoteId,
        destinationAddress,
        refundAddress,
        destinationExtraId,
        anonymizationDelaySeconds ? parseInt(anonymizationDelaySeconds, 10) : 0
      );

      res.status(201).json({ order });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/v1/swaps/:id - Retrieve order status
  app.get('/api/v1/swaps/:id', (req: Request, res: Response) => {
    const order = orderManager.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or purged under Zero-KYC policy' });
    }
    res.json({ order });
  });

  // GET /api/v1/swaps/:id/stream - SSE real-time tracking stream
  app.get('/api/v1/swaps/:id/stream', (req: Request, res: Response) => {
    const orderId = req.params.id;
    const order = orderManager.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify(order)}\n\n`);

    const unsubscribe = orderManager.subscribe(orderId, updatedOrder => {
      res.write(`data: ${JSON.stringify(updatedOrder)}\n\n`);
      if (updatedOrder.status === 'COMPLETED' || updatedOrder.status === 'FAILED') {
        res.end();
      }
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // POST /api/v1/swaps/:id/advance - Advance one step (simulation / test trigger)
  app.post('/api/v1/swaps/:id/advance', async (req: Request, res: Response) => {
    try {
      const updated = await orderManager.advanceOrderStep(req.params.id);
      res.json({ order: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/swaps/:id/auto-complete - Simulate entire swap execution
  app.post('/api/v1/swaps/:id/auto-complete', async (req: Request, res: Response) => {
    try {
      const delay = req.body.stepDelayMs || 700;
      orderManager.simulateFullSwap(req.params.id, delay);
      res.json({ message: 'Simulation initiated in background' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================================================
  // Split Address & Time-Release Endpoints
  // ============================================================================

  // POST /api/v1/splits/quote - Generate multi-destination split quote with fee tiers
  app.post('/api/v1/splits/quote', quoteRateLimit, (req: Request, res: Response) => {
    try {
      const { fromAssetId, amountIn, destinations, autoGenerateKeys } = req.body;
      if (!fromAssetId || !amountIn || !destinations || !Array.isArray(destinations)) {
        return res.status(400).json({
          error: 'Missing required parameters: fromAssetId, amountIn, destinations (array)'
        });
      }

      const numAmount = parseFloat(amountIn);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amountIn' });
      }

      const quoteRequest: CreateSplitQuoteRequest = {
        fromAssetId,
        amountIn: numAmount,
        destinations,
        autoGenerateKeys: Boolean(autoGenerateKeys)
      };

      const quote = orderManager.createSplitQuote(quoteRequest);
      res.json({ quote });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/splits/create - Initialize split order and time-release vault
  app.post('/api/v1/splits/create', orderRateLimit, async (req: Request, res: Response) => {
    try {
      const { quoteId, refundAddress } = req.body;
      if (!quoteId || !refundAddress) {
        return res.status(400).json({ error: 'Missing required parameters: quoteId, refundAddress' });
      }

      const order = await orderManager.createSplitOrder(quoteId, refundAddress);
      res.status(201).json({ order });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/v1/splits/:id - Query split order status and destination tranches
  app.get('/api/v1/splits/:id', (req: Request, res: Response) => {
    const order = orderManager.getSplitOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Split order not found or purged under Zero-KYC policy' });
    }
    res.json({ order });
  });

  // GET /api/v1/splits/:id/keys - Secure Zero-KYC download of generated private keys
  app.get('/api/v1/splits/:id/keys', keyVaultRateLimit, (req: Request, res: Response) => {
    const clientIp = rateLimiterSentinel.getClientIp(req);
    try {
      const secretToken = (req.query.secretToken as string) || (req.headers['x-secret-token'] as string);
      const passphrase = (req.query.passphrase as string) || (req.headers['x-vault-passphrase'] as string);

      if (!secretToken) {
        rateLimiterSentinel.recordSecurityFailure(clientIp);
        return res.status(401).json({ error: 'Missing secret order authorization token' });
      }

      const exportData = orderManager.downloadOrderKeys(req.params.id, secretToken, passphrase);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="coinswag-keyvault-${req.params.id}.json"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.json(exportData);
    } catch (err: any) {
      rateLimiterSentinel.recordSecurityFailure(clientIp);
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/v1/splits/:id/schedule - Timeline of time-release release dates
  app.get('/api/v1/splits/:id/schedule', (req: Request, res: Response) => {
    const timeline = orderManager.getTimeReleaseManager().getScheduleTimeline(req.params.id);
    res.json({ schedule: timeline });
  });

  // POST /api/v1/splits/:id/advance - Advance simulation step for split order
  app.post('/api/v1/splits/:id/advance', async (req: Request, res: Response) => {
    try {
      const updated = await orderManager.advanceSplitOrderStep(req.params.id);
      res.json({ order: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/splits/:id/release-early - Early payout trigger for specific tranche
  app.post('/api/v1/splits/:id/release-early', async (req: Request, res: Response) => {
    try {
      const { destinationId, secretToken } = req.body;
      if (!destinationId || !secretToken) {
        return res.status(400).json({ error: 'Missing destinationId or secretToken' });
      }

      const result = await orderManager.getTimeReleaseManager().releaseTrancheEarly(
        req.params.id,
        destinationId,
        secretToken
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================================================
  // Infrastructure & Node Operations
  // ============================================================================

  // GET /api/v1/nodes/status - Live health of all monitored external RPC nodes
  app.get('/api/v1/nodes/status', (req: Request, res: Response) => {
    try {
      const statuses = orderManager.getRegistry().getFailoverManager().getAllNodeStatuses();
      res.json({
        totalNodes: statuses.length,
        healthyCount: statuses.filter(s => s.isHealthy).length,
        nodes: statuses
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/v1/fees/stats - Operator revenue & fee sweeper status
  app.get('/api/v1/fees/stats', (req: Request, res: Response) => {
    try {
      const stats = orderManager.getFeeSweeper().getStats();
      res.json({ stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/fees/sweep-now - 1-click manual trigger to sweep all buffers to external wallets
  app.post('/api/v1/fees/sweep-now', async (req: Request, res: Response) => {
    try {
      const sweptTransactions = await orderManager.getFeeSweeper().sweepAllBuffers();
      res.json({
        message: `Manual sweep completed for ${sweptTransactions.length} pending buffers`,
        swept: sweptTransactions
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/admin/janitor - Manually invoke Zero-KYC data shredder
  app.post('/api/v1/admin/janitor', (req: Request, res: Response) => {
    const purgedCount = orderManager.runZeroKycJanitor();
    res.json({ message: `Zero-KYC Janitor executed. Purged ${purgedCount} orders.` });
  });

  // ============================================================================
  // Financial Sentinel & Circuit Breaker Control
  // ============================================================================

  // GET /api/v1/sentinel/status - Query financial circuit breaker and intrusion status
  app.get('/api/v1/sentinel/status', (req: Request, res: Response) => {
    const clientIp = rateLimiterSentinel.getClientIp(req);
    const cbStatus = orderManager.getCircuitBreaker().getStatus();
    const jailStatus = rateLimiterSentinel.isJailed(clientIp);

    res.json({
      sentinel: 'CoinSwag Financial & Network Threat Sentinel',
      status: cbStatus.isHalted ? 'EMERGENCY_HALTED' : 'ARMED_AND_ACTIVE',
      circuitBreaker: cbStatus,
      clientStatus: {
        ip: clientIp,
        jailed: jailStatus.jailed,
        remainingSeconds: jailStatus.remainingSeconds
      }
    });
  });

  // POST /api/v1/sentinel/trip - Operator emergency kill switch
  app.post('/api/v1/sentinel/trip', (req: Request, res: Response) => {
    const reason = req.body.reason || 'Manual operator emergency engagement';
    orderManager.getCircuitBreaker().trip(reason);
    res.json({
      message: '🚨 Financial Circuit Breaker engaged. All crypto outflows halted immediately.',
      status: orderManager.getCircuitBreaker().getStatus()
    });
  });

  // POST /api/v1/sentinel/reset - Operator manual resumption switch
  app.post('/api/v1/sentinel/reset', (req: Request, res: Response) => {
    orderManager.getCircuitBreaker().reset();
    res.json({
      message: '🛡️ Financial Circuit Breaker safely reset. Outflows resumed in CLOSED state.',
      status: orderManager.getCircuitBreaker().getStatus()
    });
  });

  // POST /api/v1/sentinel/reset-jail - Operator manual unban
  app.post('/api/v1/sentinel/reset-jail', (req: Request, res: Response) => {
    rateLimiterSentinel.resetJail(req.body?.ip);
    res.json({ message: req.body?.ip ? `IP ${req.body.ip} unbanned` : 'All rate-limiter jails reset' });
  });

  // Serve static web frontend if apps/web/dist exists (Unified single-process architecture)
  const possibleDistPaths = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(__dirname, '../web/dist')
  ];

  const webDistPath = possibleDistPaths.find(p => fs.existsSync(p));
  if (webDistPath) {
    app.use(express.static(webDistPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));

    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/') || req.path === '/health') {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  return { app, orderManager };
}
