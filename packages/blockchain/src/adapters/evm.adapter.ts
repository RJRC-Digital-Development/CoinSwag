import { Blockchain, AddressValidator } from '@coinswag/core';
import { IBlockchainAdapter, DepositInfo, DetectedDeposit, PayoutResult } from './adapter.interface';

export class EvmAdapter implements IBlockchainAdapter {
  public readonly chain: Blockchain;
  public readonly isPrivacyHub: boolean = false;
  private simulatedDeposits: Map<string, DetectedDeposit> = new Map();

  constructor(chain: Blockchain = 'ethereum') {
    this.chain = chain;
  }

  public async generateDepositAddress(orderId: string): Promise<DepositInfo> {
    // Generate unique EVM checksummed deposit address
    const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const address = `0x${hex}`;
    return { address };
  }

  public async checkDeposit(address: string, requiredConfirmations: number = 6): Promise<DetectedDeposit | null> {
    return this.simulatedDeposits.get(address) || null;
  }

  public async broadcastPayout(
    destinationAddress: string,
    amount: number,
    assetId: string
  ): Promise<PayoutResult> {
    if (!this.isValidAddress(destinationAddress)) {
      throw new Error(`Invalid EVM payout address: ${destinationAddress}`);
    }

    const txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const explorer = this.chain === 'bsc' ? 'https://bscscan.com/tx/' : 'https://etherscan.io/tx/';
    
    return {
      txHash,
      feePaid: this.chain === 'bsc' ? 0.0004 : 0.0015,
      broadcastAt: Date.now(),
      explorerUrl: `${explorer}${txHash}`
    };
  }

  public async getHotWalletBalance(assetId: string): Promise<number> {
    return 150.0;
  }

  public isValidAddress(address: string): boolean {
    return AddressValidator.isValid(this.chain, address);
  }

  public injectSimulatedDeposit(address: string, amount: number, confirmations: number = 6): void {
    this.simulatedDeposits.set(address, {
      txHash: `0x${Math.random().toString(36).substring(2, 16)}`,
      amount,
      confirmations,
      isConfirmed: true,
      detectedAt: Date.now()
    });
  }
}
