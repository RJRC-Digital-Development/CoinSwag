import {
  SwapOrder,
  SwapQuote,
  SwapStatus,
  SwapStateMachine,
  FeeCalculatorService,
  PriceFeedService,
  ASSET_MAP,
  AddressValidator,
  SplitOrder,
  SplitQuote,
  SplitDestination,
  CreateSplitQuoteRequest,
  SplitFeeCalculatorService,
  KeypairGeneratorService,
  MemoryScrubber
} from '@coinswag/core';
import { BlockchainAdapterRegistry, FinancialCircuitBreaker } from '@coinswag/blockchain';
import {
  SwapRouter,
  SplitRouter,
  InternalPoolProvider,
  SimulatorProvider,
  ExternalBridgeProvider,
  ThorchainProvider,
  FeeSweeperService
} from '@coinswag/liquidity';
import { TimeReleaseManager } from './time-release.manager';
import { TimingSafeEqual } from '../security/timing-safe';
import crypto from 'node:crypto';

export class OrderManager {
  private orders: Map<string, SwapOrder> = new Map();
  private quoteCache: Map<string, SwapQuote> = new Map();

  // Split & Time-Release Storage
  private splitOrders: Map<string, SplitOrder> = new Map();
  private splitQuoteCache: Map<string, SplitQuote> = new Map();

  private priceFeed: PriceFeedService;
  private feeCalculator: FeeCalculatorService;
  private splitCalculator: SplitFeeCalculatorService;
  private registry: BlockchainAdapterRegistry;
  private router: SwapRouter;
  private splitRouter: SplitRouter;
  private feeSweeper: FeeSweeperService;
  private timeReleaseManager: TimeReleaseManager;
  private circuitBreaker: FinancialCircuitBreaker;

  private listeners: Map<string, Set<(order: SwapOrder) => void>> = new Map();
  private splitListeners: Map<string, Set<(order: SplitOrder) => void>> = new Map();

  constructor() {
    this.priceFeed = new PriceFeedService();
    this.feeCalculator = new FeeCalculatorService(this.priceFeed);
    this.splitCalculator = new SplitFeeCalculatorService(this.priceFeed);
    this.registry = new BlockchainAdapterRegistry();
    this.circuitBreaker = new FinancialCircuitBreaker();

    const internalPool = new InternalPoolProvider(this.priceFeed);
    const thorchain = new ThorchainProvider(this.priceFeed);
    const bridge = new ExternalBridgeProvider(this.priceFeed);
    const simulator = new SimulatorProvider(this.priceFeed);

    const providers = [internalPool, thorchain, bridge, simulator];
    this.router = new SwapRouter(this.registry, providers);
    this.splitRouter = new SplitRouter(this.registry, providers);
    this.feeSweeper = new FeeSweeperService(this.priceFeed, this.registry);

    this.timeReleaseManager = new TimeReleaseManager(this.splitRouter, (updatedSplit) => {
      this.splitOrders.set(updatedSplit.id, updatedSplit);
      this.notifySplit(updatedSplit);
    });

    // Launch background janitor (runs every 60 seconds)
    const janitorTimer = setInterval(() => this.runZeroKycJanitor(), 60000);
    if (janitorTimer.unref) janitorTimer.unref();
  }

  public getPriceFeed(): PriceFeedService {
    return this.priceFeed;
  }

  public getFeeCalculator(): FeeCalculatorService {
    return this.feeCalculator;
  }

  public getSplitCalculator(): SplitFeeCalculatorService {
    return this.splitCalculator;
  }

  public getRegistry(): BlockchainAdapterRegistry {
    return this.registry;
  }

  public getFeeSweeper(): FeeSweeperService {
    return this.feeSweeper;
  }

  public getTimeReleaseManager(): TimeReleaseManager {
    return this.timeReleaseManager;
  }

  public getCircuitBreaker(): FinancialCircuitBreaker {
    return this.circuitBreaker;
  }

  // ============================================================================
  // Single Swap Orders
  // ============================================================================

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

