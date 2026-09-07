import { Blockchain } from '@coinswag/core';

export interface ChainRpcConfig {
  chain: Blockchain;
  endpoints: string[];
  timeoutMs: number;
  maxRetries: number;
  useTor?: boolean;
}

export const DEFAULT_RPC_CONFIG: Record<Blockchain, ChainRpcConfig> = {
  monero: {
    chain: 'monero',
    // Trusted external Monero remote nodes (No local monerod blockchain sync required!)
    endpoints: (process.env.XMR_REMOTE_NODES?.split(',')) || [
      'https://node.community.rino.io:18081',
      'https://nodes.hashvault.pro:18081',
      'https://xmr-node.cakewallet.com:18081',
      'https://node.moneroworld.com:18089'
    ],
    timeoutMs: 8000,
    maxRetries: 3,
    useTor: process.env.XMR_USE_TOR === 'true'
  },
  bitcoin: {
    chain: 'bitcoin',
    // External Bitcoin Mempool / Blockstream REST APIs
    endpoints: (process.env.BTC_RPC_URLS?.split(',')) || [
      'https://mempool.space/api',
      'https://blockstream.info/api',
      'https://btc.nownodes.io'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  ethereum: {
    chain: 'ethereum',
    // Fast external EVM RPC endpoints
    endpoints: (process.env.ETH_RPC_URLS?.split(',')) || [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://cloudflare-eth.com',
      'https://ethereum.publicnode.com'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  solana: {
    chain: 'solana',
    // External Solana RPC endpoints
    endpoints: (process.env.SOL_RPC_URLS?.split(',')) || [
      'https://api.mainnet-beta.solana.com',
      'https://solana-mainnet.rpc.extrnode.com',
      'https://rpc.ankr.com/solana'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  bsc: {
    chain: 'bsc',
    endpoints: (process.env.BSC_RPC_URLS?.split(',')) || [
      'https://binance.llamarpc.com',
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.defibit.io'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  polygon: {
    chain: 'polygon',
    endpoints: (process.env.POLYGON_RPC_URLS?.split(',')) || [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  litecoin: {
    chain: 'litecoin',
    endpoints: (process.env.LTC_RPC_URLS?.split(',')) || [
      'https://litecoinspace.org/api',
      'https://ltc.nownodes.io'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  dogecoin: {
    chain: 'dogecoin',
    endpoints: (process.env.DOGE_RPC_URLS?.split(',')) || [
      'https://dogechain.info/api/v1',
      'https://doge.nownodes.io'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  tron: {
    chain: 'tron',
    endpoints: (process.env.TRON_RPC_URLS?.split(',')) || [
      'https://api.trongrid.io',
      'https://api.tronstack.io'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  ripple: {
    chain: 'ripple',
    endpoints: (process.env.XRP_RPC_URLS?.split(',')) || [
      'https://s1.ripple.com:51234',
      'https://xrplcluster.com'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  avalanche: {
    chain: 'avalanche',
    endpoints: (process.env.AVAX_RPC_URLS?.split(',')) || [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.public-rpc.com',
      'https://rpc.ankr.com/avalanche'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  cardano: {
    chain: 'cardano',
    endpoints: (process.env.ADA_RPC_URLS?.split(',')) || [
      'https://api.koios.rest/api/v1',
      'https://cardano-mainnet.blockfrost.io/api/v0'
    ],
    timeoutMs: 8000,
    maxRetries: 3
  },
  polkadot: {
    chain: 'polkadot',
    endpoints: (process.env.DOT_RPC_URLS?.split(',')) || [
      'https://rpc.polkadot.io',
      'https://polkadot.public.curie.radiumblock.co/http'
    ],
    timeoutMs: 8000,
    maxRetries: 3
  },
  cosmos: {
    chain: 'cosmos',
    endpoints: (process.env.ATOM_RPC_URLS?.split(',')) || [
      'https://cosmos-rpc.publicnode.com',
      'https://rpc-cosmoshub.keplr.app'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  near: {
    chain: 'near',
    endpoints: (process.env.NEAR_RPC_URLS?.split(',')) || [
      'https://rpc.mainnet.near.org',
      'https://near.blockpi.network/v1/rpc/public'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  kaspa: {
    chain: 'kaspa',
    endpoints: (process.env.KAS_RPC_URLS?.split(',')) || [
      'https://api.kaspa.org'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  ton: {
    chain: 'ton',
    endpoints: (process.env.TON_RPC_URLS?.split(',')) || [
      'https://toncenter.com/api/v2/jsonRPC'
    ],
    timeoutMs: 6000,
    maxRetries: 3
  },
  lightning: {
    chain: 'lightning',
    endpoints: (process.env.LIGHTNING_RPC_URLS?.split(',')) || [
      'https://legend.lnbits.com/api/v1',
      'https://api.getalby.com'
    ],
    timeoutMs: 5000,
    maxRetries: 3
  }
};
