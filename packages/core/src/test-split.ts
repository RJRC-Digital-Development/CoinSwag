import { SplitFeeCalculatorService, MAX_HOLD_SECONDS } from './services/split-fee-calculator';
import { KeypairGeneratorService } from './services/keypair-generator';
import { PriceFeedService } from './services/price-feed';

console.log('================================================================');
console.log('CoinSwag Split & Time-Release Engine Verification Suite');
console.log('================================================================\n');

const priceFeed = new PriceFeedService();
const calculator = new SplitFeeCalculatorService(priceFeed);

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Fee Tier Verification (5%, 10%, 15%, 30%, 33%)
// -------------------------------------------------------------
console.log('--- Testing 5-Tier Fee Schedule ---');

// Up to 3 addresses: 5%
const tier1a = calculator.determineTier(1);
assert(tier1a.feePercent === 0.05 && tier1a.tierCode === 'TIER_1_UPTO_3', '1 address -> 5% Fee Tier');

const tier1b = calculator.determineTier(3);
assert(tier1b.feePercent === 0.05 && tier1b.tierCode === 'TIER_1_UPTO_3', '3 addresses -> 5% Fee Tier');

// 4 to 10 addresses: 10%
const tier2a = calculator.determineTier(4);
assert(tier2a.feePercent === 0.10 && tier2a.tierCode === 'TIER_2_UPTO_10', '4 addresses -> 10% Fee Tier');

const tier2b = calculator.determineTier(10);
assert(tier2b.feePercent === 0.10 && tier2b.tierCode === 'TIER_2_UPTO_10', '10 addresses -> 10% Fee Tier');

// 11 to 20 addresses: 15%
const tier3a = calculator.determineTier(11);
assert(tier3a.feePercent === 0.15 && tier3a.tierCode === 'TIER_3_UPTO_20', '11 addresses -> 15% Fee Tier');

const tier3b = calculator.determineTier(20);
assert(tier3b.feePercent === 0.15 && tier3b.tierCode === 'TIER_3_UPTO_20', '20 addresses -> 15% Fee Tier');

// 21 to 50 addresses: 30%
const tier4a = calculator.determineTier(21);
assert(tier4a.feePercent === 0.30 && tier4a.tierCode === 'TIER_4_UPTO_50', '21 addresses -> 30% Fee Tier');

const tier4b = calculator.determineTier(50);
assert(tier4b.feePercent === 0.30 && tier4b.tierCode === 'TIER_4_UPTO_50', '50 addresses -> 30% Fee Tier');

// 51+ unlimited addresses: 33%
const tier5a = calculator.determineTier(51);
assert(tier5a.feePercent === 0.33 && tier5a.tierCode === 'TIER_5_KEYGEN_OR_UNLIMITED', '51+ addresses -> 33% Fee Tier');

const tier5b = calculator.determineTier(100);
assert(tier5b.feePercent === 0.33 && tier5b.tierCode === 'TIER_5_KEYGEN_OR_UNLIMITED', '100 addresses -> 33% Fee Tier');

// Keygen trigger for any address count -> 33%
const tierKeygen = calculator.determineTier(2, true);
assert(tierKeygen.feePercent === 0.33 && tierKeygen.isKeygenTier === true, 'Key generation mode triggers 33% Tier even for 2 addresses');

// -------------------------------------------------------------
// 2. Multi-Coin Keypair Generation
// -------------------------------------------------------------
console.log('\n--- Testing Cryptographic Keypair Generation ---');

// Bitcoin
const btcKey = KeypairGeneratorService.generateKeypair('BTC');
assert(btcKey.chain === 'bitcoin', 'BTC keypair has chain=bitcoin');
assert(btcKey.address.startsWith('bc1q'), `BTC address is Native SegWit (starts with bc1q): ${btcKey.address}`);
assert(btcKey.privateKey.length > 40, `BTC WIF private key generated (length ${btcKey.privateKey.length})`);
assert(btcKey.mnemonic?.split(' ').length === 12, '12-word mnemonic generated for BTC backup');

// Ethereum / EVM
const ethKey = KeypairGeneratorService.generateKeypair('ETH');
assert(ethKey.chain === 'ethereum', 'ETH keypair has chain=ethereum');
assert(ethKey.address.startsWith('0x') && ethKey.address.length === 42, `ETH address is standard 0x (42 chars): ${ethKey.address}`);
assert(ethKey.privateKey.startsWith('0x'), `ETH private key is 0x-prefixed hex`);

