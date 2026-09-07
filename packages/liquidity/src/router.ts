import { SwapOrder, SwapHopDetails } from '@coinswag/core';
import { BlockchainAdapterRegistry, MoneroAdapter } from '@coinswag/blockchain';
import { ILiquidityProvider, SwapExecutionResult } from './provider.interface';
import { InternalPoolProvider } from './internal-pool.provider';
import { ExternalBridgeProvider } from './external-bridge.provider';
import { SimulatorProvider } from './simulator.provider';

export class SwapRouter {
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
   * Execute Hop 1: Converts incoming Coin A to Monero (XMR).
   */
  public async executeHop1ToMonero(order: SwapOrder): Promise<{
    hopDetails: SwapHopDetails;
    xmrAmount: number;
  }> {
    const fromAssetId = order.quote.fromAsset.id;
    const netDepositAmount = (order.actualDepositAmount || order.quote.amountIn) - order.quote.feeBreakdown.serviceFeeAmountInFromAsset;

    // Execute conversion to XMR
    const execution = await this.routeConversion(fromAssetId, 'XMR', netDepositAmount);

    const hopDetails: SwapHopDetails = {
      hopIndex: 1,
      fromAsset: fromAssetId,
      toAsset: 'XMR',
      status: 'SETTLED',
      inputAmount: netDepositAmount,
      outputAmount: execution.amountOut,
      executionTxId: execution.executionTxId,
      executedAt: execution.executedAt
    };

    return {
      hopDetails,
      xmrAmount: execution.amountOut
    };
  }

  /**
   * Monero Hub Anonymization Phase:
   * Executes internal subaddress churn and RingCT shuffling.
   */
  public async executeMoneroHubChurn(xmrAmount: number): Promise<{ churnTxId: string }> {
    const moneroAdapter = this.blockchainRegistry.getAdapter('monero') as MoneroAdapter;
    return await moneroAdapter.executeInternalChurn(xmrAmount);
  }

  /**
   * Execute Hop 2: Converts Monero (XMR) to destination token Coin B.
   */
  public async executeHop2FromMonero(
    order: SwapOrder,
    xmrInputAmount: number
  ): Promise<{
    hopDetails: SwapHopDetails;
    payoutAmount: number;
  }> {
    const toAssetId = order.quote.toAsset.id;

    // Execute conversion from XMR to target coin
    const execution = await this.routeConversion('XMR', toAssetId, xmrInputAmount);

    // Deduct network miner fee from final output
    const netPayoutAmount = Math.max(0, execution.amountOut - order.quote.feeBreakdown.networkMinerFeeToAsset);

    const hopDetails: SwapHopDetails = {
      hopIndex: 2,
      fromAsset: 'XMR',
      toAsset: toAssetId,
      status: 'SETTLED',
      inputAmount: xmrInputAmount,
      outputAmount: netPayoutAmount,
      executionTxId: execution.executionTxId,
      executedAt: execution.executedAt
    };

    return {
      hopDetails,
      payoutAmount: netPayoutAmount
    };
  }

  /**
   * Dispatches outbound transaction across the native blockchain adapter.
   */
  public async dispatchPayout(order: SwapOrder, payoutAmount: number): Promise<{
    txHash: string;
    explorerUrl: string;
  }> {
    const toAsset = order.quote.toAsset;
    const adapter = this.blockchainRegistry.getAdapter(toAsset.chain);

    const result = await adapter.broadcastPayout(
      order.destinationAddress,
      payoutAmount,
      toAsset.id,
      order.destinationExtraId
    );

    return {
      txHash: result.txHash,
      explorerUrl: result.explorerUrl
    };
  }

  /**
   * Finds the best liquidity provider with sufficient depth and executes.
   */
  private async routeConversion(
    fromAsset: string,
    toAsset: string,
    amountIn: number
  ): Promise<SwapExecutionResult> {
    for (const provider of this.providers) {
      const available = await provider.getAvailableLiquidity(toAsset);
      // If provider has sufficient depth, execute
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
