import { SplitOrder, SplitDestination } from '@coinswag/core';
import { BlockchainAdapterRegistry, MoneroAdapter } from '@coinswag/blockchain';
import { ILiquidityProvider, SwapExecutionResult } from './provider.interface';

export class SplitRouter {
  private providers: ILiquidityProvider[];
  private blockchainRegistry: BlockchainAdapterRegistry;

  constructor(
    blockchainRegistry: BlockchainAdapterRegistry,
    providers: ILiquidityProvider[]
  ) {
    this.blockchainRegistry = blockchainRegistry;
    this.providers = providers;
  }

  /**
   * Converts incoming deposit to Monero (XMR) Zero-Knowledge Privacy Hub.
   */
  public async executeHop1ToMonero(order: SplitOrder): Promise<{
    xmrAmount: number;
    executionTxId: string;
  }> {
    const fromAssetId = order.quote.fromAsset.id;
    const netDepositAmount = (order.actualDepositAmount || order.quote.amountIn) - order.quote.feeBreakdown.serviceFeeAmountInFromAsset;

    if (fromAssetId === 'XMR') {
      return {
        xmrAmount: netDepositAmount,
        executionTxId: `xmr_hub_direct_${Date.now()}`
      };
    }

    const execution = await this.routeConversion(fromAssetId, 'XMR', netDepositAmount);
    return {
      xmrAmount: execution.amountOut,
      executionTxId: execution.executionTxId
    };
  }

  /**
   * Performs Monero ring confidential churn to decouple input graph.
   */
  public async executeMoneroHubChurn(xmrAmount: number): Promise<{ churnTxId: string }> {
    const moneroAdapter = this.blockchainRegistry.getAdapter('monero') as MoneroAdapter;
    return await moneroAdapter.executeInternalChurn(xmrAmount);
  }

  /**
   * Converts allocated Monero share and broadcasts outbound payout to a specific split destination.
   */
  public async dispatchSplitLeg(dest: SplitDestination): Promise<{
    txHash: string;
    explorerUrl: string;
    actualAmountOut: number;
  }> {
    const targetAsset = dest.targetAsset;
    const adapter = this.blockchainRegistry.getAdapter(targetAsset.chain);

    const result = await adapter.broadcastPayout(
      dest.address,
      dest.estimatedAmountOut,
      dest.assetId,
      dest.extraId
    );

    return {
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      actualAmountOut: dest.estimatedAmountOut
    };
  }

  /**
   * Route cross-currency conversion across active liquidity providers.
   */
  private async routeConversion(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapExecutionResult> {
    for (const provider of this.providers) {
      const available = await provider.getAvailableLiquidity(toAsset);
      if (available > 0) {
        try {
          return await provider.executeHop(fromAsset, toAsset, amountIn);
        } catch (err) {
          console.warn(`Provider ${provider.name} failed execution, trying next...`, err);
        }
      }
    }

    throw new Error(`No available liquidity provider could execute swap from ${fromAsset} to ${toAsset}`);
  }
}
