import assert from 'node:assert';
import {
  PriceFeedService,
  FeeCalculatorService,
  AddressValidator,
  SwapStateMachine,
  ASSET_MAP,
  SwapOrder,
  SwapQuote
} from './index';

async function runTests() {
  console.log('🧪 Starting CoinSwag Comprehensive Verification Suite...\n');

  // TEST 1: Fee Calculator & Competitive Pricing
  console.log('▶ Test 1: Competitive Fee Engine & Monero Routing Calculations');
  const priceFeed = new PriceFeedService();
  const feeCalc = new FeeCalculatorService(priceFeed);

  // Single-hop: BTC -> XMR (destination is Monero)
  const btcToXmrQuote = feeCalc.generateQuote(ASSET_MAP['BTC'], ASSET_MAP['XMR'], 0.1);
  assert.strictEqual(btcToXmrQuote.routeType, 'DIRECT_MONERO_OUT');
  assert.strictEqual(btcToXmrQuote.feeBreakdown.serviceFeePercent, 0.0045, 'Single hop fee must be 0.45%');
  assert.deepStrictEqual(btcToXmrQuote.hops, ['BTC', 'XMR']);
  console.log('  ✔ Single-hop BTC -> XMR fee is exactly 0.45% (matches/beats competitors)');

  // Single-hop: XMR -> SOL (source is Monero)
  const xmrToSolQuote = feeCalc.generateQuote(ASSET_MAP['XMR'], ASSET_MAP['SOL'], 2.0);
  assert.strictEqual(xmrToSolQuote.routeType, 'DIRECT_MONERO_IN');
  assert.strictEqual(xmrToSolQuote.feeBreakdown.serviceFeePercent, 0.0045, 'Single hop fee must be 0.45%');
  assert.deepStrictEqual(xmrToSolQuote.hops, ['XMR', 'SOL']);
  console.log('  ✔ Single-hop XMR -> SOL fee is exactly 0.45%');

  // Double-hop Privacy Hub: BTC -> SOL (neither is Monero, MUST filter through XMR)
  const btcToSolQuote = feeCalc.generateQuote(ASSET_MAP['BTC'], ASSET_MAP['SOL'], 0.5);
  assert.strictEqual(btcToSolQuote.routeType, 'PRIVACY_HUB_DOUBLE');
  assert.strictEqual(btcToSolQuote.feeBreakdown.serviceFeePercent, 0.0075, 'Double hop privacy fee must be 0.75%');
  assert.deepStrictEqual(btcToSolQuote.hops, ['BTC', 'XMR', 'SOL'], 'Routing MUST filter through XMR as central hub');
  assert(btcToSolQuote.feeBreakdown.competitorComparison.estimatedSavingsUsd > 0, 'User should save money vs 1.4% competitor aggregator fees');
  console.log(`  ✔ Double-hop BTC -> XMR -> SOL routes strictly through Monero Hub with 0.75% all-in fee`);
  console.log(`  ✔ User saves $${btcToSolQuote.feeBreakdown.competitorComparison.estimatedSavingsUsd.toFixed(2)} vs competitor aggregators`);

  // TEST 2: Address Validator across Top 10 Blockchains
  console.log('\n▶ Test 2: Address Format Validation for Top 10 Blockchains');
  // Monero
  assert(AddressValidator.isValid('monero', '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoogDavup3H'), 'Valid XMR subaddress');
  assert(!AddressValidator.isValid('monero', 'invalid_address'), 'Invalid XMR address rejected');

  // Bitcoin
  assert(AddressValidator.isValid('bitcoin', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), 'Valid Native SegWit BTC');
  assert(AddressValidator.isValid('bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), 'Valid Legacy BTC');

  // Ethereum / EVM / BSC
  assert(AddressValidator.isValid('ethereum', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), 'Valid EVM address');
  assert(AddressValidator.isValid('bsc', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), 'Valid BSC address');
  assert(!AddressValidator.isValid('ethereum', '0x123'), 'Invalid short EVM address rejected');

  // Solana
  assert(AddressValidator.isValid('solana', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'), 'Valid Solana address');

  // Avalanche & Polygon (EVM)
  assert(AddressValidator.isValid('avalanche', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), 'Valid AVAX address');
  assert(AddressValidator.isValid('polygon', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), 'Valid POL address');

  // Cardano
  assert(AddressValidator.isValid('cardano', 'addr1q9r2yvh8m332n4766u47y3c8sh6858e9v49kcmv5r6l3y4q26h7f3x6m4p93z6x888hsm3y2q5j7z9c0y2g2k5l9m8s'), 'Valid ADA address');

  // Polkadot
  assert(AddressValidator.isValid('polkadot', '1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg'), 'Valid DOT address');

  // Cosmos & Near
  assert(AddressValidator.isValid('cosmos', 'cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0e86eh6mm'), 'Valid ATOM address');
  assert(AddressValidator.isValid('near', 'coinswag.near'), 'Valid NEAR address');

  // Kaspa & Ton
  assert(AddressValidator.isValid('kaspa', 'kaspa:qrel0wdfw5e89w03t62e4j9fqu569y822d64gqvcv2y43f9a762q6a34x092f'), 'Valid KAS address');
  assert(AddressValidator.isValid('ton', 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N'), 'Valid TON address');

  // Litecoin & Dogecoin
  assert(AddressValidator.isValid('litecoin', 'ltc1qg6cv0vsv9f9mvgsv9lq3r7kvv7p7rvq2kv5e2r'), 'Valid LTC address');
  assert(AddressValidator.isValid('dogecoin', 'DJr6r8e9FjF2u6GhyPkn8PZ7YhLz9t4k5x'), 'Valid DOGE address');
  console.log('  ✔ All address checksums and format regexes verified successfully');

  // TEST 3: Monero Privacy Hub State Transitions
  console.log('\n▶ Test 3: Swap State Machine & Monero Hub Transitions');
  let order: SwapOrder = {
    id: 'test_order_1',
    secretToken: 'sec_123',
    quote: btcToSolQuote,
    depositAddress: 'bc1q_dummy_deposit',
    depositConfirmations: 0,
    requiredConfirmations: 1,
    destinationAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    hops: [],
    anonymizationDelaySeconds: 0,
    status: 'AWAITING_DEPOSIT',
    statusMessage: SwapStateMachine.getDefaultMessage('AWAITING_DEPOSIT'),
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    metadataPurged: false
  };

  // Illegal transition check
  assert.throws(() => {
    SwapStateMachine.transition(order, 'COMPLETED');
  }, /Illegal state transition/, 'Cannot skip from awaiting deposit to completed');
  console.log('  ✔ Illegal state transition rejected');

  // Valid step-by-step transition
  order = SwapStateMachine.transition(order, 'DEPOSIT_DETECTED');
  order = SwapStateMachine.transition(order, 'DEPOSIT_CONFIRMED');
  order = SwapStateMachine.transition(order, 'HOP1_CONVERTING_TO_XMR');
  order = SwapStateMachine.transition(order, 'XMR_RECEIVED_IN_HUB');
  order = SwapStateMachine.transition(order, 'HOP2_CONVERTING_TO_TARGET');
  order = SwapStateMachine.transition(order, 'PAYOUT_BROADCASTING');
  order = SwapStateMachine.transition(order, 'COMPLETED');
  assert.strictEqual(order.status, 'COMPLETED');
  assert(order.completedAt !== undefined, 'completedAt timestamp set');
  console.log('  ✔ End-to-end Monero Hub state progression verified');

  // TEST 4: Zero-KYC Janitor Data Shredder
  console.log('\n▶ Test 4: Zero-KYC Data Shredder & Anonymity Assurance');
  const shredded = SwapStateMachine.shredMetadata(order);
  assert.strictEqual(shredded.depositAddress, '[PURGED_FOR_PRIVACY]');
  assert.strictEqual(shredded.destinationAddress, '[PURGED_FOR_PRIVACY]');
  assert.strictEqual(shredded.refundAddress, '[PURGED_FOR_PRIVACY]');
  assert.strictEqual(shredded.metadataPurged, true);
  console.log('  ✔ Ephemeral metadata permanently shredded according to Zero-KYC specification');

  console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
