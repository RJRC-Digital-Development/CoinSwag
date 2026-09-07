/**
 * CoinSwag Master Enterprise Test Verification Runner
 * Runs all 13 security, blockchain, liquidity, API, and core test suites.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Core Fee & Monero Routing', script: 'packages/core/dist/test-suite.js' },
  { name: 'Cryptographic Security & Memory Scrubber', script: 'packages/core/dist/test-security.js' },
  { name: 'Address Splitter Core Engine', script: 'packages/core/dist/test-split.js' },
  { name: 'Bitcoin Lightning Network (0-Conf)', script: 'packages/blockchain/dist/test-lightning.js' },
  { name: 'RPC Failover & Node Health Manager', script: 'packages/blockchain/dist/test-failover.js' },
  { name: 'Tor SOCKS5 Privacy Gateway', script: 'packages/blockchain/dist/test-tor.js' },
  { name: 'Mempool Fee Estimator', script: 'packages/blockchain/dist/test-mempool.js' },
  { name: 'Revenue Sweeper & Settlement Buffer', script: 'packages/liquidity/dist/test-fee-sweeper.js' },
  { name: 'THORChain Cross-Chain Settlement', script: 'packages/liquidity/dist/test-thorchain.js' },
  { name: 'Telegram Bot Swap & Mini App', script: 'apps/bot/dist/test-bot.js' },
  { name: 'REST API & SSE Event Stream', script: 'apps/api/dist/test-api.js' },
  { name: 'Split Payment REST API', script: 'apps/api/dist/test-split-api.js' },
  { name: 'API Security Gateway & Anti-Brute-Force', script: 'apps/api/dist/test-security-suite.js' }
];

console.log('================================================================');
console.log('🛡️  CoinSwag Enterprise Pre-Audit Test Verification Suite');
console.log('================================================================\n');

let passed = 0;
let failed = 0;
const results = [];

const startTime = Date.now();

for (const suite of testSuites) {
  process.stdout.write(`▶ Running ${suite.name}... `);
  const fullPath = path.join(rootDir, suite.script);
  
  const res = spawnSync(process.execPath, [fullPath], {
    cwd: rootDir,
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  if (res.status === 0) {
    passed++;
    console.log('✅ PASSED');
    results.push({ name: suite.name, status: 'PASSED' });
  } else {
    failed++;
    console.log('❌ FAILED');
    results.push({ 
      name: suite.name, 
      status: 'FAILED', 
      output: (res.stdout || '') + '\n' + (res.stderr || '') 
    });
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================');
console.log(`📊 Audit Verification Results: ${passed} Passed, ${failed} Failed (${duration}s)`);
console.log('================================================================\n');

if (failed > 0) {
  console.error('❌ Failures encountered during pre-audit verification:\n');
  for (const r of results) {
    if (r.status === 'FAILED') {
      console.error(`--- ${r.name} ---`);
      console.error(r.output);
    }
  }
  process.exit(1);
} else {
  console.log('🎉 ALL 13 TEST SUITES PASSED! Codebase is ready for Enterprise Audit.\n');
  process.exit(0);
}
