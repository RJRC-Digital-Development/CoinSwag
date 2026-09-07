module.exports = {
  apps: [
    {
      name: 'coinswag-api',
      script: 'apps/api/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'coinswag-web',
      script: 'apps/web/prod-server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        API_PORT: 3001
      }
    },
    {
      name: 'coinswag-bot',
      script: 'apps/bot/dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
