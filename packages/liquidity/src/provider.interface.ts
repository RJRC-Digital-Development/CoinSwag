export interface SwapExecutionResult {
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  amountOut: number;
  executionTxId: string;
  providerName: string;
  executedAt: number;
}

export interface ILiquidityProvider {
  readonly name: string;
  readonly isNoKyc: boolean;

  /**
   * Returns available liquidity depth for an asset.
   */
  getAvailableLiquidity(assetId: string): Promise<number>;

  /**
   * Executes a single conversion hop.
   */
  executeHop(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapExecutionResult>;
}
