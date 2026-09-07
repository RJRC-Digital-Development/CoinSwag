import { Asset } from './asset';

export type SwapRouteType = 
  | 'DIRECT_MONERO_OUT'   // Coin A -> XMR
  | 'DIRECT_MONERO_IN'    // XMR -> Coin B
  | 'PRIVACY_HUB_DOUBLE'  // Coin A -> XMR -> Coin B
  | 'DIRECT_XMR_INTERNAL';// XMR -> XMR (Anonymizer/churn)

export interface FeeBreakdown {
  serviceFeePercent: number;        // e.g. 0.0075 for 0.75% or 0.0045 for 0.45%
  serviceFeeAmountInFromAsset: number;
  serviceFeeAmountInToAsset: number;
  networkMinerFeeToAsset: number;   // Gas / miner fee to broadcast target asset
  networkMinerFeeUsd: number;
  totalFeeUsd: number;
  competitorComparison: {
    coinswagFeePercent: number;     // e.g. 0.75%
    fixedFloatEquivalent: number;   // e.g. 1.00%
    aggregatorEquivalent: number;   // e.g. 1.40%
    estimatedSavingsUsd: number;    // User savings in USD
  };
}

export interface SwapQuote {
  id: string;
  fromAsset: Asset;
  toAsset: Asset;
  amountIn: number;
  estimatedAmountOut: number;
  guaranteedAmountOut?: number;     // For fixed rate mode
  rate: number;                     // 1 fromAsset = X toAsset
  routeType: SwapRouteType;
  hops: string[];                   // e.g. ["BTC", "XMR", "ETH"]
  feeBreakdown: FeeBreakdown;
  rateType: 'FLOAT' | 'FIXED';
  validForSeconds: number;
  createdAt: number;
  expiresAt: number;
}

export interface QuoteRequest {
  fromAssetId: string;
  toAssetId: string;
  amountIn: number;
  rateType?: 'FLOAT' | 'FIXED';
}
