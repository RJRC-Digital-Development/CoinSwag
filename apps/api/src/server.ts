import express, { Request, Response } from 'express';
import cors from 'cors';
import { TOP_ASSETS, CreateSplitQuoteRequest } from '@coinswag/core';
import { OrderManager } from './services/order.manager';

export function createServer(orderManager: OrderManager = new OrderManager()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

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

  // ============================================================================
  // Standard Swap Endpoints
  // ============================================================================

  // POST /api/v1/quotes - Calculate instant swap quote & competitive fees
  app.post('/api/v1/quotes', (req: Request, res: Response) => {
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
  app.post('/api/v1/swaps', async (req: Request, res: Response) => {
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
  app.post('/api/v1/splits/quote', (req: Request, res: Response) => {
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
  app.post('/api/v1/splits/create', async (req: Request, res: Response) => {
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
  app.get('/api/v1/splits/:id/keys', (req: Request, res: Response) => {
    try {
      const secretToken = (req.query.secretToken as string) || (req.headers['x-secret-token'] as string);
      if (!secretToken) {
        return res.status(401).json({ error: 'Missing secret order authorization token' });
      }

      const exportData = orderManager.downloadOrderKeys(req.params.id, secretToken);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="coinswag-keyvault-${req.params.id}.json"`);
      res.json(exportData);
    } catch (err: any) {
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

  return { app, orderManager };
}
