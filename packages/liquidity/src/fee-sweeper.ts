import { Blockchain, SwapOrder, PriceFeedService, ASSET_MAP } from '@coinswag/core';
import { BlockchainAdapterRegistry } from '@coinswag/blockchain';

export interface FeeSweeperConfig {
  sweepMode: 'REALTIME' | 'BATCH';
  thresholdUsd: number; // For BATCH mode: auto-sweep when buffer reaches this value
  recipientWallets: Partial<Record<Blockchain, string>>;
}

export interface SweptTransaction {
  id: string;
  orderId?: string;
  assetId: string;
  chain: Blockchain;
  amount: number;
  amountUsd: number;
  destinationWallet: string;
  txHash: string;
  sweptAt: number;
  mode: 'REALTIME' | 'BATCH';
}

export interface FeeBuffer {
  assetId: string;
  chain: Blockchain;
  accumulatedAmount: number;
  accumulatedUsd: number;
  lastUpdated: number;
}

export interface FeeSweeperStats {
  totalFeesCollectedUsd: number;
  totalFeesSweptUsd: number;
  pendingBufferUsd: number;
  sweepMode: 'REALTIME' | 'BATCH';
  thresholdUsd: number;
  buffers: FeeBuffer[];
  recentSweeps: SweptTransaction[];
}

export class FeeSweeperService {
  private config: FeeSweeperConfig;
  private priceFeed: PriceFeedService;
  private registry: BlockchainAdapterRegistry;
  
  // Pending fee balances awaiting batch threshold
  private buffers: Map<string, FeeBuffer> = new Map();
  // History of completed sweeps to external wallets
  private sweepHistory: SweptTransaction[] = [];

  private totalFeesCollectedUsd = 0;
  private totalFeesSweptUsd = 0;

  constructor(
    priceFeed: PriceFeedService,
    registry: BlockchainAdapterRegistry,
    customConfig?: Partial<FeeSweeperConfig>
  ) {
    this.priceFeed = priceFeed;
    this.registry = registry;

    this.config = {
      sweepMode: (process.env.FEE_SWEEP_MODE as any) || 'REALTIME',
      thresholdUsd: parseFloat(process.env.FEE_SWEEP_THRESHOLD_USD || '50.0'),
      recipientWallets: {
        monero: process.env.FEE_RECIPIENT_XMR || '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoogDavup3H',
        bitcoin: process.env.FEE_RECIPIENT_BTC || 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        ethereum: process.env.FEE_RECIPIENT_EVM || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        bsc: process.env.FEE_RECIPIENT_EVM || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        polygon: process.env.FEE_RECIPIENT_EVM || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        solana: process.env.FEE_RECIPIENT_SOL || '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        ...customConfig?.recipientWallets
      },
      ...customConfig
    };
  }

  /**
   * Records a platform fee from a settled swap order.
   * If in REALTIME mode, immediately dispatches the fee to the external wallet.
   * If in BATCH mode, accumulates into buffer until threshold is crossed.
   */
  public async recordFee(order: SwapOrder): Promise<SweptTransaction | null> {
    const fromAsset = order.quote.fromAsset;
    const feeAmount = order.quote.feeBreakdown.serviceFeeAmountInFromAsset;
    const fromPriceUsd = this.priceFeed.getPriceUsd(fromAsset.id);
    const feeUsd = feeAmount * fromPriceUsd;

    this.totalFeesCollectedUsd += feeUsd;

    if (this.config.sweepMode === 'REALTIME') {
      return await this.dispatchSweep(fromAsset.id, fromAsset.chain, feeAmount, feeUsd, order.id);
    } else {
      // Accumulate in buffer
      let buffer = this.buffers.get(fromAsset.id);
      if (!buffer) {
        buffer = {
          assetId: fromAsset.id,
          chain: fromAsset.chain,
          accumulatedAmount: 0,
          accumulatedUsd: 0,
          lastUpdated: Date.now()
        };
        this.buffers.set(fromAsset.id, buffer);
      }

      buffer.accumulatedAmount += feeAmount;
      buffer.accumulatedUsd += feeUsd;
      buffer.lastUpdated = Date.now();

      // Check if threshold exceeded
      if (buffer.accumulatedUsd >= this.config.thresholdUsd) {
        return await this.sweepBuffer(fromAsset.id);
      }
      return null;
    }
  }

  /**
   * Sweeps an accumulated buffer to the operator's external wallet.
   */
  public async sweepBuffer(assetId: string): Promise<SweptTransaction | null> {
    const buffer = this.buffers.get(assetId);
    if (!buffer || buffer.accumulatedAmount <= 0) return null;

    const amountToSweep = buffer.accumulatedAmount;
    const usdToSweep = buffer.accumulatedUsd;

    // Reset buffer before dispatching
    buffer.accumulatedAmount = 0;
    buffer.accumulatedUsd = 0;
    buffer.lastUpdated = Date.now();

    return await this.dispatchSweep(assetId, buffer.chain, amountToSweep, usdToSweep);
  }

  /**
   * Dispatches outbound transaction directly to the operator's configured external wallet.
   */
  private async dispatchSweep(
    assetId: string,
    chain: Blockchain,
    amount: number,
    amountUsd: number,
    orderId?: string
  ): Promise<SweptTransaction> {
    const recipient = this.config.recipientWallets[chain];
    if (!recipient) {
      throw new Error(`No external fee recipient wallet configured for chain: ${chain}`);
    }

    const adapter = this.registry.getAdapter(chain);
    const payoutResult = await adapter.broadcastPayout(recipient, amount, assetId);

    this.totalFeesSweptUsd += amountUsd;

    const sweepRecord: SweptTransaction = {
      id: `sweep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      orderId,
      assetId,
      chain,
      amount,
      amountUsd,
      destinationWallet: recipient,
      txHash: payoutResult.txHash,
      sweptAt: Date.now(),
      mode: this.config.sweepMode
    };

    this.sweepHistory.unshift(sweepRecord);
    if (this.sweepHistory.length > 100) this.sweepHistory.pop();

    console.log(`[FeeSweeper] Swept ${amount.toFixed(6)} ${assetId} ($${amountUsd.toFixed(2)}) to external ${chain} wallet: ${recipient} (Tx: ${payoutResult.txHash})`);

    return sweepRecord;
  }

  /**
   * Sweeps all pending buffers immediately (manual admin sweep).
   */
  public async sweepAllBuffers(): Promise<SweptTransaction[]> {
    const sweeps: SweptTransaction[] = [];
    for (const assetId of this.buffers.keys()) {
      const sweep = await this.sweepBuffer(assetId);
      if (sweep) sweeps.push(sweep);
    }
    return sweeps;
  }

  /**
   * Returns complete stats for the operator dashboard / API.
   */
  public getStats(): FeeSweeperStats {
    const activeBuffers = Array.from(this.buffers.values()).filter(b => b.accumulatedAmount > 0);
    const pendingBufferUsd = activeBuffers.reduce((acc, b) => acc + b.accumulatedUsd, 0);

    return {
      totalFeesCollectedUsd: Number(this.totalFeesCollectedUsd.toFixed(2)),
      totalFeesSweptUsd: Number(this.totalFeesSweptUsd.toFixed(2)),
      pendingBufferUsd: Number(pendingBufferUsd.toFixed(2)),
      sweepMode: this.config.sweepMode,
      thresholdUsd: this.config.thresholdUsd,
      buffers: activeBuffers,
      recentSweeps: this.sweepHistory.slice(0, 15)
    };
  }

  public updateRecipientWallet(chain: Blockchain, address: string): void {
    this.config.recipientWallets[chain] = address;
  }
}
