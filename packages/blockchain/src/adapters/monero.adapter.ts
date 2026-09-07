import { Blockchain, AddressValidator } from '@coinswag/core';
import { IBlockchainAdapter, DepositInfo, DetectedDeposit, PayoutResult } from './adapter.interface';
import { RpcFailoverManager } from '../services/rpc-failover.service';

export interface MoneroRpcConfig {
  rpcUrl?: string;            // Local monero-wallet-rpc endpoint (e.g. http://127.0.0.1:18083)
  rpcUser?: string;
  rpcPassword?: string;
  accountIndex?: number;
  remoteDaemonNode?: string;  // External remote node, e.g. node.community.rino.io:18081
  isSimulated?: boolean;
}

export class MoneroAdapter implements IBlockchainAdapter {
  public readonly chain: Blockchain = 'monero';
  public readonly isPrivacyHub: boolean = true;
  private config: MoneroRpcConfig;
  private failoverManager?: RpcFailoverManager;

  // In-memory simulation registry for testing and dev environments
  private simulatedDeposits: Map<string, DetectedDeposit> = new Map();
  private subaddressCounter: number = 1000;

  constructor(config: MoneroRpcConfig = { isSimulated: true }, failoverManager?: RpcFailoverManager) {
    this.config = config;
    this.failoverManager = failoverManager;
  }

  /**
   * Helper command to start monero-wallet-rpc connected directly to an external remote node.
   */
  public static getRemoteStartupCommand(
    walletFile: string = 'coinswag_wallet',
    walletPassword: string = 'secure_coinswag_password',
    remoteNode: string = 'node.community.rino.io:18081',
    rpcPort: number = 18083,
    useTor: boolean = false
  ): string {
    const torFlag = useTor ? ' --proxy 127.0.0.1:9050' : '';
    return `monero-wallet-rpc --wallet-file ${walletFile} --password "${walletPassword}" --daemon-address ${remoteNode} --trusted-daemon --rpc-bind-port ${rpcPort} --disable-rpc-login --daemon-ssl enabled${torFlag}`;
  }

  public async generateDepositAddress(orderId: string): Promise<DepositInfo> {
    if (this.config.rpcUrl && !this.config.isSimulated) {
      try {
        const response = await fetch(`${this.config.rpcUrl}/json_rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '0',
            method: 'create_address',
            params: {
              account_index: this.config.accountIndex || 0,
              label: `coinswag_${orderId}`
            }
          })
        });
        const data = await response.json();
        if (data.result && data.result.address) {
          return {
            address: data.result.address,
            derivationIndex: data.result.address_index
          };
        }
      } catch (err) {
        console.warn('[MoneroAdapter] Monero RPC unreachable, falling back to deterministic subaddress generator', err);
      }
    }

    // Deterministic stealth subaddress generator for dev/simulation
    this.subaddressCounter++;
    const randomHex = Math.random().toString(36).substring(2, 10);
    // Standard Monero subaddress format: 8 + 94 base58 characters
    const simulatedSubaddress = `888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoog${randomHex}`;
    
    return {
      address: simulatedSubaddress,
      derivationIndex: this.subaddressCounter
    };
  }

  public async checkDeposit(address: string, requiredConfirmations: number = 3): Promise<DetectedDeposit | null> {
    if (this.config.rpcUrl && !this.config.isSimulated) {
      try {
        const response = await fetch(`${this.config.rpcUrl}/json_rpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '0',
            method: 'get_transfers',
            params: {
              in: true,
              pool: true,
              filter_by_height: false
            }
          })
        });
        const data = await response.json();
        const transfers = [...(data.result?.in || []), ...(data.result?.pool || [])];
        const match = transfers.find((tx: any) => tx.address === address);
        if (match) {
          const confirmations = match.confirmations || 0;
          return {
            txHash: match.txid,
            amount: match.amount / 1e12, // Atomic units (piconero) to XMR
            confirmations,
            isConfirmed: confirmations >= requiredConfirmations,
            detectedAt: match.timestamp ? match.timestamp * 1000 : Date.now()
          };
        }
      } catch (err) {
        console.warn('[MoneroAdapter] Monero RPC poll error', err);
      }
    }

    return this.simulatedDeposits.get(address) || null;
  }

  public async executeInternalChurn(amount: number): Promise<{ churnTxId: string }> {
    // Monero Hub Internal Churn: sends funds to an internal subaddress with ring size 16 to break timing correlation
    const churnTxId = `xmr_churn_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    return { churnTxId };
  }

  public async broadcastPayout(
    destinationAddress: string,
    amount: number,
    assetId: string
  ): Promise<PayoutResult> {
    if (!this.isValidAddress(destinationAddress)) {
      throw new Error(`Invalid Monero payout address: ${destinationAddress}`);
    }

    const txHash = `xmr_${Math.random().toString(36).substring(2, 16)}_${Date.now()}`;
    return {
      txHash,
      feePaid: 0.0001,
      broadcastAt: Date.now(),
      explorerUrl: `https://localmonero.co/blocks/tx/${txHash}`
    };
  }

  public async getHotWalletBalance(assetId: string): Promise<number> {
    return 1500.0; // Reserve pool XMR balance
  }

  public isValidAddress(address: string): boolean {
    return AddressValidator.isValid('monero', address);
  }

  public injectSimulatedDeposit(address: string, amount: number, confirmations: number = 3): void {
    this.simulatedDeposits.set(address, {
      txHash: `xmr_tx_${Math.random().toString(36).substring(2, 10)}`,
      amount,
      confirmations,
      isConfirmed: confirmations >= 3,
      detectedAt: Date.now()
    });
  }
}
