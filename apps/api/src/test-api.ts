import assert from 'node:assert';
import { createServer } from './server';
import http from 'node:http';

async function testApi() {
  console.log('📡 Starting CoinSwag API Integration Test...');
  const { app, orderManager } = createServer();
  const server = http.createServer(app);

  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`  ✔ Test server running on ${baseUrl}`);

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData: any = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    assert.strictEqual(healthData.kyc, 'STRICTLY_NO_KYC');
    console.log('  ✔ /health responded OK with Zero-KYC confirmation');

    // 2. GET /api/v1/assets
    const assetsRes = await fetch(`${baseUrl}/api/v1/assets`);
    const assetsData: any = await assetsRes.json();
    assert(assetsData.assets.length >= 10, 'Must have at least 10 assets');
    const xmrAsset = assetsData.assets.find((a: any) => a.id === 'XMR');
    assert(xmrAsset && xmrAsset.isPrivacyHub, 'XMR must be designated as Privacy Hub');
    console.log(`  ✔ /api/v1/assets returned ${assetsData.assets.length} supported tokens`);

    // 3. POST /api/v1/quotes (BTC -> SOL via Monero Hub)
    const quoteRes = await fetch(`${baseUrl}/api/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAssetId: 'BTC',
        toAssetId: 'SOL',
        amountIn: 0.25,
        rateType: 'FLOAT'
      })
    });
    const quoteData: any = await quoteRes.json();
    assert(quoteData.quote, 'Quote must be returned');
    assert.strictEqual(quoteData.quote.routeType, 'PRIVACY_HUB_DOUBLE');
    assert.deepStrictEqual(quoteData.quote.hops, ['BTC', 'XMR', 'SOL']);
    assert.strictEqual(quoteData.quote.feeBreakdown.serviceFeePercent, 0.0075, '0.75% all-in double-hop fee');
    console.log(`  ✔ /api/v1/quotes generated privacy double-hop quote (BTC -> XMR -> SOL)`);

    // 4. POST /api/v1/swaps
    const swapRes = await fetch(`${baseUrl}/api/v1/swaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteId: quoteData.quote.id,
        destinationAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Valid Solana
        refundAddress: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',      // Valid Bitcoin
        anonymizationDelaySeconds: 0
      })
    });
    const swapData: any = await swapRes.json();
    assert(swapData.order, 'Order must be created');
    assert(swapData.order.depositAddress.startsWith('bc1q'), 'Must generate unique BTC deposit address');
    assert.strictEqual(swapData.order.status, 'AWAITING_DEPOSIT');
    console.log(`  ✔ /api/v1/swaps created order ${swapData.order.id} with deposit address: ${swapData.order.depositAddress}`);

    // 5. POST /api/v1/swaps/:id/advance (Simulate deposit detection)
    const adv1 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv1Data: any = await adv1.json();
    assert.strictEqual(adv1Data.order.status, 'DEPOSIT_DETECTED');
    console.log('  ✔ Advanced order: DEPOSIT_DETECTED');

    // 6. POST /api/v1/swaps/:id/advance (Simulate deposit confirmed)
    const adv2 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv2Data: any = await adv2.json();
    assert.strictEqual(adv2Data.order.status, 'DEPOSIT_CONFIRMED');
    console.log('  ✔ Advanced order: DEPOSIT_CONFIRMED');

    // 7. Advance to HOP1_CONVERTING_TO_XMR
    const adv3 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv3Data: any = await adv3.json();
    assert.strictEqual(adv3Data.order.status, 'HOP1_CONVERTING_TO_XMR');
    console.log('  ✔ Advanced order: HOP1_CONVERTING_TO_XMR');

    // 8. Advance to XMR_RECEIVED_IN_HUB
    const adv4 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv4Data: any = await adv4.json();
    assert.strictEqual(adv4Data.order.status, 'XMR_RECEIVED_IN_HUB');
    console.log('  ✔ Advanced order: XMR_RECEIVED_IN_HUB (Traceability Broken)');

    // 9. Advance to HOP2_CONVERTING_TO_TARGET
    const adv5 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv5Data: any = await adv5.json();
    assert.strictEqual(adv5Data.order.status, 'HOP2_CONVERTING_TO_TARGET');
    console.log('  ✔ Advanced order: HOP2_CONVERTING_TO_TARGET');

    // 10. Advance to PAYOUT_BROADCASTING
    const adv6 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv6Data: any = await adv6.json();
    assert.strictEqual(adv6Data.order.status, 'PAYOUT_BROADCASTING');
    console.log('  ✔ Advanced order: PAYOUT_BROADCASTING');

    // 11. Advance to COMPLETED
    const adv7 = await fetch(`${baseUrl}/api/v1/swaps/${swapData.order.id}/advance`, { method: 'POST' });
    const adv7Data: any = await adv7.json();
    assert.strictEqual(adv7Data.order.status, 'COMPLETED');
    assert(adv7Data.order.payoutTxHash, 'Payout tx hash generated');
    console.log(`  ✔ Advanced order: COMPLETED with Payout Tx ${adv7Data.order.payoutTxHash}`);

    // 10. POST /api/v1/admin/janitor
    const janitorRes = await fetch(`${baseUrl}/api/v1/admin/janitor`, { method: 'POST' });
    const janitorData: any = await janitorRes.json();
    assert(janitorData.message.includes('Zero-KYC Janitor executed'));
    console.log('  ✔ /api/v1/admin/janitor triggered successfully');

    console.log('\n🎉 ALL API INTEGRATION TESTS PASSED!\n');
  } finally {
    server.close();
  }
}

testApi().catch(err => {
  console.error('❌ API test failed:', err);
  process.exit(1);
});
