import { Asset } from '../types/asset';
import {
  SplitDestination,
  SplitDestinationRequest,
  SplitFeeBreakdown,
  SplitFeeTier,
  SplitQuote,
  CreateSplitQuoteRequest
} from '../types/split';
import { PriceFeedService } from './price-feed';
import { KeypairGeneratorService } from './keypair-generator';
import { ASSET_MAP } from '../config/assets.config';

// Maximum hold time: 30 days in seconds (30 * 24 * 60 * 60)
export const MAX_HOLD_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds (1 month)

export const SPLIT_FEE_TIERS: SplitFeeTier[] = [
  {
    tierCode: 'TIER_1_UPTO_3',
    tierLabel: 'Up to 3 Addresses',
    minAddresses: 1,
    maxAddresses: 3,
    feePercent: 0.05, // 5%
    isKeygenTier: false
  },
  {
    tierCode: 'TIER_2_UPTO_10',
    tierLabel: '4 to 10 Addresses',
    minAddresses: 4,
    maxAddresses: 10,
    feePercent: 0.10, // 10%
    isKeygenTier: false
  },
  {
    tierCode: 'TIER_3_UPTO_20',
    tierLabel: '11 to 20 Addresses',
    minAddresses: 11,
    maxAddresses: 20,
    feePercent: 0.15, // 15%
    isKeygenTier: false
  },
  {
    tierCode: 'TIER_4_UPTO_50',
    tierLabel: '21 to 50 Addresses',
    minAddresses: 21,
    maxAddresses: 50,
    feePercent: 0.30, // 30%
    isKeygenTier: false
  },
  {
    tierCode: 'TIER_5_KEYGEN_OR_UNLIMITED',
    tierLabel: 'Unlimited Addresses / Private Key Generation',
    minAddresses: 51,
    maxAddresses: Infinity,
    feePercent: 0.33, // 33%
    isKeygenTier: true
  }
];

export class SplitFeeCalculatorService {
  private priceFeed: PriceFeedService;

  constructor(priceFeed?: PriceFeedService) {
    this.priceFeed = priceFeed || new PriceFeedService();
  }

  /**
   * Determine the exact fee tier based on number of addresses and whether keypair generation is active.
   */
  public determineTier(addressCount: number, autoGenerateKeys: boolean = false): SplitFeeTier {
    if (autoGenerateKeys || addressCount > 50) {
      return SPLIT_FEE_TIERS[4]; // 33%
    }
    if (addressCount <= 3) {
      return SPLIT_FEE_TIERS[0]; // 5%
    }
    if (addressCount <= 10) {
      return SPLIT_FEE_TIERS[1]; // 10%
    }
    if (addressCount <= 20) {
      return SPLIT_FEE_TIERS[2]; // 15%
    }
    return SPLIT_FEE_TIERS[3]; // 30%
  }

  /**
   * Validates and normalizes split destination requests.
   */
  public validateRequests(destinations: SplitDestinationRequest[]): void {
    if (!destinations || destinations.length === 0) {
      throw new Error('At least one split destination address is required.');
    }

    let totalPercentage = 0;
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      if (!dest.assetId || !ASSET_MAP[dest.assetId]) {
        throw new Error(`Invalid destination coin selection at index ${i}: ${dest.assetId}`);
      }
      if (dest.percentage <= 0 || dest.percentage > 100) {
        throw new Error(`Destination at index ${i} has invalid percentage: ${dest.percentage}% (must be between 1% and 100%)`);
      }
      totalPercentage += dest.percentage;

      const delay = dest.releaseDelaySeconds || 0;
      if (delay < 0) {
        throw new Error(`Release delay at index ${i} cannot be negative.`);
      }
      if (delay > MAX_HOLD_SECONDS) {
        throw new Error(`Release delay of ${delay}s exceeds maximum hold time of 30 days (${MAX_HOLD_SECONDS}s).`);
      }
    }

