import { Blockchain, AddressValidator } from '@coinswag/core';
import { IBlockchainAdapter, DepositInfo, DetectedDeposit, PayoutResult } from './adapter.interface';

export class SolanaAdapter implements IBlockchainAdapter {
  public readonly chain: Blockchain = 'solana';
  public readonly isPrivacyHub: boolean = false;
  private simulatedDeposits: Map<string, DetectedDeposit> = new Map();

  public async generateDepositAddress(orderId: string): Promise<DepositInfo> {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = '';
    for (let i = 0; i < 44; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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
      throw new Error(`Invalid Solana payout address: ${destinationAddress}`);
    }

    const txHash = `sol_${Math.random().toString(36).substring(2, 16)}_${Date.now()}`;
    return {
      txHash,
      feePaid: 0.0005,
      broadcastAt: Date.now(),
      explorerUrl: `https://solscan.io/tx/${txHash}`
    };
  }

  public async getHotWalletBalance(assetId: string): Promise<number> {
    return 1200.0;
  }

  public isValidAddress(address: string): boolean {
    return AddressValidator.isValid('solana', address);
  }

  public injectSimulatedDeposit(address: string, amount: number, confirmations: number = 1): void {
    this.simulatedDeposits.set(address, {
      txHash: `sol_tx_${Math.random().toString(36).substring(2, 12)}`,
      amount,
      confirmations,
      isConfirmed: true,
      detectedAt: Date.now()
    });
  }
}
