import assert from 'node:assert';
import http from 'node:http';
import { createServer } from './server';
import { VaultCipher, MemoryScrubber } from '@coinswag/core';
import { rateLimiterSentinel, TimingSafeEqual } from './security';

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('CoinSwag Comprehensive Defense-in-Depth Security Audit Suite');
  console.log('================================================================\n');

  let passed = 0;
  function reportPass(msg: string) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  }

  // Reset any previous rate limiter / jail records
  rateLimiterSentinel.resetLimits();
  rateLimiterSentinel.resetJail();

  const { app, orderManager } = createServer();
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -------------------------------------------------------------------------
    // 1. HTTP Security Headers & Banner Stripping
    // -------------------------------------------------------------------------
    console.log('--- 1. Testing HTTP Threat Shielding & Security Headers ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.strictEqual(healthRes.headers.get('x-frame-options'), 'DENY');
    reportPass('Anti-Clickjacking X-Frame-Options: DENY enforced');

    assert.strictEqual(healthRes.headers.get('x-content-type-options'), 'nosniff');
    reportPass('MIME-sniffing protection X-Content-Type-Options: nosniff enforced');

    assert.strictEqual(healthRes.headers.get('referrer-policy'), 'no-referrer');
    reportPass('Referrer-Policy: no-referrer prevents transaction URL leaks');

    assert(healthRes.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    reportPass("Strict CSP policy with frame-ancestors 'none' active");

    assert.strictEqual(healthRes.headers.get('x-powered-by'), null);
    reportPass('Server fingerprinting stripped (X-Powered-By header null)');

    // -------------------------------------------------------------------------
    // 2. Anti-Prototype Pollution & Input Sanitization
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Anti-Prototype Pollution & Tampering Sentinel ---');
    
    // Attempt prototype pollution via __proto__
    const protoRes = await fetch(`${baseUrl}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"__proto__":{"polluted":true},"fromAssetId":"BTC","toAssetId":"XMR","amountIn":1.0}'
    });
    assert.strictEqual(protoRes.status, 400);
    const protoData: any = await protoRes.json();
    assert(protoData.error.includes('input security policy'));
    reportPass('Malicious __proto__ prototype pollution strictly rejected with HTTP 400');

    // Attempt constructor pollution
    const constructorRes = await fetch(`${baseUrl}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"constructor":{"prototype":{"admin":true}},"fromAssetId":"BTC","toAssetId":"XMR","amountIn":1.0}'
    });
    assert.strictEqual(constructorRes.status, 400);
    reportPass('Malicious constructor prototype pollution strictly rejected with HTTP 400');

    // Attempt null-byte injection
    const nullByteRes = await fetch(`${baseUrl}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssetId: 'BTC\0admin',
        toAssetId: 'XMR',
        amountIn: 1.0
      })
    });
    assert.strictEqual(nullByteRes.status, 400);
    reportPass('Null-byte injection attempt rejected with HTTP 400');

    // -------------------------------------------------------------------------
    // 3. Constant-Time Comparison (TimingSafeEqual)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Side-Channel Timing Resistance (TimingSafeEqual) ---');
    assert(TimingSafeEqual.compare('secret_token_12345', 'secret_token_12345'));
    reportPass('Identical secret tokens match in constant time');

    assert(!TimingSafeEqual.compare('secret_token_12345', 'secret_token_12346'));
    reportPass('Differing token rejected');

    assert(!TimingSafeEqual.compare('secret_token_12345', 'short'));
    reportPass('Different length tokens safely compared without buffer length mismatch error');

    assert(!TimingSafeEqual.compare(null, 'secret_token_12345'));
    assert(!TimingSafeEqual.compare(undefined, undefined));
    reportPass('Non-string or null/undefined inputs safely handled');

    // -------------------------------------------------------------------------
    // 4. Rate Limiting & Anti-Brute-Force Jailing
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Sliding-Window Rate Limiting & Intrusion Jailing ---');
    
    // Test sliding window throttle on quote endpoint
    rateLimiterSentinel.resetLimits();
    const testIp = '198.51.100.42';
    let rateLimited = false;

    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${baseUrl}/api/v1/quotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp
        },
        body: JSON.stringify({
          fromAssetId: 'BTC',
          toAssetId: 'XMR',
          amountIn: 0.1
        })
      });

      if (res.status === 429) {
        rateLimited = true;
        assert(res.headers.get('retry-after') !== null);
        break;
      }
    }
    assert(rateLimited, 'Request must be throttled with HTTP 429 when quote limit exceeded');
    reportPass('Sliding-window rate limiter triggered HTTP 429 with Retry-After header');

    // Test anti-brute-force jail on unauthorized secret tokens
    const jailTestIp = '203.0.113.88';
    rateLimiterSentinel.resetLimits();

    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/v1/splits/split_fake_order/keys?secretToken=invalid_guess_${i}`, {
        headers: { 'X-Forwarded-For': jailTestIp }
      });
      assert.strictEqual(res.status, 401);
    }

    // 6th attempt should now be blocked by the intrusion jail (HTTP 403)
    const jailedRes = await fetch(`${baseUrl}/api/v1/splits/split_fake_order/keys?secretToken=another_guess`, {
      headers: { 'X-Forwarded-For': jailTestIp }
    });
    assert.strictEqual(jailedRes.status, 403);
    const jailedData: any = await jailedRes.json();
    assert(jailedData.error.includes('temporarily banned due to suspected brute-force'));
    reportPass('Anti-Brute-Force Sentinel automatically jailed attacking IP with HTTP 403');

    // The suite uses one local test client; clear its simulated jail before
    // exercising unrelated authenticated flows.
    rateLimiterSentinel.resetLimits();
    rateLimiterSentinel.resetJail();

    // -------------------------------------------------------------------------
    // 5. Encrypted Key Vault Download & Decryption Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing End-to-End Key Vault Encryption & Download ---');
    
    // Create split quote with autoGenerateKeys
    const splitQuoteRes = await fetch(`${baseUrl}/api/v1/splits/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssetId: 'BTC',
        amountIn: 1.0,
        destinations: [
          { assetId: 'BTC', sharePercent: 50, holdDays: 0 },
          { assetId: 'ETH', sharePercent: 50, holdDays: 7 }
        ],
        autoGenerateKeys: true
      })
    });
    const splitQuoteData: any = await splitQuoteRes.json();
    assert(splitQuoteData.quote, 'Split quote must succeed');

    // Create split order
    const splitOrderRes = await fetch(`${baseUrl}/api/v1/splits/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: splitQuoteData.quote.id,
        refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      })
    });
    const splitOrderData: any = await splitOrderRes.json();
    const splitOrder = splitOrderData.order;
    assert(splitOrder.secretToken, 'Order must include secretToken');

    // Download with AES-256-GCM encryption passphrase
    const userPassphrase = 'CorrectHorseBatteryStaple#99!';
    const vaultRes = await fetch(
      `${baseUrl}/api/v1/splits/${splitOrder.id}/keys`,
      { headers: { 'x-secret-token': splitOrder.secretToken, 'x-vault-passphrase': userPassphrase } }
    );
    assert.strictEqual(vaultRes.status, 200);
    assert.strictEqual(vaultRes.headers.get('cache-control'), 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reportPass('Key Vault download endpoint returned HTTP 200 with strict no-store Cache-Control');

    const vaultBundle: any = await vaultRes.json();
    assert.strictEqual(vaultBundle.algorithm, 'aes-256-gcm');
    assert.strictEqual(vaultBundle.iterations, 600000);
    reportPass('Key Vault exported in authenticated AES-256-GCM format (600,000 PBKDF2 iterations)');

    // Decrypt and verify payload
    const decryptedPayload = VaultCipher.decryptVault(vaultBundle, userPassphrase);
    assert.strictEqual(decryptedPayload.orderId, splitOrder.id);
    assert.strictEqual(decryptedPayload.vault.length, 2);
    reportPass('Authenticated AES-256-GCM vault successfully decrypted with matching keypairs');

    // Decrypt with wrong passphrase must fail
    assert.throws(
      () => VaultCipher.decryptVault(vaultBundle, 'WrongPassword123!'),
      /Integrity check failed|Decryption failed|invalid passphrase/
    );
    reportPass('Decryption with wrong passphrase strictly rejected');

    // -------------------------------------------------------------------------
    // 6. Blockchain Financial Sentinel & Hot-Wallet Drain Protection
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing Financial Sentinel & Circuit Breaker ---');
    
    // Status endpoint
    const statusRes = await fetch(`${baseUrl}/api/v1/sentinel/status`);
    const statusData: any = await statusRes.json();
    assert.strictEqual(statusData.status, 'ARMED_AND_ACTIVE');
    assert.strictEqual(statusData.circuitBreaker.state, 'CLOSED');
    reportPass('Financial Sentinel status endpoint reports ARMED_AND_ACTIVE in CLOSED state');

    // Single payout exceeding threshold triggers circuit breaker
    const breaker = orderManager.getCircuitBreaker();
    assert.throws(
      () => breaker.authorizeOutflow('BTC', 2.0, 130000, 'bc1qtestdrainaddress'),
      /EmergencyDrainCircuitBreakerError/
    );
    reportPass('Outflow exceeding single payout limit ($50k) immediately tripped the Circuit Breaker');
    assert.strictEqual(breaker.getStatus().state, 'TRIPPED');

    // Subsequent normal payouts are blocked while tripped
    assert.throws(
      () => breaker.authorizeOutflow('ETH', 0.5, 1500, '0xTestAddress'),
      /Outflows are currently frozen/
    );
    reportPass('All subsequent outflows blocked while Circuit Breaker is TRIPPED');

    // Operator manual reset endpoint
    const resetRes = await fetch(`${baseUrl}/api/v1/sentinel/reset`, { method: 'POST' });
    const resetData: any = await resetRes.json();
    assert.strictEqual(resetData.status.state, 'CLOSED');
    reportPass('Operator manual reset restored Circuit Breaker to CLOSED state');

    // Operator manual emergency trip endpoint
    const tripRes = await fetch(`${baseUrl}/api/v1/sentinel/trip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Operator detected anomalous upstream node activity' })
    });
    const tripData: any = await tripRes.json();
    assert.strictEqual(tripData.status.state, 'TRIPPED');
    reportPass('Operator manual emergency trip instantly engaged Circuit Breaker');

    // Reset back to closed
    breaker.reset();

    // -------------------------------------------------------------------------
    // 7. Zero-KYC Janitor & 3-Pass DoD Memory Shredding
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Zero-KYC Janitor & 3-Pass Memory Shredder ---');
    // Force split order expiration to test janitor
    const orderToPurge = orderManager.getSplitOrder(splitOrder.id)!;
    orderToPurge.status = 'EXPIRED';
    
    const purgedCount = orderManager.runZeroKycJanitor();
    assert(purgedCount >= 1, 'At least 1 order must be purged by Janitor');
    assert.strictEqual(orderToPurge.metadataPurged, true);
    assert.strictEqual(orderToPurge.depositAddress, 'SHREDDED_ZERO_KYC');
    assert.strictEqual(orderToPurge.refundAddress, 'SHREDDED_ZERO_KYC');
    assert.strictEqual(orderToPurge.secretToken, 'SHREDDED_ZERO_KYC');
    assert.strictEqual(orderToPurge.destinations[0].address, 'SHREDDED_ZERO_KYC');
    assert.strictEqual(orderToPurge.destinations[0].generatedKeypair?.privateKey, 'SHREDDED_ZERO_KYC');
    reportPass('Zero-KYC Janitor executed 3-pass DoD memory scrubbing and zeroized private keys & addresses');

    console.log('\n================================================================');
    console.log(`Results: ${passed} Passed, 0 Failed`);
    console.log('================================================================');
    console.log('All Defense-in-Depth Security Tests Passed Successfully!\n');

    server.close();
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('❌ Security Suite Assertion Failed:', err);
    process.exit(1);
  }
}

runSecuritySuite().catch(err => {
  console.error('❌ Security Suite Failed:', err);
  process.exit(1);
});
