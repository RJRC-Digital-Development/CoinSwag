const { fork } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 5173;
const API_PORT = process.env.API_PORT || 3001;

console.log('🚀 [CoinSwag Production Gateway] Launching unified backend & frontend...');

// 1. Start Backend API Server
const apiProcess = fork(path.join(__dirname, 'apps/api/dist/index.js'), [], {
  env: { ...process.env, PORT: API_PORT }
});

apiProcess.on('error', err => {
  console.error('[API Process Error]:', err);
});

// 2. Start Web Frontend & Reverse Proxy
const webProcess = fork(path.join(__dirname, 'apps/web/prod-server.js'), [], {
  env: { ...process.env, PORT: PORT, API_PORT: API_PORT }
});

webProcess.on('error', err => {
  console.error('[Web Process Error]:', err);
});

// 3. Automated Free-Tier Anti-Sleep Keep-Alive
// If deployed on Render or any host with idle sleep, self-pings /health every 10 mins
const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (keepAliveUrl) {
  const https = require('https');
  const http = require('http');
  const client = keepAliveUrl.startsWith('https') ? https : http;
  const targetUrl = keepAliveUrl.endsWith('/') ? `${keepAliveUrl}health` : `${keepAliveUrl}/health`;

  console.log(`⏱️ [Keep-Alive Sentinel] Active. Auto-pinging ${targetUrl} every 10 minutes to prevent container sleep.`);
  setInterval(() => {
    client.get(targetUrl, res => {
      // Consume response data to free memory
      res.resume();
    }).on('error', err => {
      // Non-critical, ignore transient network drops
    });
  }, 10 * 60 * 1000); // 10 minutes
}

function shutdown() {
  console.log('🛑 [CoinSwag Gateway] Shutting down services gracefully...');
  apiProcess.kill();
  webProcess.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
