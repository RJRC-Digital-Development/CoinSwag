export interface PriceTicker {
  assetId: string;
  priceUsd: number;
  lastUpdated: number;
}

// Current live baseline reference market prices (updated dynamically via CoinGecko / Coinbase / Kraken)
export const DEFAULT_PRICES_USD: Record<string, number> = {
  'BTC': 79300.0,
  'BTC_LN': 79300.0,
  'ETH': 2495.0,
  'XMR': 519.0,
  'SOL': 104.0,
  'USDT-ERC20': 1.0,
  'USDT-TRC20': 1.0,
  'USDC-ERC20': 1.0,
  'USDC-SPL': 1.0,
  'BNB': 740.0,
  'XRP': 1.40,
  'LTC': 55.60,
  'DOGE': 0.091,
  'AVAX': 8.15,
  'ADA': 0.22,
  'DOT': 1.07,
  'POL': 0.35,
  'LINK': 12.80,
  'ATOM': 1.64,
  'NEAR': 2.36,
  'KAS': 0.037,
  'TON': 1.40,
  'SHIB': 0.0000055
};

export class PriceFeedService {
  private prices: Map<string, number> = new Map();
  private pollInterval?: any;

  constructor(initialPrices?: Record<string, number>, autoPoll: boolean = true) {
    const seed = initialPrices || DEFAULT_PRICES_USD;
    for (const [asset, price] of Object.entries(seed)) {
      this.prices.set(asset, price);
    }

    if (autoPoll && typeof fetch === 'function') {
      // Fire immediate asynchronous live price update
      this.fetchLivePrices().catch(() => {});

      // Poll every 30 seconds for real-time market accuracy
      if (typeof setInterval === 'function') {
        this.pollInterval = setInterval(() => {
          this.fetchLivePrices().catch(() => {});
        }, 30000);
        if (this.pollInterval.unref) {
          this.pollInterval.unref(); // Do not block Node process exit in tests
        }
      }
    }
  }

  public getPriceUsd(assetId: string): number {
    const price = this.prices.get(assetId);
    if (!price) {
      if (assetId === 'BTC_LN') return this.getPriceUsd('BTC');
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
    if (assetId === 'BTC') {
      this.prices.set('BTC_LN', priceUsd);
    }
  }

  public getAllPrices(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of this.prices.entries()) {
      result[k] = v;
    }
    return result;
  }

  /**
   * Fetches real-time market prices from decentralized/public price oracles (CoinPaprika, CoinGecko & Coinbase).
   */
  public async fetchLivePrices(): Promise<boolean> {
    // 1. Primary Oracle: CoinPaprika (High-availability, rate-limit resilient)
    try {
      const paprikaRes = await fetch('https://api.coinpaprika.com/v1/tickers?quotes=USD', {
        headers: { 'Accept': 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
      });
      if (paprikaRes.ok) {
        const tickers: any = await paprikaRes.json();
        const paprikaMap: Record<string, string> = {
          'btc-bitcoin': 'BTC',
          'eth-ethereum': 'ETH',
          'xmr-monero': 'XMR',
          'sol-solana': 'SOL',
          'bnb-binance-coin': 'BNB',
          'xrp-xrp': 'XRP',
          'ltc-litecoin': 'LTC',
          'doge-dogecoin': 'DOGE',
          'avax-avalanche': 'AVAX',
          'ada-cardano': 'ADA',
          'dot-polkadot-token': 'DOT',
          'pol-polygon-ecosystem-token': 'POL',
          'link-chainlink': 'LINK',
          'atom-cosmos': 'ATOM',
          'near-near-protocol': 'NEAR',
          'kas-kaspa': 'KAS',
          'ton-tontoken': 'TON',
          'shib-shiba-inu': 'SHIB'
        };

        for (const t of tickers) {
          const mapped = paprikaMap[t.id];
          if (mapped && t.quotes?.USD?.price) {
            this.prices.set(mapped, t.quotes.USD.price);
            if (mapped === 'BTC') {
              this.prices.set('BTC_LN', t.quotes.USD.price);
            }
          }
        }
        return true;
      }
    } catch {
      // Fall through to CoinGecko
    }

    // 2. Secondary Oracle: CoinGecko
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,monero,solana,litecoin,dogecoin,ripple,cardano,polkadot,cosmos,near,kaspa,the-open-network,shiba-inu,binancecoin,avalanche-2,chainlink,polygon-ecosystem-token&vs_currencies=usd',
        {
          headers: { 'Accept': 'application/json' },
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
        }
      );

      if (res.ok) {
        const data: any = await res.json();
        if (data.bitcoin?.usd) {
          this.prices.set('BTC', data.bitcoin.usd);
          this.prices.set('BTC_LN', data.bitcoin.usd);
        }
        if (data.ethereum?.usd) this.prices.set('ETH', data.ethereum.usd);
        if (data.monero?.usd) this.prices.set('XMR', data.monero.usd);
        if (data.solana?.usd) this.prices.set('SOL', data.solana.usd);
        if (data.litecoin?.usd) this.prices.set('LTC', data.litecoin.usd);
        if (data.dogecoin?.usd) this.prices.set('DOGE', data.dogecoin.usd);
        if (data.ripple?.usd) this.prices.set('XRP', data.ripple.usd);
        if (data.cardano?.usd) this.prices.set('ADA', data.cardano.usd);
        if (data.polkadot?.usd) this.prices.set('DOT', data.polkadot.usd);
        if (data['polygon-ecosystem-token']?.usd) this.prices.set('POL', data['polygon-ecosystem-token'].usd);
        if (data.cosmos?.usd) this.prices.set('ATOM', data.cosmos.usd);
        if (data.near?.usd) this.prices.set('NEAR', data.near.usd);
        if (data.kaspa?.usd) this.prices.set('KAS', data.kaspa.usd);
        if (data['the-open-network']?.usd) this.prices.set('TON', data['the-open-network'].usd);
        if (data['shiba-inu']?.usd) this.prices.set('SHIB', data['shiba-inu'].usd);
        if (data.binancecoin?.usd) this.prices.set('BNB', data.binancecoin.usd);
        if (data['avalanche-2']?.usd) this.prices.set('AVAX', data['avalanche-2'].usd);
        if (data.chainlink?.usd) this.prices.set('LINK', data.chainlink.usd);
        return true;
      }
    } catch {
      // 3. Fallback to Coinbase public spot price for Bitcoin & Ethereum
      try {
        const cbRes = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
        if (cbRes.ok) {
          const cbData: any = await cbRes.json();
          const btcPrice = parseFloat(cbData.data?.amount);
          if (btcPrice > 0) {
            this.prices.set('BTC', btcPrice);
            this.prices.set('BTC_LN', btcPrice);
          }
        }
      } catch {
        // Retain current prices
      }
    }
    return false;
  }
}
