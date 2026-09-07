import { 
  FeeCalculatorService, 
  PriceFeedService, 
  ASSET_MAP, 
  AddressValidator 
} from '@coinswag/core';
import { LightningAdapter } from './adapters/lightning.adapter';
import { BlockchainAdapterRegistry } from './registry';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function runLightningTests() {
  console.log('⚡ Running Bitcoin Lightning Network Integration Tests...\n');

  // Test 1: AddressValidator for Lightning
  console.log('Test 1: AddressValidator Lightning Formats');
  const sampleBolt11 = AddressValidator.getSampleAddress('lightning');
  assert(AddressValidator.isValid('lightning', sampleBolt11), 'Sample BOLT11 invoice is valid');
  assert(AddressValidator.isValid('lightning', 'lnbc100u1pn8zzzpp5000000000000000000000000000000000000000000000000000000000000'), 'BOLT11 mainnet invoice is valid');
  assert(AddressValidator.isValid('lightning', 'lntb100u1pn8zzzpp5000000000000000000000000000000000000000000000000000000000000'), 'BOLT11 testnet invoice is valid');
  assert(AddressValidator.isValid('lightning', 'lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctnv9exzurn9wfhkccte9ekx7um5v93kketj9ehx2aq0w3v82'), 'LNURL-pay format is valid');
  assert(AddressValidator.isValid('lightning', 'satoshi@strike.me'), 'Lightning Address email format is valid');
  assert(AddressValidator.isValid('lightning', 'user.name_123@stacker.news'), 'Complex Lightning Address is valid');
  assert(!AddressValidator.isValid('lightning', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), 'On-chain SegWit address rejected for Lightning');
  assert(!AddressValidator.isValid('lightning', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), 'EVM address rejected for Lightning');
  assert(!AddressValidator.isValid('lightning', 'not-a-valid-address'), 'Garbage string rejected for Lightning');

  // Test 2: LightningAdapter
  console.log('\nTest 2: LightningAdapter Deposit & Payout Engine');
  const adapter = new LightningAdapter();
  assert(adapter.chain === 'lightning', 'Chain is lightning');
  assert(!adapter.isPrivacyHub, 'Lightning is not privacy hub (routes via XMR)');

  const orderId = 'ord_ln_test_001';
  const deposit = await adapter.generateDepositAddress(orderId);
  assert(deposit.address.startsWith('lnbc'), 'Generated deposit address starts with lnbc');
  assert(deposit.extraId !== undefined, 'Generated invoice includes payment hash extraId');

  // Before settlement
  const pending = await adapter.checkDeposit(deposit.address, 0);
  assert(pending === null, 'Invoice is unsettled initially');

  // Settle invoice
  adapter.settleInvoice(deposit.address, 0.0025);
  const settled = await adapter.checkDeposit(deposit.address, 0);
  assert(settled !== null, 'Invoice is detected after settlement');
  assert(settled!.isConfirmed === true, 'Settlement is confirmed instantly (0-conf)');
  assert(settled!.confirmations === 0, 'Lightning confirmations is 0');
  assert(settled!.amount === 0.0025, 'Settled amount matches expected deposit');

  // Payout broadcast
  const payout = await adapter.broadcastPayout('satoshi@strike.me', 0.00245, 'BTC_LN');
  assert(payout.txHash.startsWith('ln_pay_'), 'Payout returns Lightning payment hash');
  assert(payout.feePaid === 0.0000001, 'Lightning routing fee is ~10 sats');
  assert(payout.explorerUrl.includes('lightning'), 'Explorer URL references Lightning explorer');

  // Test 3: Registry Integration
  console.log('\nTest 3: BlockchainAdapterRegistry');
  const registry = new BlockchainAdapterRegistry();
  const regAdapter = registry.getAdapter('lightning');
  assert(regAdapter !== null && regAdapter.chain === 'lightning', 'Registry successfully provides Lightning adapter');

  // Test 4: Privacy Hub Double-Hop Swaps with Lightning
  console.log('\nTest 4: Privacy Hub Double-Hop Quotes with Lightning');
  const priceFeed = new PriceFeedService();
  const feeCalc = new FeeCalculatorService(priceFeed);

  const btcLnAsset = ASSET_MAP['BTC_LN'];
  const xmrAsset = ASSET_MAP['XMR'];
  const ethAsset = ASSET_MAP['ETH'];
  const solAsset = ASSET_MAP['SOL'];

  assert(btcLnAsset !== undefined, 'BTC_LN asset is registered in ASSET_MAP');
  assert(btcLnAsset.confirmationsRequired === 0, 'BTC_LN requires 0 confirmations');
  assert(btcLnAsset.estimatedNetworkFee === 0.0000001, 'BTC_LN estimated network fee is 10 sats');

  // Route 1: Lightning -> Monero (Single Hop Direct)
  const lnToXmrQuote = feeCalc.generateQuote(btcLnAsset, xmrAsset, 0.01);
  assert(lnToXmrQuote.routeType === 'DIRECT_MONERO_OUT', 'BTC_LN -> XMR is direct single-hop');
  assert(lnToXmrQuote.hops.length === 2, 'Hops are [BTC_LN, XMR]');
  assert(lnToXmrQuote.feeBreakdown.serviceFeePercent === 0.0045, 'Single-hop rate is 0.45%');

  // Route 2: Lightning -> Monero -> Ethereum (Double Hop Privacy Hub)
  const lnToEthQuote = feeCalc.generateQuote(btcLnAsset, ethAsset, 0.05);
  assert(lnToEthQuote.routeType === 'PRIVACY_HUB_DOUBLE', 'BTC_LN -> ETH routes through Monero Privacy Hub');
  assert(lnToEthQuote.hops[1] === 'XMR', 'Middle hop is XMR');
  assert(lnToEthQuote.feeBreakdown.serviceFeePercent === 0.0075, 'Double-hop rate is 0.75%');
  assert(lnToEthQuote.estimatedAmountOut > 0, 'Estimated ETH output is positive');

  // Route 3: Solana -> Monero -> Lightning (Double Hop Inbound)
  const solToLnQuote = feeCalc.generateQuote(solAsset, btcLnAsset, 10.0);
  assert(solToLnQuote.routeType === 'PRIVACY_HUB_DOUBLE', 'SOL -> BTC_LN routes through Monero Privacy Hub');
  assert(solToLnQuote.hops[1] === 'XMR', 'Middle hop is XMR');
  assert(solToLnQuote.estimatedAmountOut > 0, 'Estimated BTC_LN output is positive');

  console.log('\n🎉 ALL BITCOIN LIGHTNING INTEGRATION TESTS PASSED!\n');
}

runLightningTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
