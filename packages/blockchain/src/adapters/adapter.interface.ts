import { Blockchain } from '@coinswag/core';

export interface DepositInfo {
  address: string;
  extraId?: string;       // Memo / Destination Tag
  derivationIndex?: number;
}

export interface DetectedDeposit {
  txHash: string;
  amount: number;
  confirmations: number;
  isConfirmed: boolean;
  detectedAt: number;
}

export interface PayoutResult {
  txHash: string;
  feePaid: number;
  broadcastAt: number;
  explorerUrl: string;
}

export interface IBlockchainAdapter {
  readonly chain: Blockchain;
  readonly isPrivacyHub: boolean;

  /**
   * Generates a single-use unique deposit address or subaddress for the given order.
   */
  generateDepositAddress(orderId: string): Promise<DepositInfo>;

  /**
   * Checks for incoming deposits matching the address.
   */
  checkDeposit(address: string, requiredConfirmations: number): Promise<DetectedDeposit | null>;

  /**
   * Signs and broadcasts outbound transaction to deliver swapped funds to recipient.
   */
  broadcastPayout(
    destinationAddress: string,
    amount: number,
    assetId: string,
    extraId?: string
  ): Promise<PayoutResult>;

  /**
   * Queries hot-wallet balance for operational monitoring.
   */
  getHotWalletBalance(assetId: string): Promise<number>;

  /**
   * Validates address format.
   */
  isValidAddress(address: string): boolean;
}
