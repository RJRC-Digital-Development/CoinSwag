import { Asset } from './asset';
import { SwapQuote } from './quote';

export type SwapStatus =
  | 'AWAITING_DEPOSIT'
  | 'DEPOSIT_DETECTED'
  | 'DEPOSIT_CONFIRMED'
  | 'HOP1_CONVERTING_TO_XMR'
  | 'XMR_RECEIVED_IN_HUB'
  | 'XMR_ANONYMIZING'
  | 'HOP2_CONVERTING_TO_TARGET'
  | 'PAYOUT_BROADCASTING'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED';

export interface SwapHopDetails {
  hopIndex: number;
  fromAsset: string;
  toAsset: string;
  status: 'PENDING' | 'EXECUTING' | 'SETTLED' | 'SKIPPED';
  inputAmount?: number;
  outputAmount?: number;
  executionTxId?: string;
  executedAt?: number;
}

export interface SwapOrder {
  id: string;                     // UUID v4
  secretToken: string;            // Ephemeral client authorization token to query or refund
  quote: SwapQuote;
  
  // Deposit details
  depositAddress: string;
  depositExtraId?: string;        // Memo / Destination Tag (e.g. for XRP)
  actualDepositAmount?: number;
  depositTxHash?: string;
  depositConfirmations: number;
  requiredConfirmations: number;

  // Payout details
  destinationAddress: string;
  destinationExtraId?: string;
  payoutTxHash?: string;
  actualPayoutAmount?: number;

  // Refund details
  refundAddress: string;
  refundTxHash?: string;

  // Privacy Hub Routing Details
  hops: SwapHopDetails[];
  anonymizationDelaySeconds: number; // Optional anti-timing correlation delay (0 = instant)
  anonymizationStartedAt?: number;

  // State & Timestamps
  status: SwapStatus;
  statusMessage: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
  
  // Zero-KYC Data Shredder Tracking
  metadataPurged: boolean;
  purgedAt?: number;
}

export interface CreateOrderRequest {
  quoteId: string;
  destinationAddress: string;
  destinationExtraId?: string;
  refundAddress: string;
  anonymizationDelaySeconds?: number;
}
