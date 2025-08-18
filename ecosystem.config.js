// PM2 Production Process Management Configuration
module.exports = {
  apps: [{
    name: 'kilt-liquidity-portal',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      INSTANCE_ID: 0
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    health_check_grace_period: 30000
  }],
  
  deploy: {
    production: {
      user: 'root',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'your-repo-url',
      path: '/var/www/kilt-liquidity-portal',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};