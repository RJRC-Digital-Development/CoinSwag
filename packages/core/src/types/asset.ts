export type Blockchain =
  | 'bitcoin'
  | 'ethereum'
  | 'monero'
  | 'solana'
  | 'bsc'
  | 'ripple'
  | 'litecoin'
  | 'dogecoin'
  | 'tron'
  | 'polygon'
  | 'avalanche'
  | 'cardano'
  | 'polkadot'
  | 'cosmos'
  | 'near'
  | 'kaspa'
  | 'ton';

export type TokenStandard = 'native' | 'erc20' | 'spl' | 'bep20' | 'trc20';

export interface Asset {
  id: string;                      // e.g. "BTC", "ETH", "XMR", "USDT-ERC20", "USDT-TRC20"
  symbol: string;                  // e.g. "USDT"
  name: string;                    // e.g. "Tether USD (ERC20)"
  chain: Blockchain;               // e.g. "ethereum"
  standard: TokenStandard;         // e.g. "erc20"
  decimals: number;                // e.g. 6 or 18
  contractAddress?: string;        // for tokens
  minDeposit: number;              // Minimum acceptable deposit amount
  maxDeposit: number;              // Maximum swap limit per session
  networkFeeAsset: string;         // Asset used to pay gas/network fee
  estimatedNetworkFee: number;     // Approximate static base fee in native asset
  confirmationsRequired: number;   // Confirmations required before execution
  isPrivacyHub: boolean;           // True only for XMR
  icon: string;                    // SVG / URL or identifier
  explorerTxUrl: string;           // Formatter: (txHash: string) => string
  explorerAddressUrl: string;      // Formatter: (address: string) => string
}

export interface NetworkStatus {
  chain: Blockchain;
  online: boolean;
  currentBlockHeight: number;
  averageBlockTimeSec: number;
  estimatedFeeGweiOrSats: number;
}