// Solana
const solKey = KeypairGeneratorService.generateKeypair('SOL');
assert(solKey.chain === 'solana', 'SOL keypair has chain=solana');
assert(solKey.address.length >= 32, `SOL address is Base58 public key (length ${solKey.address.length}): ${solKey.address}`);

// Monero
const xmrKey = KeypairGeneratorService.generateKeypair('XMR');
assert(xmrKey.chain === 'monero', 'XMR keypair has chain=monero');
assert(xmrKey.address.startsWith('4') && xmrKey.address.length === 95, `XMR address is standard 95-char address: ${xmrKey.address.substring(0, 15)}...`);
assert(xmrKey.privateKey.includes('spend:') && xmrKey.privateKey.includes('view:'), 'XMR contains spend and view keys');

// Paper Vault Export Format
const exportVault = KeypairGeneratorService.formatKeyVaultExport('order_123', 'sec_456', [btcKey, ethKey, solKey, xmrKey]);
assert(exportVault.totalKeys === 4, 'Paper Key Vault export includes all 4 generated keypairs');
assert(exportVault.vault[0].coin === 'BTC' && exportVault.vault[1].coin === 'ETH', 'Vault export structured with coin metadata');

// -------------------------------------------------------------
// 3. Time-Release Hold Validation (Up to 30 Days)
// -------------------------------------------------------------
console.log('\n--- Testing Time-Release Hold Validation ---');

// Valid 3-way split: 40% BTC (immediate), 30% XMR (7 days), 30% SOL (30 days max)
const validQuote = calculator.generateSplitQuote({
  fromAssetId: 'ETH',
  amountIn: 2.0,
  autoGenerateKeys: false,
  destinations: [
    { assetId: 'BTC', percentage: 40, address: btcKey.address, releaseDelaySeconds: 0 },
    { assetId: 'XMR', percentage: 30, address: xmrKey.address, releaseDelaySeconds: 7 * 24 * 3600 },
    { assetId: 'SOL', percentage: 30, address: solKey.address, releaseDelaySeconds: 30 * 24 * 3600 }
  ]
});

assert(validQuote.destinations.length === 3, 'Generated split quote with 3 destinations');
assert(validQuote.feeBreakdown.feePercent === 0.05, '3 destinations properly applied 5% fee tier');
assert(validQuote.destinations[0].status === 'READY_TO_RELEASE', '0s delay destination is READY_TO_RELEASE');
assert(validQuote.destinations[1].status === 'HOLD_TIME_LOCKED', '7-day delay destination is HOLD_TIME_LOCKED');
assert(validQuote.destinations[2].status === 'HOLD_TIME_LOCKED', '30-day delay destination is HOLD_TIME_LOCKED');
assert(validQuote.maxHoldDelaySeconds === 30 * 24 * 3600, 'Quote tracks maximum hold duration (30 days)');

// Test rejection of >30 days
let rejectedOverLimit = false;
try {
  calculator.generateSplitQuote({
    fromAssetId: 'ETH',
    amountIn: 1.0,
    destinations: [
      { assetId: 'BTC', percentage: 100, address: btcKey.address, releaseDelaySeconds: (31 * 24 * 3600) }
    ]
  });
} catch (e: any) {
  rejectedOverLimit = e.message.includes('exceeds maximum hold time');
}
assert(rejectedOverLimit, 'Rejects hold time exceeding 30 days (1 month)');

// Test keygen auto-generation in split quote
const keygenQuote = calculator.generateSplitQuote({
  fromAssetId: 'BTC',
  amountIn: 0.5,
  autoGenerateKeys: true,
  destinations: [
    { assetId: 'ETH', percentage: 50 },
    { assetId: 'SOL', percentage: 50 }
  ]
});

assert(keygenQuote.feeBreakdown.feePercent === 0.33, 'Auto-keygen triggers 33% fee tier');
assert(keygenQuote.destinations[0].generatedKeypair !== undefined, 'Destination 1 has auto-generated keypair');
assert(keygenQuote.destinations[1].generatedKeypair !== undefined, 'Destination 2 has auto-generated keypair');
assert(keygenQuote.destinations[0].address.startsWith('0x'), `Destination 1 auto-populated address: ${keygenQuote.destinations[0].address}`);

console.log('\n================================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All Split & Time-Release engine tests passed successfully!\n');
}
