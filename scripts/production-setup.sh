#!/bin/bash
# Production Setup Script for KILT Liquidity Portal

set -e

echo "🚀 Setting up KILT Liquidity Portal for Production"

# Create necessary directories
echo "📁 Creating production directories..."
mkdir -p logs
mkdir -p ssl
mkdir -p backups
mkdir -p monitoring

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    npm install -g pm2
fi

# Install production dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build the application
echo "🏗️ Building application..."
npm run build

# Setup SSL certificates (placeholder)
echo "🔒 Setting up SSL certificates..."
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "⚠️ SSL certificates not found. Please place your SSL certificates in:"
    echo "   - ssl/cert.pem"
    echo "   - ssl/key.pem"
    echo "   Or generate self-signed certificates for development:"
    echo "   openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes"
fi

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/kilt-liquidity-portal > /dev/null <<EOF
/home/*/kilt-liquidity-portal/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Setup systemd service for auto-restart
echo "⚙️ Setting up systemd service..."
sudo tee /etc/systemd/system/kilt-liquidity-portal.service > /dev/null <<EOF
[Unit]
Description=KILT Liquidity Portal
After=network.target

[Service]
Type=forking
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/local/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/local/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/local/bin/pm2 stop ecosystem.config.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable the service
sudo systemctl daemon-reload
sudo systemctl enable kilt-liquidity-portal

# Setup production environment check
echo "✅ Running production readiness check..."
npm run check

echo "🎉 Production setup completed!"
echo ""
echo "Next steps:"
echo "1. Copy production.env.example to .env and fill in your values"
echo "2. Place your SSL certificates in ssl/cert.pem and ssl/key.pem"
echo "3. Start the application: npm run start:prod"
echo "4. Monitor with: npm run monitor"
echo ""
echo "Production endpoints:"
echo "- Health Check: https://your-domain/health"
echo "- System Status: https://your-domain/api/system/health"
echo "- Deployment Ready: https://your-domain/api/system/deployment-readiness"