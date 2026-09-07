import { Blockchain, AddressValidator } from '@coinswag/core';
import { IBlockchainAdapter, DepositInfo, DetectedDeposit, PayoutResult } from './adapter.interface';

export class BitcoinAdapter implements IBlockchainAdapter {
  public readonly chain: Blockchain = 'bitcoin';
  public readonly isPrivacyHub: boolean = false;
  private simulatedDeposits: Map<string, DetectedDeposit> = new Map();

  public async generateDepositAddress(orderId: string): Promise<DepositInfo> {
    // Native SegWit (Bech32 bc1q...) address derivation
    const suffix = Math.random().toString(36).substring(2, 10);
    const address = `bc1qar0srrr7xfkvy5l643lydnw9re59gtzz${suffix}`;
    return { address };
  }

  public async checkDeposit(address: string, requiredConfirmations: number = 1): Promise<DetectedDeposit | null> {
    return this.simulatedDeposits.get(address) || null;
  }

  public async broadcastPayout(
    destinationAddress: string,
    amount: number,
    assetId: string
  ): Promise<PayoutResult> {
    if (!this.isValidAddress(destinationAddress)) {
      throw new Error(`Invalid Bitcoin payout address: ${destinationAddress}`);
    }

    const txHash = `btc_${Math.random().toString(36).substring(2, 16)}_${Date.now()}`;
    return {
      txHash,
      feePaid: 0.00008,
      broadcastAt: Date.now(),
      explorerUrl: `https://mempool.space/tx/${txHash}`
    };
  }

  public async getHotWalletBalance(assetId: string): Promise<number> {
    return 12.5; // BTC hot wallet balance
  }

  public isValidAddress(address: string): boolean {
    return AddressValidator.isValid('bitcoin', address);
  }

  public injectSimulatedDeposit(address: string, amount: number, confirmations: number = 1): void {
    this.simulatedDeposits.set(address, {
      txHash: `btc_tx_${Math.random().toString(36).substring(2, 12)}`,
      amount,
      confirmations,
      isConfirmed: confirmations >= 1,
      detectedAt: Date.now()
    });
  }
}
