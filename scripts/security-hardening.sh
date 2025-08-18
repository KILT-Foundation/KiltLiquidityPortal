#!/bin/bash
# Production Security Hardening Script

set -e

echo "🔒 Applying security hardening for KILT Liquidity Portal"

# Check if running as root (not recommended for app, but needed for system config)
if [[ $EUID -eq 0 ]]; then
   echo "⚠️ Running as root - this is for system-level security hardening only"
fi

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Configure firewall (UFW)
echo "🔥 Configuring firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 3. Configure SSH security
echo "🔑 Hardening SSH configuration..."
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Create secure SSH config
sudo tee /etc/ssh/sshd_config.d/99-security.conf > /dev/null <<EOF
# Security hardening
Protocol 2
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowUsers $USER
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
EOF

# 4. Configure fail2ban for intrusion prevention
echo "🛡️ Installing and configuring fail2ban..."
sudo apt install -y fail2ban

sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
backend = systemd

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
findtime = 600
bantime = 7200
EOF

# 5. Set up automatic security updates
echo "🔄 Configuring automatic security updates..."
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 6. Configure secure file permissions
echo "📋 Setting secure file permissions..."
chmod 600 .env 2>/dev/null || echo "⚠️ .env file not found - will be created during deployment"
chmod 700 ssl/ 2>/dev/null || mkdir -p ssl && chmod 700 ssl/
chmod 600 ssl/* 2>/dev/null || echo "⚠️ SSL certificates not found - place them in ssl/ directory"
chmod 750 scripts/
chmod +x scripts/*.sh

# 7. Configure system resource limits
echo "⚙️ Configuring system resource limits..."
sudo tee -a /etc/security/limits.conf > /dev/null <<EOF
# KILT Liquidity Portal limits
$USER soft nofile 65536
$USER hard nofile 65536
$USER soft nproc 32768
$USER hard nproc 32768
EOF

# 8. Setup log monitoring
echo "📝 Setting up log monitoring..."
sudo apt install -y logwatch

# Configure logwatch for daily reports
sudo tee /etc/logwatch/conf/logwatch.conf > /dev/null <<EOF
LogDir = /var/log
MailTo = admin@kilt.io
MailFrom = server@kilt.io
Default = Low
Detail = Med
Service = All
Range = yesterday
Format = html
EOF

# 9. Install and configure AppArmor (additional security layer)
echo "🛡️ Installing AppArmor..."
sudo apt install -y apparmor apparmor-utils

# 10. Configure kernel security parameters
echo "⚙️ Hardening kernel parameters..."
sudo tee /etc/sysctl.d/99-security.conf > /dev/null <<EOF
# Network security
net.ipv4.tcp_syncookies = 1
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Memory protection
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.yama.ptrace_scope = 1

# File system protection
fs.suid_dumpable = 0
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
EOF

# Apply sysctl settings
sudo sysctl -p /etc/sysctl.d/99-security.conf

# 11. Setup file integrity monitoring (AIDE)
echo "🔍 Installing AIDE for file integrity monitoring..."
sudo apt install -y aide
sudo aideinit
sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Schedule daily integrity checks
echo "0 3 * * * /usr/bin/aide --check" | sudo crontab -u root -

# 12. Configure secure Node.js environment
echo "🟢 Securing Node.js environment..."

# Create security-focused PM2 configuration
tee ecosystem.security.config.js > /dev/null <<EOF
module.exports = {
  apps: [{
    name: 'kilt-liquidity-portal',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      // Security headers
      FORCE_HTTPS: 'true',
      HSTS_MAX_AGE: '31536000',
      // Rate limiting
      RATE_LIMIT_WINDOW: '900000',
      RATE_LIMIT_MAX: '100'
    },
    // Security settings
    uid: '$USER',
    gid: '$USER',
    cwd: '$(pwd)',
    // Resource limits
    max_restarts: 5,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};
EOF

# 13. Create security audit script
tee scripts/security-audit.sh > /dev/null <<'EOF'
#!/bin/bash
echo "🔒 Running security audit..."

echo "1. Checking for security updates..."
apt list --upgradable 2>/dev/null | grep -i security || echo "No security updates available"

echo "2. Checking open ports..."
sudo netstat -tlnp

echo "3. Checking failed login attempts..."
sudo journalctl _SYSTEMD_UNIT=sshd.service | grep "Failed password" | tail -10

echo "4. Checking firewall status..."
sudo ufw status verbose

echo "5. Checking file permissions..."
find . -name "*.env*" -exec ls -la {} \;
find ssl/ -exec ls -la {} \; 2>/dev/null || echo "SSL directory not found"

echo "6. Checking for world-writable files..."
find /home/$USER -type f -perm -002 2>/dev/null | head -10

echo "7. Checking system resource usage..."
free -h
df -h

echo "✅ Security audit completed"
EOF

chmod +x scripts/security-audit.sh

# 14. Restart services
echo "🔄 Restarting security services..."
sudo systemctl restart sshd
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

echo ""
echo "🎉 Security hardening completed!"
echo ""
echo "⚠️ IMPORTANT POST-SETUP STEPS:"
echo "1. Restart your SSH session to apply SSH config changes"
echo "2. Test SSH access before closing current session"
echo "3. Place SSL certificates in ssl/cert.pem and ssl/key.pem"
echo "4. Configure .env file with production values"
echo "5. Run security audit: ./scripts/security-audit.sh"
echo "6. Set up monitoring alerts"
echo ""
echo "🔒 Your server is now significantly more secure!"
echo "📧 Configure logwatch email in /etc/logwatch/conf/logwatch.conf"
echo "🔍 Run daily security audits with: ./scripts/security-audit.sh"