import assert from 'assert';
import { TorProxyService } from './services/tor-proxy.service';
import { MoneroAdapter } from './adapters/monero.adapter';
import { RpcFailoverManager } from './services/rpc-failover.service';

async function runTorVerificationSuite() {
  console.log('\n🧅 Starting Tor SOCKS5 Proxy Verification Suite...\n');

  // Test 1: Default state (Tor disabled)
  console.log('▶ Test 1: Default Tor Proxy State');
  const defaultTor = new TorProxyService({ enabled: false });
  assert.strictEqual(defaultTor.isTorEnabled(), false, 'Tor should be disabled by default');
  assert.strictEqual(defaultTor.getAgent(), undefined, 'Agent should be undefined when Tor is disabled');
  assert.strictEqual(defaultTor.getMoneroCliDaemonFlag(), '', 'Monero flag should be empty when Tor disabled');
  console.log('  ✔ Tor disabled by default without SOCKS5 agent overhead');

  // Test 2: Enabled Tor SOCKS5 State
  console.log('\n▶ Test 2: Initializing Tor SOCKS5 Agent');
  const activeTor = new TorProxyService({
    enabled: true,
    proxyUrl: 'socks5h://127.0.0.1:9050'
  });
  assert.strictEqual(activeTor.isTorEnabled(), true);
  assert.strictEqual(activeTor.getProxyUrl(), 'socks5h://127.0.0.1:9050');
  assert.ok(activeTor.getAgent(), 'SocksProxyAgent should be initialized');
  
  const fetchOpts = activeTor.getFetchOptions({ headers: { 'Accept': 'application/json' } });
  assert.ok(fetchOpts.agent, 'Agent should be injected into fetch options');
  console.log('  ✔ SOCKS5 agent successfully initialized with proxy: ' + activeTor.getProxyUrl());
  console.log('  ✔ Outgoing fetch options injected with SOCKS5 agent');

  // Test 3: Monero CLI remote daemon Tor integration
  console.log('\n▶ Test 3: Monero Daemon Remote Node Tor Startup Generator');
  const moneroTorFlag = activeTor.getMoneroCliDaemonFlag();
  assert.strictEqual(moneroTorFlag, ' --proxy 127.0.0.1:9050');
  
  const cmd = MoneroAdapter.getRemoteStartupCommand(
    'vault_wallet',
    'pass123',
    'node.community.rino.io:18081',
    18083,
    true // useTor
  );
  assert.ok(cmd.includes('--proxy 127.0.0.1:9050'), 'Startup command must contain Tor proxy flag');
  console.log('  ✔ Monero remote daemon startup command verified with Tor:');
  console.log('    ' + cmd);

  // Test 4: RpcFailoverManager with Tor integration
  console.log('\n▶ Test 4: RpcFailoverManager with Tor Integration');
  const failover = new RpcFailoverManager(undefined, activeTor);
  assert.strictEqual(failover.getTorService().isTorEnabled(), true);
  assert.strictEqual(failover.getTorService().getProxyUrl(), 'socks5h://127.0.0.1:9050');
  console.log('  ✔ RpcFailoverManager successfully coupled with TorProxyService');

  console.log('\n🎉 ALL TOR SOCKS5 PROXY TESTS PASSED SUCCESSFULLY!\n');
}

runTorVerificationSuite().catch(err => {
  console.error('❌ Tor verification suite failed:', err);
  process.exit(1);
});
