import { Blockchain } from '@coinswag/core';
import { IBlockchainAdapter } from './adapters/adapter.interface';
import { MoneroAdapter } from './adapters/monero.adapter';
import { BitcoinAdapter } from './adapters/bitcoin.adapter';
import { EvmAdapter } from './adapters/evm.adapter';
import { SolanaAdapter } from './adapters/solana.adapter';
import { GenericChainAdapter } from './adapters/mock.adapter';
import { RpcFailoverManager } from './services/rpc-failover.service';

export class BlockchainAdapterRegistry {
  private adapters: Map<Blockchain, IBlockchainAdapter> = new Map();
  private failoverManager: RpcFailoverManager;

  constructor(failoverManager?: RpcFailoverManager) {
    this.failoverManager = failoverManager || new RpcFailoverManager();
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const monero = new MoneroAdapter({ isSimulated: true }, this.failoverManager);
    const bitcoin = new BitcoinAdapter();
    const ethereum = new EvmAdapter('ethereum');
    const bsc = new EvmAdapter('bsc');
    const polygon = new EvmAdapter('polygon');
    const solana = new SolanaAdapter();
    const tron = new GenericChainAdapter('tron');
    const ripple = new GenericChainAdapter('ripple');
    const litecoin = new GenericChainAdapter('litecoin');
    const dogecoin = new GenericChainAdapter('dogecoin');

    const avalanche = new EvmAdapter('avalanche');
    const cardano = new GenericChainAdapter('cardano');
    const polkadot = new GenericChainAdapter('polkadot');
    const cosmos = new GenericChainAdapter('cosmos');
    const near = new GenericChainAdapter('near');
    const kaspa = new GenericChainAdapter('kaspa');
    const ton = new GenericChainAdapter('ton');

    this.adapters.set('monero', monero);
    this.adapters.set('bitcoin', bitcoin);
    this.adapters.set('ethereum', ethereum);
    this.adapters.set('bsc', bsc);
    this.adapters.set('polygon', polygon);
    this.adapters.set('avalanche', avalanche);
    this.adapters.set('cardano', cardano);
    this.adapters.set('polkadot', polkadot);
    this.adapters.set('cosmos', cosmos);
    this.adapters.set('near', near);
    this.adapters.set('kaspa', kaspa);
    this.adapters.set('ton', ton);
    this.adapters.set('solana', solana);
    this.adapters.set('tron', tron);
    this.adapters.set('ripple', ripple);
    this.adapters.set('litecoin', litecoin);
    this.adapters.set('dogecoin', dogecoin);
  }

  public getAdapter(chain: Blockchain): IBlockchainAdapter {
    const adapter = this.adapters.get(chain);
    if (!adapter) {
      throw new Error(`No blockchain adapter registered for chain: ${chain}`);
    }
    return adapter;
  }

  public registerAdapter(chain: Blockchain, adapter: IBlockchainAdapter): void {
    this.adapters.set(chain, adapter);
  }

  public getFailoverManager(): RpcFailoverManager {
    return this.failoverManager;
  }
}
