export interface PriceTicker {
  assetId: string;
  priceUsd: number;
  lastUpdated: number;
}

// Baseline reference market prices (updated periodically or fetched from CoinGecko / Binance)
export const DEFAULT_PRICES_USD: Record<string, number> = {
  'BTC': 92500.0,
  'BTC_LN': 92500.0,
  'ETH': 3450.0,
  'XMR': 185.0,
  'SOL': 210.0,
  'USDT-ERC20': 1.0,
  'USDT-TRC20': 1.0,
  'USDC-ERC20': 1.0,
  'USDC-SPL': 1.0,
  'BNB': 680.0,
  'XRP': 2.45,
  'LTC': 125.0,
  'DOGE': 0.38,
  'AVAX': 34.50,
  'ADA': 0.85,
  'DOT': 7.80,
  'POL': 0.52,
  'LINK': 19.50,
  'ATOM': 6.75,
  'NEAR': 5.80,
  'KAS': 0.16,
  'TON': 5.40,
  'SHIB': 0.000024
};

export class PriceFeedService {
  private prices: Map<string, number> = new Map();

  constructor(initialPrices?: Record<string, number>) {
    const seed = initialPrices || DEFAULT_PRICES_USD;
    for (const [asset, price] of Object.entries(seed)) {
      this.prices.set(asset, price);
    }
  }

  public getPriceUsd(assetId: string): number {
    const price = this.prices.get(assetId);
    if (!price) {
      // Fallback for stablecoins or throw
      if (assetId.startsWith('USDT') || assetId.startsWith('USDC')) return 1.0;
      throw new Error(`Price unavailable for asset: ${assetId}`);
    }
    return price;
  }

  public getCrossRate(fromAssetId: string, toAssetId: string): number {
    const fromPrice = this.getPriceUsd(fromAssetId);
    const toPrice = this.getPriceUsd(toAssetId);
    if (toPrice <= 0) throw new Error(`Invalid destination price for ${toAssetId}`);
    return fromPrice / toPrice;
  }

  public updatePrice(assetId: string, priceUsd: number): void {
    if (priceUsd <= 0) throw new Error(`Price must be greater than 0`);
    this.prices.set(assetId, priceUsd);
  }

  public getAllPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of this.prices.entries()) {
      result[k] = v;
    }
    return result;
  }
}
