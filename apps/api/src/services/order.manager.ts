import {
  SwapOrder,
  SwapQuote,
  SwapStatus,
  SwapStateMachine,
  FeeCalculatorService,
  PriceFeedService,
  ASSET_MAP,
  AddressValidator
} from '@coinswag/core';
import { BlockchainAdapterRegistry } from '@coinswag/blockchain';
import {
  SwapRouter,
  InternalPoolProvider,
  SimulatorProvider,
  ExternalBridgeProvider,
  ThorchainProvider,
  FeeSweeperService
} from '@coinswag/liquidity';

export class OrderManager {
  private orders: Map<string, SwapOrder> = new Map();
  private quoteCache: Map<string, SwapQuote> = new Map();
  private priceFeed: PriceFeedService;
  private feeCalculator: FeeCalculatorService;
  private registry: BlockchainAdapterRegistry;
  private router: SwapRouter;
  private feeSweeper: FeeSweeperService;
  private listeners: Map<string, Set<(order: SwapOrder) => void>> = new Map();

  constructor() {
    this.priceFeed = new PriceFeedService();
    this.feeCalculator = new FeeCalculatorService(this.priceFeed);
    this.registry = new BlockchainAdapterRegistry();

    const internalPool = new InternalPoolProvider(this.priceFeed);
    const thorchain = new ThorchainProvider(this.priceFeed);
    const bridge = new ExternalBridgeProvider(this.priceFeed);
    const simulator = new SimulatorProvider(this.priceFeed);

    this.router = new SwapRouter(this.registry, [internalPool, thorchain, bridge, simulator]);
    this.feeSweeper = new FeeSweeperService(this.priceFeed, this.registry);

    // Launch background janitor (runs every 60 seconds)
    setInterval(() => this.runZeroKycJanitor(), 60000);
  }

  public getPriceFeed(): PriceFeedService {
    return this.priceFeed;
  }

  public getFeeCalculator(): FeeCalculatorService {
    return this.feeCalculator;
  }

  public getRegistry(): BlockchainAdapterRegistry {
    return this.registry;
  }

  public getFeeSweeper(): FeeSweeperService {
    return this.feeSweeper;
  }

  /**
   * Generates and stores an instant swap quote.
   */
  public createQuote(
    fromAssetId: string,
    toAssetId: string,
    amountIn: number,
    rateType: 'FLOAT' | 'FIXED' = 'FLOAT'
  ): SwapQuote {
    const fromAsset = ASSET_MAP[fromAssetId];
    const toAsset = ASSET_MAP[toAssetId];

    if (!fromAsset) throw new Error(`Unknown source asset: ${fromAssetId}`);
    if (!toAsset) throw new Error(`Unknown target asset: ${toAssetId}`);

    const quote = this.feeCalculator.generateQuote(fromAsset, toAsset, amountIn, rateType);
    this.quoteCache.set(quote.id, quote);
    return quote;
  }