    // Allow rounding tolerance (e.g. 99.9% to 100.1%)
    if (Math.abs(totalPercentage - 100) > 0.5) {
      throw new Error(`Split percentages must sum to 100%. Current sum: ${totalPercentage.toFixed(2)}%`);
    }
  }

  /**
   * Generates a complete SplitQuote with calculated fee tier, cross-asset output amounts,
   * time-release schedules, and optional keypair generation.
   */
  public generateSplitQuote(request: CreateSplitQuoteRequest): SplitQuote {
    const fromAsset = ASSET_MAP[request.fromAssetId];
    if (!fromAsset) {
      throw new Error(`Unknown source cryptocurrency: ${request.fromAssetId}`);
    }

    if (request.amountIn < fromAsset.minDeposit) {
      throw new Error(`Deposit amount ${request.amountIn} ${fromAsset.symbol} is below minimum of ${fromAsset.minDeposit}`);
    }
    if (request.amountIn > fromAsset.maxDeposit) {
      throw new Error(`Deposit amount ${request.amountIn} ${fromAsset.symbol} exceeds maximum limit of ${fromAsset.maxDeposit}`);
    }

    this.validateRequests(request.destinations);

    const addressCount = request.destinations.length;
    const autoGenerateKeys = request.autoGenerateKeys ?? false;
    const tier = this.determineTier(addressCount, autoGenerateKeys);

    // Platform service fee in source asset
    const feePercent = tier.feePercent;
    const serviceFeeAmountInFromAsset = request.amountIn * feePercent;
    const fromAssetPriceUsd = this.priceFeed.getPriceUsd(fromAsset.id);
    const serviceFeeUsd = serviceFeeAmountInFromAsset * fromAssetPriceUsd;

    // Net distributable source amount
    const netAmountIn = request.amountIn - serviceFeeAmountInFromAsset;

    const now = Date.now();
    let maxHoldDelay = 0;
    let networkMinerFeesTotalUsd = 0;

    const calculatedDestinations: SplitDestination[] = request.destinations.map((destReq, idx) => {
      const targetAsset = ASSET_MAP[destReq.assetId] || fromAsset;
      const allocRatio = destReq.percentage / 100;
      const allocatedAmountIn = netAmountIn * allocRatio;

      // Cross rate conversion
      const crossRate = this.priceFeed.getCrossRate(fromAsset.id, targetAsset.id);
      const grossOut = allocatedAmountIn * crossRate;

      // Deduct target chain miner/gas fee
      const networkMinerFee = targetAsset.estimatedNetworkFee;
      const targetPriceUsd = this.priceFeed.getPriceUsd(targetAsset.id);
      const networkMinerFeeUsd = networkMinerFee * targetPriceUsd;
      networkMinerFeesTotalUsd += networkMinerFeeUsd;

      let estimatedAmountOut = grossOut - networkMinerFee;
      if (estimatedAmountOut < 0) estimatedAmountOut = 0;

      const delaySeconds = destReq.releaseDelaySeconds || 0;
      if (delaySeconds > maxHoldDelay) {
        maxHoldDelay = delaySeconds;
      }
      const releaseAt = now + delaySeconds * 1000;

      // Auto-generate keypair if requested
      let generatedKeypair = undefined;
      let finalAddress = destReq.address || '';
      if (autoGenerateKeys || destReq.generateKeypair || !finalAddress) {
        generatedKeypair = KeypairGeneratorService.generateKeypair(targetAsset.id);
        finalAddress = generatedKeypair.address;
      }

      const decimals = targetAsset.decimals > 8 ? 8 : targetAsset.decimals;

      return {
        id: `dest_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
        assetId: targetAsset.id,
        targetAsset,
        address: finalAddress,
        extraId: destReq.extraId,
        percentage: destReq.percentage,
        allocatedAmountIn: Number(allocatedAmountIn.toFixed(fromAsset.decimals > 8 ? 8 : fromAsset.decimals)),
        estimatedAmountOut: Number(estimatedAmountOut.toFixed(decimals)),
        networkMinerFee,
        networkMinerFeeUsd,
        releaseDelaySeconds: delaySeconds,
        releaseAt,
        status: delaySeconds > 0 ? 'HOLD_TIME_LOCKED' : 'READY_TO_RELEASE',
        generatedKeypair
      };
    });

    const feeBreakdown: SplitFeeBreakdown = {
      tier,
      feePercent,
      serviceFeeAmountInFromAsset: Number(serviceFeeAmountInFromAsset.toFixed(8)),
      serviceFeeUsd: Number(serviceFeeUsd.toFixed(2)),
      networkMinerFeesTotalUsd: Number(networkMinerFeesTotalUsd.toFixed(2)),
      totalFeeUsd: Number((serviceFeeUsd + networkMinerFeesTotalUsd).toFixed(2))
    };

    const quoteId = `split_quote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      id: quoteId,
      fromAsset,
      amountIn: request.amountIn,
      destinations: calculatedDestinations,
      feeBreakdown,
      autoGenerateKeys,
      maxHoldDelaySeconds: maxHoldDelay,
      validForSeconds: 600, // 10 minutes
      createdAt: now,
      expiresAt: now + 600 * 1000
    };
  }
}
