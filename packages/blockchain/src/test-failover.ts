import assert from 'node:assert';
import { RpcFailoverManager } from './services/rpc-failover.service';
import { MoneroAdapter } from './adapters/monero.adapter';
import { DEFAULT_RPC_CONFIG } from './config/rpc.config';

async function runFailoverTests() {
  console.log('🌐 Starting External Node & Failover Verification Suite...\n');

  // Test 1: Configuration check
  console.log('▶ Test 1: Verifying default external node pools for all major blockchains');
  const manager = new RpcFailoverManager();
  
  assert(DEFAULT_RPC_CONFIG.monero.endpoints.length >= 3, 'Monero must have multiple remote nodes');
  assert(DEFAULT_RPC_CONFIG.bitcoin.endpoints.length >= 2, 'Bitcoin must have multiple external endpoints');
  assert(DEFAULT_RPC_CONFIG.ethereum.endpoints.length >= 3, 'Ethereum must have multiple EVM RPCs');
  assert(DEFAULT_RPC_CONFIG.solana.endpoints.length >= 2, 'Solana must have multiple RPCs');
  console.log(`  ✔ Monero remote nodes: ${DEFAULT_RPC_CONFIG.monero.endpoints.length} configured`);
  console.log(`  ✔ Ethereum EVM RPCs: ${DEFAULT_RPC_CONFIG.ethereum.endpoints.length} configured`);
  console.log(`  ✔ Bitcoin Mempool/Blockstream endpoints: ${DEFAULT_RPC_CONFIG.bitcoin.endpoints.length} configured`);
  console.log(`  ✔ Solana RPC endpoints: ${DEFAULT_RPC_CONFIG.solana.endpoints.length} configured`);

  // Test 2: Monero remote node command generator
  console.log('\n▶ Test 2: Monero remote node startup command validation');
  const startupCmd = MoneroAdapter.getRemoteStartupCommand(
    'test_wallet',
    'test_pass',
    'node.community.rino.io:18081',
    18083,
    false
  );
  assert(startupCmd.includes('--daemon-address node.community.rino.io:18081'), 'Must point to external daemon');
  assert(startupCmd.includes('--trusted-daemon'), 'Must flag trusted daemon');
  console.log(`  ✔ Monero remote daemon startup command verified:`);
  console.log(`    ${startupCmd}`);

  // Test 3: Automated Failover Execution
  console.log('\n▶ Test 3: Simulating node failure and verifying automatic failover');
  // Inject an offline/broken endpoint as first priority for Ethereum
  const brokenEndpoint = 'https://broken-offline-node.coinswag.test';
  manager.registerCustomEndpoint('ethereum', brokenEndpoint, true);

  console.log(`  ℹ Injected offline node [${brokenEndpoint}] as priority #1`);

  let executedEndpoints: string[] = [];
  const failoverResult = await manager.executeWithFailover('ethereum', async (endpoint) => {
    executedEndpoints.push(endpoint);
    if (endpoint === brokenEndpoint) {
      throw new Error('ECONNREFUSED: Simulated external node outage');
    }
    return { blockHeight: 21854321, status: 'synced' };
  });

  assert.strictEqual(failoverResult.attempts, 2, 'Should succeed on second attempt after failover');
  assert.notStrictEqual(failoverResult.endpointUsed, brokenEndpoint, 'Should not use the broken endpoint');
  assert.strictEqual(failoverResult.result.status, 'synced', 'Operation should succeed via fallback node');
  console.log(`  ✔ Broken node detected and bypassed`);
  console.log(`  ✔ Successfully failed over to healthy node: ${failoverResult.endpointUsed}`);
  console.log(`  ✔ Total attempts before recovery: ${failoverResult.attempts}`);

  // Test 4: Node status tracking
  console.log('\n▶ Test 4: External node health state registry');
  const allStatuses = manager.getAllNodeStatuses();
  const brokenStatus = allStatuses.find(n => n.endpoint === brokenEndpoint);
  assert(brokenStatus && brokenStatus.failureCount > 0, 'Broken node failure count must be incremented');
  console.log(`  ✔ Broken node correctly tracked with failureCount = ${brokenStatus?.failureCount}`);
  console.log(`  ✔ Total external nodes actively monitored: ${allStatuses.length}`);

  console.log('\n🎉 ALL EXTERNAL NODE & FAILOVER TESTS PASSED SUCCESSFULLY!\n');
}

runFailoverTests().catch(err => {
  console.error('❌ Failover test failed:', err);
  process.exit(1);
});
