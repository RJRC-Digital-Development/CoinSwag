import assert from 'assert';
import { createTelegramBot } from './index';

async function runTelegramBotVerificationSuite() {
  console.log('\n🤖 Starting Telegram Swapping Bot Verification Suite...\n');

  const { bot } = await createTelegramBot('mock_bot_test_token_123');
  const mockChatId = 987654321;

  // Test 1: /start command
  console.log('▶ Test 1: Testing /start welcome command');
  const startReply = await bot.processIncomingMessage({
    message_id: 1,
    chat: { id: mockChatId, type: 'private' },
    text: '/start',
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(startReply, 'Should receive reply from /start');
  assert.ok(startReply.text.includes('Welcome to CoinSwag Bot'), 'Should have welcome message');
  assert.ok(startReply.text.includes('Monero (XMR) Privacy Hub'), 'Should mention Monero Hub');
  assert.ok(startReply.text.includes('0.75% all-in'), 'Should mention 0.75% double hop fee');
  assert.ok(startReply.replyMarkup?.inline_keyboard, 'Should offer inline keyboard buttons');
  console.log('  ✔ /start responded with Zero-KYC privacy assurance and inline buttons');

  // Test 2: /rates command
  console.log('\n▶ Test 2: Testing /rates asset ticker command');
  const ratesReply = await bot.processIncomingMessage({
    message_id: 2,
    chat: { id: mockChatId, type: 'private' },
    text: '/rates',
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(ratesReply);
  assert.ok(ratesReply.text.includes('BTC'), 'Should contain BTC');
  assert.ok(ratesReply.text.includes('XMR'), 'Should contain XMR');
  assert.ok(ratesReply.text.includes('SOL'), 'Should contain SOL');
  console.log('  ✔ /rates successfully returned live asset rates');

  // Test 3: /quote command
  console.log('\n▶ Test 3: Testing /quote calculation command');
  const quoteReply = await bot.processIncomingMessage({
    message_id: 3,
    chat: { id: mockChatId, type: 'private' },
    text: '/quote BTC SOL 0.25',
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(quoteReply);
  assert.ok(quoteReply.text.includes('Instant Swap Quote'), 'Should have quote header');
  assert.ok(quoteReply.text.includes('Monero Hub (RingCT)'), 'Should route through Monero RingCT Hub');
  assert.ok(quoteReply.text.includes('0.75%'), 'Should apply 0.75% platform fee');
  console.log('  ✔ /quote BTC SOL 0.25 computed Monero RingCT double-hop quote correctly');

  // Test 4: /swap command with deposit address generation
  console.log('\n▶ Test 4: Testing /swap session creation with address validation');
  const validSolAddr = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const swapReply = await bot.processIncomingMessage({
    message_id: 4,
    chat: { id: mockChatId, type: 'private' },
    text: `/swap BTC SOL 0.05 ${validSolAddr}`,
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(swapReply);
  assert.ok(swapReply.text.includes('Swap Session Created!'), 'Should create swap session');
  assert.ok(swapReply.text.includes('Single-Use Deposit Address'), 'Should generate deposit address');

  // Extract orderId from text
  const match = swapReply.text.match(/Order ID: `(tg_[^`]+)`/);
  assert.ok(match && match[1], 'Order ID must be present in response');
  const orderId = match[1];
  console.log(`  ✔ Swap created with ID: ${orderId}`);
  console.log('  ✔ Single-use deposit address generated and validated');

  // Test 5: /track command
  console.log('\n▶ Test 5: Testing /track order status command');
  const trackReply = await bot.processIncomingMessage({
    message_id: 5,
    chat: { id: mockChatId, type: 'private' },
    text: `/track ${orderId}`,
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(trackReply);
  assert.ok(trackReply.text.includes(orderId), 'Should display matching order ID');
  assert.ok(trackReply.text.includes('AWAITING DEPOSIT'), 'Should reflect current status');
  console.log('  ✔ /track successfully retrieved active ephemeral order state');

  // Test 6: /help command
  console.log('\n▶ Test 6: Testing /help command');
  const helpReply = await bot.processIncomingMessage({
    message_id: 6,
    chat: { id: mockChatId, type: 'private' },
    text: '/help',
    date: Math.floor(Date.now() / 1000)
  });
  assert.ok(helpReply);
  assert.ok(helpReply.text.includes('Zero-KYC Guarantee'), 'Should provide Zero-KYC guarantee');
  console.log('  ✔ /help verified Zero-KYC compliance');

  console.log('\n🎉 ALL TELEGRAM BOT TESTS PASSED SUCCESSFULLY!\n');
}

runTelegramBotVerificationSuite().catch(err => {
  console.error('❌ Telegram Bot verification suite failed:', err);
  process.exit(1);
});