    if (!AddressValidator.isValid(quote.toAsset.chain, destinationAddress)) {
      throw new Error(`Invalid payout address format for ${quote.toAsset.name}`);
    }
    if (!AddressValidator.isValid(quote.fromAsset.chain, refundAddress)) {
      throw new Error(`Invalid emergency refund address format for ${quote.fromAsset.name}`);
    }

    const adapter = this.registry.getAdapter(quote.fromAsset.chain);
    const orderId = `swap_${crypto.randomUUID()}`;
    const depositInfo = await adapter.generateDepositAddress(orderId);
    const secretToken = `sec_${crypto.randomBytes(32).toString('base64url')}`;

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
      expiresAt: Date.now() + 3600 * 1000,
      metadataPurged: false
    };

    this.orders.set(orderId, order);
    this.notify(order);
    return order;
  }

  public getOrder(orderId: string): SwapOrder | null {
    return this.orders.get(orderId) || null;
  }

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
        if (updated.quote.fromAsset.id === 'XMR') {
          updated = SwapStateMachine.transition(updated, 'HOP2_CONVERTING_TO_TARGET');
        } else {
          updated = SwapStateMachine.transition(updated, 'HOP1_CONVERTING_TO_XMR');
        }
        break;
      }
      case 'HOP1_CONVERTING_TO_XMR': {
        const result = await this.router.executeHop1ToMonero(updated);
        updated.hops.push(result.hopDetails);
        updated = SwapStateMachine.transition(updated, 'XMR_RECEIVED_IN_HUB');
        break;
      }
      case 'XMR_RECEIVED_IN_HUB': {
        if (updated.quote.toAsset.id === 'XMR') {
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
        const toAsset = updated.quote.toAsset;
        const assetPrice = this.priceFeed.getPriceUsd(toAsset.id);
        const usdValue = payoutAmount * assetPrice;

        // Sentinel: Evaluate velocity limit & hot wallet drain circuit breaker
        this.circuitBreaker.authorizeOutflow(toAsset.id, payoutAmount, usdValue, updated.destinationAddress);

        try {
          const payoutResult = await this.router.dispatchPayout(updated, payoutAmount);
          updated.payoutTxHash = payoutResult.txHash;
          updated = SwapStateMachine.transition(updated, 'COMPLETED');
          await this.feeSweeper.recordFee(updated);
        } catch (err: any) {
          this.circuitBreaker.recordBroadcastFailure(err.message);
          throw err;
        }
        break;
      }
      default:
        break;
    }

    this.orders.set(orderId, updated);
    this.notify(updated);
    return updated;
  }

  public async simulateFullSwap(orderId: string, stepDelayMs: number = 800): Promise<SwapOrder> {
    let order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    while (order.status !== 'COMPLETED' && order.status !== 'FAILED') {
      await new Promise(r => setTimeout(r, stepDelayMs));
      order = await this.advanceOrderStep(orderId);
    }
    return order;
  }

  // ============================================================================
  // Split & Time-Release Orders
  // ============================================================================

  public createSplitQuote(request: CreateSplitQuoteRequest): SplitQuote {
    const quote = this.splitCalculator.generateSplitQuote(request);
    this.splitQuoteCache.set(quote.id, quote);
    return quote;
  }

  public async createSplitOrder(
    quoteId: string,
    refundAddress: string
  ): Promise<SplitOrder> {
    const quote = this.splitQuoteCache.get(quoteId);
    if (!quote) {
      throw new Error(`Split quote ${quoteId} not found or expired`);
    }

    if (Date.now() > quote.expiresAt) {
      throw new Error(`Split quote has expired. Please request a new quote.`);
    }

    if (!AddressValidator.isValid(quote.fromAsset.chain, refundAddress)) {
      throw new Error(`Invalid emergency refund address format for ${quote.fromAsset.name}`);
    }

    // Validate destination addresses
    for (let i = 0; i < quote.destinations.length; i++) {
      const dest = quote.destinations[i];
      if (!AddressValidator.isValid(dest.targetAsset.chain, dest.address)) {
        throw new Error(`Invalid destination address for ${dest.targetAsset.name}: ${dest.address}`);
      }
    }

    const adapter = this.registry.getAdapter(quote.fromAsset.chain);
    const orderId = `split_${crypto.randomUUID()}`;
    const depositInfo = await adapter.generateDepositAddress(orderId);
    const secretToken = `sec_${crypto.randomBytes(32).toString('base64url')}`;

    const order: SplitOrder = {
      id: orderId,
      secretToken,
      quote,
      depositAddress: depositInfo.address,
      depositExtraId: depositInfo.extraId,
      depositConfirmations: 0,
      requiredConfirmations: quote.fromAsset.confirmationsRequired,
      refundAddress,
      destinations: quote.destinations,
      status: 'AWAITING_DEPOSIT',
      statusMessage: 'Awaiting deposit from user to initiate address split and time-release vault.',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600 * 1000,
      autoGenerateKeys: quote.autoGenerateKeys,
      keyVaultExported: false,
      metadataPurged: false
    };

    this.splitOrders.set(orderId, order);
    this.timeReleaseManager.registerOrder(order);
    this.notifySplit(order);
    return order;
  }

  public getSplitOrder(orderId: string): SplitOrder | null {
    return this.splitOrders.get(orderId) || null;
  }

  public subscribeSplit(orderId: string, callback: (order: SplitOrder) => void): () => void {
    if (!this.splitListeners.has(orderId)) {
      this.splitListeners.set(orderId, new Set());
    }
    this.splitListeners.get(orderId)!.add(callback);

    return () => {
      this.splitListeners.get(orderId)?.delete(callback);
    };
  }

  private notifySplit(order: SplitOrder): void {
    const callbacks = this.splitListeners.get(order.id);
    if (callbacks) {
      for (const cb of callbacks) {
        try { cb(order); } catch (e) { /* ignore client disconnects */ }
      }
    }
  }

  public downloadOrderKeys(orderId: string, secretToken: string, vaultPassphrase?: string): any {
    const order = this.splitOrders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (!TimingSafeEqual.compare(order.secretToken, secretToken)) {
      throw new Error('Unauthorized: Invalid secret order token');
    }

    const keypairs = order.destinations
      .filter(d => d.generatedKeypair)
      .map(d => d.generatedKeypair!);

    if (keypairs.length === 0) {
      throw new Error('No generated private keys found for this order (manual addresses were supplied).');
    }

    order.keyVaultExported = true;
    if (vaultPassphrase) {
      return KeypairGeneratorService.formatEncryptedKeyVaultExport(order.id, order.secretToken, keypairs, vaultPassphrase);
    }
    return KeypairGeneratorService.formatKeyVaultExport(order.id, order.secretToken, keypairs);
  }

  public async advanceSplitOrderStep(orderId: string): Promise<SplitOrder> {
    const order = this.splitOrders.get(orderId);
    if (!order) throw new Error(`Split order ${orderId} not found`);

    switch (order.status) {
      case 'AWAITING_DEPOSIT':
        order.status = 'DEPOSIT_DETECTED';
        order.depositTxHash = `dep_split_${Math.random().toString(36).substring(2, 10)}`;
        order.statusMessage = 'Deposit detected in mempool; awaiting block confirmations.';
        break;

      case 'DEPOSIT_DETECTED':
        order.status = 'DEPOSIT_CONFIRMED';
        order.depositConfirmations = order.requiredConfirmations;
        order.actualDepositAmount = order.quote.amountIn;
        order.statusMessage = 'Deposit confirmed. Ingesting into Monero Zero-Knowledge Privacy Hub.';
        break;

      case 'DEPOSIT_CONFIRMED': {
        order.status = 'CONVERTING_IN_PRIVACY_HUB';
        await this.splitRouter.executeHop1ToMonero(order);
        await this.splitRouter.executeMoneroHubChurn(order.quote.amountIn);
        
        // Move to time-lock vault
        order.status = 'TIME_LOCK_HOLDING';
        order.statusMessage = 'Anonymized in Monero Hub. Split tranches secured in Time-Lock Vault.';
        
        // Immediately release 0-delay destinations
        await this.timeReleaseManager.processMaturedReleases();
        break;
      }

      case 'TIME_LOCK_HOLDING':
      case 'PARTIALLY_RELEASED':
        await this.timeReleaseManager.processMaturedReleases();
        break;

      default:
        break;
    }

    this.splitOrders.set(orderId, order);
    this.notifySplit(order);
    return order;
  }

  // ============================================================================
  // Zero-KYC Janitor Data Shredder
  // ============================================================================

  public runZeroKycJanitor(): number {
    let purgedCount = 0;
    const now = Date.now();
    const COMPLETED_PURGE_WINDOW_MS = 10 * 60 * 1000; 

    // Shred single-swap orders
    for (const [id, order] of this.orders.entries()) {
      if (!order.metadataPurged) {
        const isCompletedAndOld = order.completedAt && (now - order.completedAt > COMPLETED_PURGE_WINDOW_MS);
        const isExpired = order.status === 'EXPIRED' || (order.status === 'AWAITING_DEPOSIT' && now > order.expiresAt);

        if (isCompletedAndOld || isExpired) {
          if (order.destinationAddress) MemoryScrubber.scrubSensitiveString(order.destinationAddress);
          if (order.refundAddress) MemoryScrubber.scrubSensitiveString(order.refundAddress);
          if (order.depositAddress) MemoryScrubber.scrubSensitiveString(order.depositAddress);
          const shredded = SwapStateMachine.shredMetadata(order);
          this.orders.set(id, shredded);
          purgedCount++;
        }
      }
    }

    // Shred completed split orders
    for (const [id, splitOrder] of this.splitOrders.entries()) {
      if (!splitOrder.metadataPurged) {
        const allReleased = splitOrder.destinations.every(d => d.status === 'RELEASED');
        const isCompletedAndOld = splitOrder.completedAt && allReleased && (now - splitOrder.completedAt > COMPLETED_PURGE_WINDOW_MS);
        const isExpired = splitOrder.status === 'EXPIRED' || (splitOrder.status === 'AWAITING_DEPOSIT' && now > splitOrder.expiresAt);

        if (isCompletedAndOld || isExpired) {
          splitOrder.metadataPurged = true;
          splitOrder.purgedAt = now;

          // Perform 3-pass DoD zeroization on memory
          if (splitOrder.depositAddress) MemoryScrubber.scrubSensitiveString(splitOrder.depositAddress);
          if (splitOrder.refundAddress) MemoryScrubber.scrubSensitiveString(splitOrder.refundAddress);
          if (splitOrder.secretToken) MemoryScrubber.scrubSensitiveString(splitOrder.secretToken);

          splitOrder.depositAddress = 'SHREDDED_ZERO_KYC';
          splitOrder.refundAddress = 'SHREDDED_ZERO_KYC';
          splitOrder.secretToken = 'SHREDDED_ZERO_KYC';

          splitOrder.destinations.forEach(d => {
            if (d.address) MemoryScrubber.scrubSensitiveString(d.address);
            d.address = 'SHREDDED_ZERO_KYC';
            if (d.generatedKeypair) {
              if (d.generatedKeypair.privateKey) MemoryScrubber.scrubSensitiveString(d.generatedKeypair.privateKey);
              if (d.generatedKeypair.mnemonic) MemoryScrubber.scrubSensitiveString(d.generatedKeypair.mnemonic);
              if (d.generatedKeypair.address) MemoryScrubber.scrubSensitiveString(d.generatedKeypair.address);
              MemoryScrubber.scrubObject(d.generatedKeypair);
              d.generatedKeypair.privateKey = 'SHREDDED_ZERO_KYC';
              d.generatedKeypair.mnemonic = 'SHREDDED_ZERO_KYC';
              d.generatedKeypair.address = 'SHREDDED_ZERO_KYC';
            }
          });
          purgedCount++;
        }
      }
    }

    return purgedCount;
  }
}
