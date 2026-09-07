import assert from 'node:assert';
import { PriceFeedService } from '@coinswag/core';
import { BlockchainAdapterRegistry } from '@coinswag/blockchain';
import { ThorchainProvider } from './thorchain.provider';
import { InternalPoolProvider } from './internal-pool.provider';
import { SwapRouter } from './router';

async function runThorchainTests() {
  console.log('⚡ Starting THORChain Decentralized Cross-Chain Verification Suite...\n');

  const priceFeed = new PriceFeedService();
  const thorchain = new ThorchainProvider(priceFeed);

  // Test 1: Supported Cross-Chain Native Assets
  console.log('▶ Test 1: Supported Cross-Chain Native Assets on THORChain');
  assert(thorchain.supportsAsset('BTC'), 'Native Bitcoin supported');
  assert(thorchain.supportsAsset('ETH'), 'Native Ethereum supported');
  assert(thorchain.supportsAsset('AVAX'), 'Native Avalanche supported');
  assert(thorchain.supportsAsset('BNB'), 'Native BNB supported');
  assert(thorchain.supportsAsset('DOGE'), 'Native Dogecoin supported');
  assert(thorchain.supportsAsset('LTC'), 'Native Litecoin supported');
  assert(thorchain.supportsAsset('ATOM'), 'Native Cosmos supported');
  console.log('  ✔ All native cross-chain assets (BTC, ETH, AVAX, BNB, DOGE, LTC, ATOM) supported');

  // Test 2: Deep Decentralized Pool Liquidity
  console.log('\n▶ Test 2: Checking Decentralized Pool Depth');
  const btcLiquidity = await thorchain.getAvailableLiquidity('BTC');
  assert(btcLiquidity > 50, 'THORChain must offer deep BTC pool depth');
  console.log(`  ✔ THORChain BTC pool available depth: ${btcLiquidity.toFixed(2)} BTC ($5,000,000+ USD)`);

  // Test 3: Decentralized Swap Quote & Slippage Calculation
  console.log('\n▶ Test 3: Fetching Cross-Chain Swap Quote (BTC -> ETH)');
  const quote = await thorchain.getQuote('BTC', 'ETH', 1.0);
  assert(quote.expectedAmountOut > 0, 'Expected amount out must be positive');
  assert(quote.slippageBps <= 50, 'Slippage must be minimal');
  console.log(`  ✔ 1.0 BTC ➔ ${quote.expectedAmountOut.toFixed(4)} ETH (Slippage: ${quote.slippageBps} bps)`);

  // Test 4: Hop Execution
  console.log('\n▶ Test 4: Executing Cross-Chain Conversion Leg via THORChain');
  const execution = await thorchain.executeHop('BTC', 'AVAX', 0.5);
  assert.strictEqual(execution.providerName, thorchain.name);
  assert(execution.executionTxId.startsWith('thorchain_tx_'));
  assert(execution.amountOut > 0);
  console.log(`  ✔ Swap executed via ${execution.providerName}`);
  console.log(`  ✔ Output: ${execution.amountOut.toFixed(4)} AVAX (TxId: ${execution.executionTxId})`);

  console.log('\n🎉 ALL THORCHAIN DECENTRALIZED LIQUIDITY TESTS PASSED SUCCESSFULLY!\n');
}

runThorchainTests().catch(err => {
  console.error('❌ THORChain test failed:', err);
  process.exit(1);
});
