import { PriceFeedService } from '@coinswag/core';
import { ILiquidityProvider, SwapExecutionResult } from './provider.interface';

export class SimulatorProvider implements ILiquidityProvider {
  public readonly name = 'CoinSwag Testnet Simulator';
  public readonly isNoKyc = true;

  private priceFeed: PriceFeedService;

  constructor(priceFeed: PriceFeedService) {
    this.priceFeed = priceFeed;
  }

  public async getAvailableLiquidity(assetId: string): Promise<number> {
    return 9999999.0;
  }

  public async executeHop(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapExecutionResult> {
    const rate = this.priceFeed.getCrossRate(fromAsset, toAsset);
    const amountOut = amountIn * rate;

    return {
      fromAsset,
      toAsset,
      amountIn,
      amountOut,
      executionTxId: `sim_${Math.random().toString(36).substring(2, 12)}`,
      providerName: this.name,
      executedAt: Date.now()
    };
  }
}
