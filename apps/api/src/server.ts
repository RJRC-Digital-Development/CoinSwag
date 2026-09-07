import express, { Request, Response } from 'express';
import cors from 'cors';
import { TOP_ASSETS } from '@coinswag/core';
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
      kyc: 'STRICTLY_NO_KYC',
      timestamp: Date.now()
    });
  });

  // GET /api/v1/assets - List all top 10+ supported cryptocurrencies
  app.get('/api/v1/assets', (req: Request, res: Response) => {
    const prices = orderManager.getPriceFeed().getAllPrices();
    const assetsWithPrices = TOP_ASSETS.map(asset => ({
      ...asset,
      priceUsd: prices[asset.id] || 0
    }));
    res.json({ assets: assetsWithPrices });
  });

  // GET /api/v1/nodes/status - Live health & latency monitoring of external node pool
  app.get('/api/v1/nodes/status', (req: Request, res: Response) => {
    const statuses = orderManager.getRegistry().getFailoverManager().getAllNodeStatuses();
    res.json({
      totalNodes: statuses.length,
      healthyNodes: statuses.filter(n => n.isHealthy).length,
      nodes: statuses
    });
  });

  // GET /api/v1/fees/stats - Monitor revenue and external wallet fee sweep status
  app.get('/api/v1/fees/stats', (req: Request, res: Response) => {
    const stats = orderManager.getFeeSweeper().getStats();
    res.json({ stats });
  });

  // POST /api/v1/fees/sweep-now - Manually sweep all accumulated fee buffers to external wallets
  app.post('/api/v1/fees/sweep-now', async (req: Request, res: Response) => {
    try {
      const sweeps = await orderManager.getFeeSweeper().sweepAllBuffers();
      res.json({
        message: `Swept ${sweeps.length} asset buffers to external wallets`,
        sweeps
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

    // Send initial snapshot
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
      // Start async simulation
      orderManager.simulateFullSwap(req.params.id, delay);
      res.json({ message: 'Simulation initiated in background' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

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

