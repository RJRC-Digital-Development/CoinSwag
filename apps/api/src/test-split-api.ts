import { createServer } from './server';
import http from 'http';

console.log('================================================================');
console.log('CoinSwag Split API & Time-Release Server Verification Suite');
console.log('================================================================\n');

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

async function runTests() {
  const { app, orderManager } = createServer();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. POST /api/v1/splits/quote (3 addresses -> 5% fee tier)
    console.log('--- 1. Testing Split Quote API ---');
    const quoteRes = await fetch(`${baseUrl}/api/v1/splits/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssetId: 'ETH',
        amountIn: 2.5,
        destinations: [
          { assetId: 'BTC', percentage: 50, address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', releaseDelaySeconds: 0 },
          { assetId: 'XMR', percentage: 25, address: '44AFFq5kSiGBoZ4NMDwYtN18obc8AemS33DBLWs3H7otXft3XjrpDtQGv7SqSsaBYBb98uNbr2VBBEt7f2wfn3RVGQBEP3A', releaseDelaySeconds: 7 * 24 * 3600 },
          { assetId: 'SOL', percentage: 25, address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', releaseDelaySeconds: 14 * 24 * 3600 }
        ]
      })
    });
    const quoteData: any = await quoteRes.json();
    assert(quoteRes.status === 200, 'POST /api/v1/splits/quote returned 200 OK');
    assert(quoteData.quote.destinations.length === 3, 'Quote contains 3 split destinations');
    assert(quoteData.quote.feeBreakdown.tier.feePercent === 0.05, '3-address split applied 5% fee tier');
    assert(quoteData.quote.maxHoldDelaySeconds === 14 * 24 * 3600, 'Max hold delay tracked as 14 days');

    const quoteId = quoteData.quote.id;

    // 2. Test Keygen Mode Quote (triggers 33% tier and generates keys)
    console.log('\n--- 2. Testing Keygen Mode Quote API ---');
    const keygenRes = await fetch(`${baseUrl}/api/v1/splits/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssetId: 'BTC',
        amountIn: 0.8,
        autoGenerateKeys: true,
        destinations: [
          { assetId: 'ETH', percentage: 50, releaseDelaySeconds: 0 },
          { assetId: 'SOL', percentage: 50, releaseDelaySeconds: 30 * 24 * 3600 }
        ]
      })
    });
    const keygenData: any = await keygenRes.json();
    assert(keygenData.quote.feeBreakdown.tier.feePercent === 0.33, 'Keygen mode triggers 33% fee tier');
    assert(keygenData.quote.destinations[0].generatedKeypair !== undefined, 'Keygen populated keypair for ETH destination');
    assert(keygenData.quote.destinations[1].generatedKeypair !== undefined, 'Keygen populated keypair for SOL destination');

    const keygenQuoteId = keygenData.quote.id;

    // 3. POST /api/v1/splits/create
    console.log('\n--- 3. Testing Split Order Creation API ---');
    const createRes = await fetch(`${baseUrl}/api/v1/splits/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: keygenQuoteId,
        refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      })
    });
    const createData: any = await createRes.json();
    assert(createRes.status === 201, 'POST /api/v1/splits/create returned 201 Created');
    assert(createData.order.id.startsWith('split_'), `Created split order with ID: ${createData.order.id}`);
    assert(createData.order.depositAddress.length > 0, `Generated deposit address: ${createData.order.depositAddress}`);
    assert(createData.order.secretToken.startsWith('sec_'), 'Generated ephemeral client secretToken');

    const orderId = createData.order.id;
    const secretToken = createData.order.secretToken;

    // 4. GET /api/v1/splits/:id
    console.log('\n--- 4. Testing Split Order Retrieval API ---');
    const getRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}`);
    const getData: any = await getRes.json();
    assert(getRes.status === 200, 'GET /api/v1/splits/:id returned 200 OK');
    assert(getData.order.status === 'AWAITING_DEPOSIT', 'Order initial status is AWAITING_DEPOSIT');

    // 5. GET /api/v1/splits/:id/keys (Zero-KYC Key Vault Download)
    console.log('\n--- 5. Testing Zero-KYC Key Vault Download API ---');
    const keysRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}/keys?secretToken=${secretToken}`);
    const keysData: any = await keysRes.json();
    assert(keysRes.status === 200, 'GET /api/v1/splits/:id/keys authorized successfully with secretToken');
    assert(keysData.title === 'CoinSwag Zero-KYC Paper Key Vault', 'Vault title matches specification');
    assert(keysData.vault.length === 2, 'Vault contains both generated keypairs');
    assert(keysData.vault[0].coin === 'ETH' && keysData.vault[0].privateKey.startsWith('0x'), 'ETH private key export verified');
    assert(keysData.vault[1].coin === 'SOL', 'SOL key export verified');

    // Test unauthorized access without secret token
    const unauthKeysRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}/keys`);
    assert(unauthKeysRes.status === 401, 'Unauthorized request without secret token is rejected with 401');

    // 6. GET /api/v1/splits/:id/schedule
    console.log('\n--- 6. Testing Time-Release Schedule API ---');
    const schedRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}/schedule`);
    const schedData: any = await schedRes.json();
    assert(schedRes.status === 200, 'GET /api/v1/splits/:id/schedule returned 200 OK');
    assert(schedData.schedule.length === 2, 'Schedule lists both split destinations');

    // 7. Advance Order Execution & Time-Lock Vault Simulation
    console.log('\n--- 7. Testing Split Order Lifecycle Progression ---');
    // Step 1: Deposit Detected
    const adv1 = await (await fetch(`${baseUrl}/api/v1/splits/${orderId}/advance`, { method: 'POST' })).json();
    assert(adv1.order.status === 'DEPOSIT_DETECTED', 'Transitioned to DEPOSIT_DETECTED');

    // Step 2: Deposit Confirmed
    const adv2 = await (await fetch(`${baseUrl}/api/v1/splits/${orderId}/advance`, { method: 'POST' })).json();
    assert(adv2.order.status === 'DEPOSIT_CONFIRMED', 'Transitioned to DEPOSIT_CONFIRMED');

    // Step 3: Converted in Monero Privacy Hub and locked into time-release vault
    const adv3 = await (await fetch(`${baseUrl}/api/v1/splits/${orderId}/advance`, { method: 'POST' })).json();
    assert(
      adv3.order.status === 'TIME_LOCK_HOLDING' || adv3.order.status === 'PARTIALLY_RELEASED',
      `Funds in Zero-Knowledge Vault: ${adv3.order.status}`
    );
    // Destination 0 had 0s delay -> should be RELEASED immediately
    assert(adv3.order.destinations[0].status === 'RELEASED', 'Immediate tranche (0s delay) is marked RELEASED');
    assert(adv3.order.destinations[0].payoutTxHash !== undefined, `Immediate payout tx: ${adv3.order.destinations[0].payoutTxHash}`);

    // Destination 1 had 30-day delay -> should remain HOLD_TIME_LOCKED
    assert(adv3.order.destinations[1].status === 'HOLD_TIME_LOCKED', '30-day tranche remains safely HOLD_TIME_LOCKED');

    // 8. Early Release of Time-Locked Tranche
    console.log('\n--- 8. Testing Early Release of Time-Locked Tranche ---');
    const earlyRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}/release-early`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationId: adv3.order.destinations[1].id,
        secretToken
      })
    });
    const earlyData: any = await earlyRes.json();
    assert(earlyRes.status === 200, 'POST /api/v1/splits/:id/release-early succeeded');
    assert(earlyData.success === true, 'Early tranche release confirmed');

    // Verify order is now fully COMPLETED
    const finalOrderRes = await fetch(`${baseUrl}/api/v1/splits/${orderId}`);
    const finalOrderData: any = await finalOrderRes.json();
    assert(finalOrderData.order.status === 'COMPLETED', 'All tranches released -> Order marked COMPLETED');

    console.log('\n================================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================');

    server.close();
  } finally {
    orderManager.getTimeReleaseManager().stop();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