  /**
   * Creates a new Swap Order from an active quote.
   */
  public async createOrder(
    quoteId: string,
    destinationAddress: string,
    refundAddress: string,
    destinationExtraId?: string,
    anonymizationDelaySeconds: number = 0
  ): Promise<SwapOrder> {
    const quote = this.quoteCache.get(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found or expired`);
    }

    if (Date.now() > quote.expiresAt) {
      throw new Error(`Quote has expired. Please request a new quote.`);
    }

    // Validate destination and refund addresses
    if (!AddressValidator.isValid(quote.toAsset.chain, destinationAddress)) {
      throw new Error(`Invalid payout address format for ${quote.toAsset.name}`);
    }
    if (!AddressValidator.isValid(quote.fromAsset.chain, refundAddress)) {
      throw new Error(`Invalid emergency refund address format for ${quote.fromAsset.name}`);
    }

    // Generate single-use deposit address
    const adapter = this.registry.getAdapter(quote.fromAsset.chain);
    const orderId = `swap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const depositInfo = await adapter.generateDepositAddress(orderId);
    const secretToken = `sec_${Math.random().toString(36).substring(2, 16)}`;

    const order: SwapOrder = {
      id: orderId,
      secretToken,
      quote,
      depositAddress: depositInfo.address,
      depositExtraId: depositInfo.extraId,
      depositConfirmations: 0,
      requiredConfirmations: quote.fromAsset.confirmationsRequired,
      destinationAddress,
      destinationExtraId,
      refundAddress,
      hops: [],
      anonymizationDelaySeconds,
      status: 'AWAITING_DEPOSIT',
      statusMessage: SwapStateMachine.getDefaultMessage('AWAITING_DEPOSIT'),
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000, // 1 hour deposit window
      metadataPurged: false
    };

    this.orders.set(orderId, order);
    this.notify(order);
    return order;
  }

  public getOrder(orderId: string): SwapOrder | null {
    return this.orders.get(orderId) || null;
  }

  /**
   * Subscribe to live SSE updates for an order.
   */
  public subscribe(orderId: string, callback: (order: SwapOrder) => void): () => void {
    if (!this.listeners.has(orderId)) {
      this.listeners.set(orderId, new Set());
    }
    this.listeners.get(orderId)!.add(callback);

    return () => {
      this.listeners.get(orderId)?.delete(callback);
    };
  }

  private notify(order: SwapOrder): void {
    const callbacks = this.listeners.get(order.id);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(order); } catch (e) { /* ignore client disconnects */ }
      }
    }
  }

  /**
   * Simulates/Advances an order through the Monero Privacy Hub pipeline.
   * Useful for testing and sandbox execution.
   */
  public async advanceOrderStep(orderId: string): Promise<SwapOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    let updated = { ...order };

    switch (order.status) {
      case 'AWAITING_DEPOSIT': {
        updated = SwapStateMachine.transition(updated, 'DEPOSIT_DETECTED');
        updated.depositConfirmations = 0;
        updated.depositTxHash = `dep_${Math.random().toString(36).substring(2, 12)}`;
        break;
      }
      case 'DEPOSIT_DETECTED': {
        updated = SwapStateMachine.transition(updated, 'DEPOSIT_CONFIRMED');
        updated.depositConfirmations = updated.requiredConfirmations;
        updated.actualDepositAmount = updated.quote.amountIn;
        break;
      }
      case 'DEPOSIT_CONFIRMED': {
        // If starting from XMR, skip Hop 1
        if (updated.quote.fromAsset.id === 'XMR') {
          updated = SwapStateMachine.transition(updated, 'HOP2_CONVERTING_TO_TARGET');
        } else {
          updated = SwapStateMachine.transition(updated, 'HOP1_CONVERTING_TO_XMR');
        }
        break;
      }
      case 'HOP1_CONVERTING_TO_XMR': {
        // Execute Hop 1
        const result = await this.router.executeHop1ToMonero(updated);
        updated.hops.push(result.hopDetails);
        updated = SwapStateMachine.transition(updated, 'XMR_RECEIVED_IN_HUB');
        break;
      }
      case 'XMR_RECEIVED_IN_HUB': {
        if (updated.quote.toAsset.id === 'XMR') {
          // If destination is XMR, payout directly
          updated = SwapStateMachine.transition(updated, 'PAYOUT_BROADCASTING');
        } else if (updated.anonymizationDelaySeconds > 0) {
          updated = SwapStateMachine.transition(updated, 'XMR_ANONYMIZING');
          await this.router.executeMoneroHubChurn(updated.quote.amountIn);
        } else {
          updated = SwapStateMachine.transition(updated, 'HOP2_CONVERTING_TO_TARGET');
        }
        break;
      }
      case 'XMR_ANONYMIZING': {
        updated = SwapStateMachine.transition(updated, 'HOP2_CONVERTING_TO_TARGET');
        break;
      }
      case 'HOP2_CONVERTING_TO_TARGET': {
        // Calculate intermediate XMR amount from hop 1 (or direct input)
        const hop1 = updated.hops.find(h => h.toAsset === 'XMR');
        const xmrAmount = hop1 ? (hop1.outputAmount || 0) : updated.quote.amountIn;

        const result = await this.router.executeHop2FromMonero(updated, xmrAmount);
        updated.hops.push(result.hopDetails);
        updated.actualPayoutAmount = result.payoutAmount;
        updated = SwapStateMachine.transition(updated, 'PAYOUT_BROADCASTING');
        break;
      }
      case 'PAYOUT_BROADCASTING': {
        const payoutAmount = updated.actualPayoutAmount || updated.quote.estimatedAmountOut;
        const payoutResult = await this.router.dispatchPayout(updated, payoutAmount);
        updated.payoutTxHash = payoutResult.txHash;
        updated = SwapStateMachine.transition(updated, 'COMPLETED');
        // Automatically sweep or accumulate fee to external wallet
        await this.feeSweeper.recordFee(updated);
        break;
      }
      default:
        break;
    }

    this.orders.set(orderId, updated);
    this.notify(updated);
    return updated;
  }

  /**
   * Executes a full end-to-end swap simulation sequentially with real-time delays.
   */
  public async simulateFullSwap(orderId: string, stepDelayMs: number = 800): Promise<SwapOrder> {
    let order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    while (order.status !== 'COMPLETED' && order.status !== 'FAILED') {
      await new Promise(r => setTimeout(r, stepDelayMs));
      order = await this.advanceOrderStep(orderId);
    }
    return order;
  }

  /**
   * Zero-KYC Janitor Worker:
   * Permanently scrubs sensitive addresses and hashes once retention expires.
   */
  public runZeroKycJanitor(): number {
    let purgedCount = 0;
    const now = Date.now();
    // Retention window: 10 minutes after completion or 1 hour after expiration for ephemeral safety
    const COMPLETED_PURGE_WINDOW_MS = 10 * 60 * 1000; 

    for (const [id, order] of this.orders.entries()) {
      if (!order.metadataPurged) {
        const isCompletedAndOld = order.completedAt && (now - order.completedAt > COMPLETED_PURGE_WINDOW_MS);
        const isExpired = order.status === 'EXPIRED' || (order.status === 'AWAITING_DEPOSIT' && now > order.expiresAt);

        if (isCompletedAndOld || isExpired) {
          const shredded = SwapStateMachine.shredMetadata(order);
          this.orders.set(id, shredded);
          purgedCount++;
        }
      }
    }
    return purgedCount;
  }
}
