import { Asset } from '../types/asset';
import { FeeBreakdown, SwapQuote, SwapRouteType } from '../types/quote';
import { PriceFeedService } from './price-feed';

export interface FeeConfig {
  singleHopRate: number;      // Default: 0.0045 (0.45%)
  doubleHopRate: number;      // Default: 0.0075 (0.75%)
  fixedRateBuffer: number;    // Default: 0.0035 (0.35% volatility hedge)
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  singleHopRate: 0.0045,      // 0.45%
  doubleHopRate: 0.0075,      // 0.75%
  fixedRateBuffer: 0.0035     // 0.35%
};

export class FeeCalculatorService {
  private config: FeeConfig;
  private priceFeed: PriceFeedService;

  constructor(priceFeed: PriceFeedService, customConfig?: Partial<FeeConfig>) {
    this.priceFeed = priceFeed;
    this.config = { ...DEFAULT_FEE_CONFIG, ...customConfig };
  }

  /**
   * Determine routing type based on whether Monero is source, destination, or intermediary.
   */
  public determineRouteType(fromAssetId: string, toAssetId: string): SwapRouteType {
    if (fromAssetId === 'XMR' && toAssetId === 'XMR') {
      return 'DIRECT_XMR_INTERNAL';
    }
    if (fromAssetId === 'XMR') {
      return 'DIRECT_MONERO_IN';
    }
    if (toAssetId === 'XMR') {
      return 'DIRECT_MONERO_OUT';
    }
    return 'PRIVACY_HUB_DOUBLE';
  }

  /**
   * Returns intermediate hops.
   * CoinSwag core rule: Everything must filter through Monero unless it starts or ends with Monero.
   */
  public getHops(fromAssetId: string, toAssetId: string): string[] {
    const routeType = this.determineRouteType(fromAssetId, toAssetId);
    switch (routeType) {
      case 'DIRECT_MONERO_IN':
        return [fromAssetId, toAssetId];
      case 'DIRECT_MONERO_OUT':
        return [fromAssetId, toAssetId];
      case 'DIRECT_XMR_INTERNAL':
        return ['XMR', 'XMR'];
      case 'PRIVACY_HUB_DOUBLE':
      default:
        return [fromAssetId, 'XMR', toAssetId];
    }
  }

  /**
   * Calculate competitive fee breakdown and competitor savings.
   */
  public calculateFeeBreakdown(
    fromAsset: Asset,
    toAsset: Asset,
    amountIn: number,
    rateType: 'FLOAT' | 'FIXED' = 'FLOAT'
  ): FeeBreakdown {
    const routeType = this.determineRouteType(fromAsset.id, toAsset.id);
    const isDoubleHop = routeType === 'PRIVACY_HUB_DOUBLE';
    
    // Base platform fee percentage
    let feePercent = isDoubleHop ? this.config.doubleHopRate : this.config.singleHopRate;
    if (rateType === 'FIXED') {
      feePercent += this.config.fixedRateBuffer;
    }

    // Platform service fee in source asset
    const serviceFeeAmountInFromAsset = amountIn * feePercent;

    // Output destination asset value of the fee
    const crossRate = this.priceFeed.getCrossRate(fromAsset.id, toAsset.id);
    const serviceFeeAmountInToAsset = serviceFeeAmountInFromAsset * crossRate;

    // Outbound network miner fee paid in destination native asset
    const networkMinerFeeToAsset = toAsset.estimatedNetworkFee;
    const toAssetPriceUsd = this.priceFeed.getPriceUsd(toAsset.id);
    const fromAssetPriceUsd = this.priceFeed.getPriceUsd(fromAsset.id);
    
    const networkMinerFeeUsd = networkMinerFeeToAsset * toAssetPriceUsd;
    const serviceFeeUsd = serviceFeeAmountInFromAsset * fromAssetPriceUsd;
    const totalFeeUsd = serviceFeeUsd + networkMinerFeeUsd;

    // Competitor comparison calculations
    // FixedFloat charges 0.5% (float) or 1.0% (fixed)
    const fixedFloatEquivalent = rateType === 'FIXED' ? 0.010 : 0.0050;
    // Aggregator multi-hop privacy (e.g. Houdini/Trocador 2-hop) averages ~1.40%
    const aggregatorEquivalent = isDoubleHop ? 0.0140 : 0.0090;

    const competitorFeePercent = isDoubleHop ? aggregatorEquivalent : fixedFloatEquivalent;
    const competitorFeeUsd = (amountIn * fromAssetPriceUsd) * competitorFeePercent;
    const estimatedSavingsUsd = Math.max(0, competitorFeeUsd - serviceFeeUsd);

    return {
      serviceFeePercent: feePercent,
      serviceFeeAmountInFromAsset,
      serviceFeeAmountInToAsset,
      networkMinerFeeToAsset,
      networkMinerFeeUsd,
      totalFeeUsd,
      competitorComparison: {
        coinswagFeePercent: feePercent,
        fixedFloatEquivalent,
        aggregatorEquivalent,
        estimatedSavingsUsd
      }
    };
  }

  /**
   * Generates a complete swap quote.
   */
  public generateQuote(
    fromAsset: Asset,
    toAsset: Asset,
    amountIn: number,
    rateType: 'FLOAT' | 'FIXED' = 'FLOAT'
  ): SwapQuote {
    if (amountIn < fromAsset.minDeposit) {
      throw new Error(`Amount ${amountIn} is below minimum deposit of ${fromAsset.minDeposit} ${fromAsset.symbol}`);
    }
    if (amountIn > fromAsset.maxDeposit) {
      throw new Error(`Amount ${amountIn} exceeds maximum swap limit of ${fromAsset.maxDeposit} ${fromAsset.symbol}`);
    }

    const routeType = this.determineRouteType(fromAsset.id, toAsset.id);
    const hops = this.getHops(fromAsset.id, toAsset.id);
    const feeBreakdown = this.calculateFeeBreakdown(fromAsset, toAsset, amountIn, rateType);

    const grossRate = this.priceFeed.getCrossRate(fromAsset.id, toAsset.id);
    
    // Net amount = (amountIn - serviceFeeInFrom) * grossRate - networkMinerFee
    const netAmountIn = amountIn - feeBreakdown.serviceFeeAmountInFromAsset;
    let estimatedAmountOut = (netAmountIn * grossRate) - feeBreakdown.networkMinerFeeToAsset;
    if (estimatedAmountOut < 0) estimatedAmountOut = 0;

    const effectiveRate = amountIn > 0 ? estimatedAmountOut / amountIn : 0;
    const now = Date.now();
    const validForSeconds = rateType === 'FIXED' ? 600 : 300; // 10 min for fixed, 5 min for float

    return {
      id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      fromAsset,
      toAsset,
      amountIn,
      estimatedAmountOut: Number(estimatedAmountOut.toFixed(toAsset.decimals > 8 ? 8 : toAsset.decimals)),
      guaranteedAmountOut: rateType === 'FIXED' ? Number(estimatedAmountOut.toFixed(toAsset.decimals > 8 ? 8 : toAsset.decimals)) : undefined,
      rate: Number(effectiveRate.toFixed(8)),
      routeType,
      hops,
      feeBreakdown,
      rateType,
      validForSeconds,
      createdAt: now,
      expiresAt: now + validForSeconds * 1000
    };
  }
}
