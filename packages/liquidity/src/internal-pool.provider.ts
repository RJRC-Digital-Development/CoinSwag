import { PriceFeedService } from '@coinswag/core';
import { ILiquidityProvider, SwapExecutionResult } from './provider.interface';

export class InternalPoolProvider implements ILiquidityProvider {
  public readonly name = 'CoinSwag Internal Reserve Pool';
  public readonly isNoKyc = true;

  private reserves: Map<string, number> = new Map([
    ['XMR', 2500.0],
    ['BTC', 25.0],
    ['ETH', 300.0],
    ['SOL', 3500.0],
    ['USDT-ERC20', 250000.0],
    ['USDT-TRC20', 250000.0],
    ['USDC-ERC20', 250000.0],
    ['USDC-SPL', 250000.0],
    ['BNB', 800.0],
    ['XRP', 100000.0],
    ['LTC', 2000.0],
    ['DOGE', 1500000.0],
    ['AVAX', 2000.0],
    ['ADA', 150000.0],
    ['DOT', 15000.0],
    ['POL', 200000.0],
    ['LINK', 5000.0],
    ['ATOM', 10000.0],
    ['NEAR', 20000.0],
    ['KAS', 500000.0],
    ['TON', 15000.0],
    ['SHIB', 10000000000.0]
  ]);

  private priceFeed: PriceFeedService;

  constructor(priceFeed: PriceFeedService) {
    this.priceFeed = priceFeed;
  }

  public async getAvailableLiquidity(assetId: string): Promise<number> {
    return this.reserves.get(assetId) || 0;
  }

  public async executeHop(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapExecutionResult> {
    const rate = this.priceFeed.getCrossRate(fromAsset, toAsset);
    const amountOut = amountIn * rate;

    const currentToReserve = this.reserves.get(toAsset) || 0;
    if (currentToReserve < amountOut) {
      throw new Error(`Insufficient internal reserve for ${toAsset}. Available: ${currentToReserve}, Required: ${amountOut}`);
    }

    // Update internal balances
    this.reserves.set(fromAsset, (this.reserves.get(fromAsset) || 0) + amountIn);
    this.reserves.set(toAsset, currentToReserve - amountOut);

    return {
      fromAsset,
      toAsset,
      amountIn,
      amountOut,
      executionTxId: `internal_fill_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
      providerName: this.name,
      executedAt: Date.now()
    };
  }
}
