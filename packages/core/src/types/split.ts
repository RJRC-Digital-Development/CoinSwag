import { Asset } from './asset';

export interface GeneratedKeypair {
  assetId: string;
  chain: string;
  address: string;
  privateKey: string;
  publicKey?: string;
  mnemonic?: string;
  derivationPath?: string;
  note?: string;
  createdAt: number;
}

export type SplitLegStatus =
  | 'PENDING_DEPOSIT'
  | 'HOLD_TIME_LOCKED'
  | 'READY_TO_RELEASE'
  | 'BROADCASTING'
  | 'RELEASED'
  | 'FAILED';

export interface SplitDestinationRequest {
  assetId: string;
  address?: string;
  extraId?: string;
  percentage: number;            // 0 - 100
  releaseDelaySeconds?: number;  // 0 to 2,592,000 (30 days max)
  generateKeypair?: boolean;
}

export interface SplitDestination {
  id: string;
  assetId: string;
  targetAsset: Asset;
  address: string;
  extraId?: string;
  percentage: number;
  allocatedAmountIn: number;     // Portion of source deposit
  estimatedAmountOut: number;    // Payout after cross-rate and miner fee
  networkMinerFee: number;
  networkMinerFeeUsd: number;
  releaseDelaySeconds: number;
  releaseAt: number;             // Timestamp when time-lock matures
  status: SplitLegStatus;
  payoutTxHash?: string;
  releasedAt?: number;
  generatedKeypair?: GeneratedKeypair;
}

export interface SplitFeeTier {
  tierCode: 'TIER_1_UPTO_3' | 'TIER_2_UPTO_10' | 'TIER_3_UPTO_20' | 'TIER_4_UPTO_50' | 'TIER_5_KEYGEN_OR_UNLIMITED';
  tierLabel: string;
  minAddresses: number;
  maxAddresses: number;
  feePercent: number;           // 0.05, 0.10, 0.15, 0.30, 0.33
  isKeygenTier: boolean;
}

export interface SplitFeeBreakdown {
  tier: SplitFeeTier;
  feePercent: number;
  serviceFeeAmountInFromAsset: number;
  serviceFeeUsd: number;
  networkMinerFeesTotalUsd: number;
  totalFeeUsd: number;
}

export interface SplitQuote {
  id: string;
  fromAsset: Asset;
  amountIn: number;
  destinations: SplitDestination[];
  feeBreakdown: SplitFeeBreakdown;
  autoGenerateKeys: boolean;
  maxHoldDelaySeconds: number;
  validForSeconds: number;
  createdAt: number;
  expiresAt: number;
}

export type SplitOrderStatus =
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_DETECTED'
  | 'DEPOSIT_CONFIRMED'
  | 'CONVERTING_IN_PRIVACY_HUB'
  | 'TIME_LOCK_HOLDING'
  | 'PARTIALLY_RELEASED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'FAILED';

export interface SplitOrder {
  id: string;
  secretToken: string;
  quote: SplitQuote;
  
  // Deposit details
  depositAddress: string;
  depositExtraId?: string;
  depositConfirmations: number;
  requiredConfirmations: number;
  actualDepositAmount?: number;
  depositTxHash?: string;

  // Refund details
  refundAddress: string;
  refundTxHash?: string;

  // Split destinations with individual time-release state
  destinations: SplitDestination[];

  // Order State
  status: SplitOrderStatus;
  statusMessage: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;

  // Privacy & Zero-KYC Key Vault
  autoGenerateKeys: boolean;
  keyVaultExported: boolean;
  metadataPurged: boolean;
  purgedAt?: number;
}

export interface CreateSplitQuoteRequest {
  fromAssetId: string;
  amountIn: number;
  destinations: SplitDestinationRequest[];
  autoGenerateKeys?: boolean;
}

export interface CreateSplitOrderRequest {
  quoteId: string;
  refundAddress: string;
  destinations?: SplitDestinationRequest[]; // Optional override if user fills in addresses
}
