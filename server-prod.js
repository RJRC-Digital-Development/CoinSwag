const path = require('path');

const PORT = process.env.PORT || 5173;
process.env.PORT = PORT;

console.log(`🚀 [CoinSwag Production Gateway] Launching unified single-process engine on port ${PORT}...`);

// Start unified Express server directly in the main process (Single process, RAM: ~65MB total!)
const { createServer } = require(path.join(__dirname, 'apps/api/dist/server.js'));
const { app } = createServer();

const server = app.listen(PORT, () => {
  const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`=======================================================`);
  console.log(`🚀 CoinSwag Production Engine Online (Single Process)`);
  console.log(`🔒 Monero Privacy Hub: Active (Hop 1 -> XMR -> Hop 2)`);
  console.log(`⚡ Bitcoin Lightning Network: Instant 0-Conf Active`);
  console.log(`🛡️  Memory Footprint: ~${memMb}MB (Allocated for 512MB limit)`);
  console.log(`🌐 Server listening on http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

// Automated Free-Tier Anti-Sleep Keep-Alive
const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (keepAliveUrl) {
  const https = require('https');
  const http = require('http');
  const client = keepAliveUrl.startsWith('https') ? https : http;
  const targetUrl = keepAliveUrl.endsWith('/') ? `${keepAliveUrl}health` : `${keepAliveUrl}/health`;

  console.log(`⏱️ [Keep-Alive Sentinel] Active. Auto-pinging ${targetUrl} every 10 minutes.`);
  setInterval(() => {
    client.get(targetUrl, res => {
      res.resume();
    }).on('error', () => {});
  }, 10 * 60 * 1000);
}

function shutdown() {
  console.log('🛑 [CoinSwag Gateway] Shutting down gracefully...');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
