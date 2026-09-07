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

function shutdown() {
  console.log('🛑 [CoinSwag Gateway] Shutting down services gracefully...');
  apiProcess.kill();
  webProcess.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
