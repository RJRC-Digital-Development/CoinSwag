import assert from 'assert';
import { MempoolEstimatorService } from './services/mempool-estimator.service';

async function runMempoolVerificationSuite() {
  console.log('\n⛽ Starting Dynamic Mempool Gas Estimator Verification Suite...\n');

  const estimator = new MempoolEstimatorService();

  // Test 1: Querying Bitcoin Mempool Recommended Fees
  console.log('▶ Test 1: Fetching Bitcoin Mempool Fee Rates (mempool.space)');
  const btcMempool = await estimator.getBtcMempoolFees();
  assert.ok(btcMempool.fastestFee > 0, 'Fastest fee must be > 0');
  assert.ok(btcMempool.halfHourFee > 0, 'Half-hour fee must be > 0');
  assert.ok(btcMempool.hourFee > 0, 'Hour fee must be > 0');
  assert.ok(btcMempool.halfHourFee <= btcMempool.fastestFee, 'Half-hour fee should be <= fastest fee');
  console.log(`  ✔ Bitcoin Mempool: Fastest: ${btcMempool.fastestFee} sat/vB | HalfHour: ${btcMempool.halfHourFee} sat/vB | Hour: ${btcMempool.hourFee} sat/vB`);

  // Test 2: Estimating Bitcoin SegWit Transaction Fee
  console.log('\n▶ Test 2: Dynamic Bitcoin SegWit Payout Fee Calculation');
  const btcEstimate = await estimator.estimateFee('bitcoin', 92500.0);
  assert.strictEqual(btcEstimate.chain, 'bitcoin');
  assert.ok(btcEstimate.estimatedFeeNative > 0, 'BTC fee native must be > 0');
  assert.ok(btcEstimate.estimatedFeeUsd > 0, 'BTC fee USD must be > 0');
  assert.ok(btcEstimate.satPerVb! > 0);
  console.log(`  ✔ Dynamic Bitcoin Fee: ${btcEstimate.estimatedFeeNative} BTC ($${btcEstimate.estimatedFeeUsd} USD) @ ${btcEstimate.satPerVb} sat/vB`);

  // Test 3: Ethereum / EVM Dynamic Gas Estimation
  console.log('\n▶ Test 3: Ethereum EVM Network Gas Estimation');
  const ethEstimate = await estimator.estimateFee('ethereum', 3450.0);
  assert.strictEqual(ethEstimate.chain, 'ethereum');
  assert.ok(ethEstimate.estimatedFeeNative > 0);
  assert.ok(ethEstimate.gasPriceGwei! > 0);
  console.log(`  ✔ Dynamic Ethereum Fee: ${ethEstimate.estimatedFeeNative} ETH ($${ethEstimate.estimatedFeeUsd} USD) @ ${ethEstimate.gasPriceGwei} Gwei`);

  // Test 4: Monero Privacy Hub RingCT Fee (Ultra-Low Cost)
  console.log('\n▶ Test 4: Monero Privacy Hub RingCT Transaction Fee');
  const xmrEstimate = await estimator.estimateFee('monero', 185.0);
  assert.strictEqual(xmrEstimate.chain, 'monero');
  assert.ok(xmrEstimate.estimatedFeeNative < 0.001, 'Monero fee should be tiny');
  assert.ok(xmrEstimate.estimatedFeeUsd < 0.05, 'Monero fee should be pennies');
  console.log(`  ✔ Monero Hub Fee: ${xmrEstimate.estimatedFeeNative} XMR ($${xmrEstimate.estimatedFeeUsd} USD)`);

  // Test 5: Cache Re-use Verification
  console.log('\n▶ Test 5: Local Memory Cache Hit (Sub-millisecond latency)');
  const start = Date.now();
  const cached = await estimator.getBtcMempoolFees();
  const elapsed = Date.now() - start;
  assert.strictEqual(cached.lastUpdated, btcMempool.lastUpdated, 'Must reuse cached entry');
  assert.ok(elapsed < 20, 'Cached lookup should complete in < 20ms');
  console.log(`  ✔ Cache hit verified in ${elapsed}ms without network roundtrip`);

  console.log('\n🎉 ALL DYNAMIC MEMPOOL GAS ESTIMATOR TESTS PASSED SUCCESSFULLY!\n');
}

runMempoolVerificationSuite().catch(err => {
  console.error('❌ Mempool verification suite failed:', err);
  process.exit(1);
});
