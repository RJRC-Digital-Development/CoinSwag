import assert from 'node:assert';
import { PriceFeedService, ASSET_MAP, SwapOrder, SwapQuote, FeeBreakdown } from '@coinswag/core';
import { BlockchainAdapterRegistry } from '@coinswag/blockchain';
import { FeeSweeperService } from './fee-sweeper';

async function runFeeSweeperTests() {
  console.log('💰 Starting Fee Sweeper & External Wallet Verification Suite...\n');

  const priceFeed = new PriceFeedService();
  const registry = new BlockchainAdapterRegistry();

  const externalBtcWallet = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
  const externalXmrWallet = '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoogDavup3H';

  // Helper mock order
  const createMockOrder = (fromAssetId: string, toAssetId: string, amountIn: number, feePercent: number): SwapOrder => {
    const fromAsset = ASSET_MAP[fromAssetId];
    const toAsset = ASSET_MAP[toAssetId];
    const feeInFrom = amountIn * feePercent;
    const fromPrice = priceFeed.getPriceUsd(fromAssetId);

    const feeBreakdown: FeeBreakdown = {
      serviceFeePercent: feePercent,
      serviceFeeAmountInFromAsset: feeInFrom,
      serviceFeeAmountInToAsset: feeInFrom * priceFeed.getCrossRate(fromAssetId, toAssetId),
      networkMinerFeeToAsset: toAsset.estimatedNetworkFee,
      networkMinerFeeUsd: toAsset.estimatedNetworkFee * priceFeed.getPriceUsd(toAssetId),
      totalFeeUsd: feeInFrom * fromPrice,
      competitorComparison: {
        coinswagFeePercent: feePercent,
        fixedFloatEquivalent: 0.01,
        aggregatorEquivalent: 0.014,
        estimatedSavingsUsd: 15.0
      }
    };

    const quote: SwapQuote = {
      id: 'quote_test_fee',
      fromAsset,
      toAsset,
      amountIn,
      estimatedAmountOut: (amountIn - feeInFrom) * priceFeed.getCrossRate(fromAssetId, toAssetId),
      rate: priceFeed.getCrossRate(fromAssetId, toAssetId),
      routeType: 'PRIVACY_HUB_DOUBLE',
      hops: [fromAssetId, 'XMR', toAssetId],
      feeBreakdown,
      rateType: 'FLOAT',
      validForSeconds: 300,
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000
    };

    return {
      id: `order_test_${Date.now()}`,
      secretToken: 'sec_test',
      quote,
      depositAddress: 'dep_addr_test',
      depositConfirmations: 1,
      requiredConfirmations: 1,
      destinationAddress: 'dest_addr_test',
      refundAddress: 'refund_addr_test',
      hops: [],
      anonymizationDelaySeconds: 0,
      status: 'COMPLETED',
      statusMessage: 'Completed',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      completedAt: Date.now(),
      metadataPurged: false
    };
  };

  // TEST 1: Real-time external wallet fee sweeping
  console.log('▶ Test 1: Real-time fee sweep directly to external wallet on swap completion');
  const realtimeSweeper = new FeeSweeperService(priceFeed, registry, {
    sweepMode: 'REALTIME',
    recipientWallets: {
      bitcoin: externalBtcWallet,
      monero: externalXmrWallet
    }
  });

  // BTC -> SOL swap of 0.5 BTC (0.75% fee = 0.00375 BTC ~ $346.88 USD)
  const btcOrder = createMockOrder('BTC', 'SOL', 0.5, 0.0075);
  const btcSweep = await realtimeSweeper.recordFee(btcOrder);

  assert(btcSweep !== null, 'Sweep record must be returned in REALTIME mode');
  assert.strictEqual(btcSweep.destinationWallet, externalBtcWallet, 'Must sweep to operator external BTC wallet');
  assert.strictEqual(btcSweep.amount, 0.00375, 'Swept amount must equal fee');
  assert(btcSweep.txHash.startsWith('btc_'), 'Valid outbound broadcast tx generated');
  console.log(`  ✔ Real-time sweep executed: ${btcSweep.amount} BTC ($${btcSweep.amountUsd.toFixed(2)}) sent to ${btcSweep.destinationWallet}`);
  console.log(`  ✔ Outbound Tx: ${btcSweep.txHash}`);

  // TEST 2: Monero Stealth External Wallet Sweeping
  console.log('\n▶ Test 2: Monero stealth fee sweeping');
  const xmrOrder = createMockOrder('XMR', 'ETH', 10.0, 0.0045); // 0.045 XMR fee
  const xmrSweep = await realtimeSweeper.recordFee(xmrOrder);

  assert(xmrSweep !== null);
  assert.strictEqual(xmrSweep.destinationWallet, externalXmrWallet);
  assert(xmrSweep.txHash.startsWith('xmr_'));
  console.log(`  ✔ Monero fee swept directly to private subaddress: ${xmrSweep.destinationWallet}`);

  // TEST 3: Batch Threshold Sweeping
  console.log('\n▶ Test 3: Batch Threshold Sweeping (accumulates to save on-chain miner fees)');
  const batchSweeper = new FeeSweeperService(priceFeed, registry, {
    sweepMode: 'BATCH',
    thresholdUsd: 100.0, // Auto-sweep when buffer reaches $100
    recipientWallets: {
      bitcoin: externalBtcWallet
    }
  });

  // Trade 1: Small trade ($25 fee) -> Should buffer, NOT sweep
  const smallOrder = createMockOrder('BTC', 'ETH', 0.036, 0.0075); // ~ $25 USD
  const sweep1 = await batchSweeper.recordFee(smallOrder);
  assert.strictEqual(sweep1, null, 'Should not sweep yet when below threshold');
  
  let stats = batchSweeper.getStats();
  assert(stats.pendingBufferUsd > 0 && stats.pendingBufferUsd < 100, 'Pending buffer accumulated');
  console.log(`  ✔ Small trade fee buffered ($${stats.pendingBufferUsd.toFixed(2)} / $100 threshold) without triggering on-chain gas`);

  // Trade 2: Larger trade -> Total buffer now > $100 -> Should trigger automatic sweep!
  const largerOrder = createMockOrder('BTC', 'ETH', 0.20, 0.0075); // ~ $118 USD at $79k
  const sweep2 = await batchSweeper.recordFee(largerOrder);

  assert(sweep2 !== null, 'Must trigger automatic sweep when threshold crossed');
  assert.strictEqual(sweep2.destinationWallet, externalBtcWallet);
  assert(sweep2.amountUsd >= 100.0, 'Swept amount exceeds threshold');

  stats = batchSweeper.getStats();
  assert.strictEqual(stats.pendingBufferUsd, 0, 'Buffer must reset after successful sweep');
  assert(stats.totalFeesSweptUsd >= 100.0, 'Total swept updated');
  console.log(`  ✔ Threshold crossed! Automatically swept accumulated buffer ($${sweep2.amountUsd.toFixed(2)}) to external wallet`);
  console.log(`  ✔ Buffer reset to $0.00`);

  // TEST 4: Manual Sweep All
  console.log('\n▶ Test 4: Manual sweep all pending buffers trigger');
  // Buffer another small trade
  await batchSweeper.recordFee(smallOrder);
  assert(batchSweeper.getStats().pendingBufferUsd > 0);
  const manualSweeps = await batchSweeper.sweepAllBuffers();
  assert.strictEqual(manualSweeps.length, 1);
  assert.strictEqual(batchSweeper.getStats().pendingBufferUsd, 0);
  console.log(`  ✔ Manual sweep-all flushed remaining buffer successfully`);

  console.log('\n🎉 ALL FEE SWEEPER & EXTERNAL WALLET TESTS PASSED SUCCESSFULLY!\n');
}

runFeeSweeperTests().catch(err => {
  console.error('❌ Fee sweeper test failed:', err);
  process.exit(1);
});
