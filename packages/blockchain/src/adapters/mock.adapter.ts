import { Blockchain, AddressValidator } from '@coinswag/core';
import { IBlockchainAdapter, DepositInfo, DetectedDeposit, PayoutResult } from './adapter.interface';

export class GenericChainAdapter implements IBlockchainAdapter {
  public readonly chain: Blockchain;
  public readonly isPrivacyHub: boolean = false;
  private simulatedDeposits: Map<string, DetectedDeposit> = new Map();

  constructor(chain: Blockchain) {
    this.chain = chain;
  }

  public async generateDepositAddress(orderId: string): Promise<DepositInfo> {
    const sample = AddressValidator.getSampleAddress(this.chain);
    const suffix = Math.random().toString(36).substring(2, 6);
    const address = `${sample.substring(0, sample.length - 4)}${suffix}`;
    return {
      address,
      extraId: this.chain === 'ripple' ? `${Math.floor(100000 + Math.random() * 900000)}` : undefined
    };
  }

  public async checkDeposit(address: string, requiredConfirmations: number = 1): Promise<DetectedDeposit | null> {
    return this.simulatedDeposits.get(address) || null;
  }

  public async broadcastPayout(
    destinationAddress: string,
    amount: number,
    assetId: string,
    extraId?: string
  ): Promise<PayoutResult> {
    if (!this.isValidAddress(destinationAddress)) {
      throw new Error(`Invalid payout address for ${this.chain}: ${destinationAddress}`);
    }

    const txHash = `${this.chain}_${Math.random().toString(36).substring(2, 16)}_${Date.now()}`;
    return {
      txHash,
      feePaid: 0.001,
      broadcastAt: Date.now(),
      explorerUrl: `https://blockchair.com/${this.chain}/transaction/${txHash}`
    };
  }

  public async getHotWalletBalance(assetId: string): Promise<number> {
    return 10000.0;
  }

  public isValidAddress(address: string): boolean {
    return AddressValidator.isValid(this.chain, address);
  }

  public injectSimulatedDeposit(address: string, amount: number, confirmations: number = 2): void {
    this.simulatedDeposits.set(address, {
      txHash: `${this.chain}_tx_${Math.random().toString(36).substring(2, 12)}`,
      amount,
      confirmations,
      isConfirmed: true,
      detectedAt: Date.now()
    });
  }
}
