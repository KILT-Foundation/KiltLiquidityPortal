# 🚀 KILT Liquidity Portal - Production Deployment Guide

## Overview
This guide covers the complete production deployment of the KILT Liquidity Portal, including security hardening, monitoring, and maintenance procedures.

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] Production server provisioned (minimum 2GB RAM, 20GB storage)
- [ ] Node.js 20+ installed
- [ ] PostgreSQL database configured
- [ ] SSL certificates obtained (Let's Encrypt or commercial)
- [ ] Domain DNS configured (recommended: liq.kilt.io)
- [ ] Firewall configured (ports 80, 443, SSH only)

### Security Configuration
- [ ] Environment variables configured (use production.env.example)
- [ ] Database credentials secured
- [ ] Private keys stored securely (never in git)
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] CORS properly configured

### Application Configuration
- [ ] Build process tested
- [ ] Health checks verified
- [ ] Database migrations applied
- [ ] Smart contract addresses configured
- [ ] External API keys configured

## 🛠️ Deployment Steps

### 1. Server Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL client tools
sudo apt-get install -y postgresql-client

# Install nginx (optional, for reverse proxy)
sudo apt-get install -y nginx
```

### 2. Application Deployment
```bash
# Clone repository
git clone https://github.com/your-repo/kilt-liquidity-portal.git
cd kilt-liquidity-portal

# Run production setup script
chmod +x scripts/production-setup.sh
./scripts/production-setup.sh

# Configure environment
cp production.env.example .env
nano .env  # Fill in production values
```

### 3. SSL Certificate Setup
```bash
# Using Let's Encrypt (recommended)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d liq.kilt.io

# Or place your certificates
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem
```

### 4. Start Application
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Enable startup script
pm2 startup
pm2 save

# Verify health
./scripts/health-check.sh
```

## 🔧 Docker Deployment (Alternative)

### Using Docker Compose
```bash
# Configure environment
cp production.env.example .env
nano .env

# Build and start
docker-compose -f docker-compose.yml --profile production up -d

# Check logs
docker-compose logs -f
```

### Using Kubernetes (Advanced)
```bash
# Create ConfigMap for environment
kubectl create configmap kilt-config --from-env-file=.env

# Apply deployment manifests
kubectl apply -f k8s/
```

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Manual health check
./scripts/health-check.sh

# Automated monitoring (setup cron job)
crontab -e
# Add: */5 * * * * /path/to/scripts/health-check.sh > /var/log/kilt-health.log 2>&1
```

### Database Backups
```bash
# Manual backup
./scripts/backup-database.sh

# Automated backups (setup cron job)
crontab -e
# Add: 0 2 * * * /path/to/scripts/backup-database.sh > /var/log/kilt-backup.log 2>&1
```

### Log Management
```bash
# View application logs
pm2 logs kilt-liquidity-portal

# View nginx logs (if using)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Log rotation is automatically configured
```

## 🔄 Updates & Rollbacks

### Deploying Updates
```bash
# Pull latest code
git pull origin main

# Build new version
npm run build

# Reload application (zero-downtime)
pm2 reload kilt-liquidity-portal

# Verify deployment
./scripts/health-check.sh
```

### Emergency Rollback
```bash
# Rollback to previous version
git checkout previous-commit-hash
npm run build
pm2 reload kilt-liquidity-portal
```

## 🚨 Troubleshooting

### Common Issues

**Application Won't Start**
```bash
# Check logs
pm2 logs kilt-liquidity-portal

# Check environment variables
pm2 env 0

# Restart application
pm2 restart kilt-liquidity-portal
```

**Database Connection Issues**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database migrations
npm run db:push
```

**High Memory Usage**
```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart kilt-liquidity-portal
```

### Emergency Contacts
- **Technical Lead**: tech@kilt.io
- **DevOps**: ops@kilt.io
- **24/7 On-call**: +1-xxx-xxx-xxxx

## 📈 Performance Optimization

### Application Level
- ✅ Response caching enabled
- ✅ Database connection pooling
- ✅ Static file compression
- ✅ API rate limiting
- ✅ Error handling and recovery

### Server Level
- Configure swap file for memory management
- Enable nginx gzip compression
- Set up CDN for static assets
- Configure log rotation
- Monitor disk space usage

### Database Level
- Regular VACUUM and ANALYZE
- Monitor connection limits
- Set up read replicas if needed
- Configure backup strategy

## 🔒 Security Best Practices

### Application Security
- All secrets in environment variables (never in code)
- Input validation on all endpoints
- Rate limiting on API endpoints
- HTTPS enforced (HSTS headers)
- Security headers configured

### Server Security
- SSH key-based authentication only
- Firewall configured (UFW or iptables)
- Automatic security updates enabled
- Regular security audits
- Log monitoring for suspicious activity

### Database Security
- Database user with minimal privileges
- Connection encryption enabled
- Regular security patches
- Backup encryption
- Access logging enabled

## 📋 Maintenance Schedule

### Daily
- [ ] Check application logs for errors
- [ ] Verify health check status
- [ ] Monitor memory and CPU usage

### Weekly  
- [ ] Review performance metrics
- [ ] Check database health
- [ ] Verify backup integrity
- [ ] Security audit logs

### Monthly
- [ ] Update dependencies (security patches)
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review and rotate logs
- [ ] Performance optimization review
- [ ] Disaster recovery test

## 🎯 Success Metrics

### Availability
- **Target**: 99.9% uptime
- **Measurement**: Health check success rate
- **Alert**: < 99% uptime in 24h period

### Performance  
- **Target**: < 2s average response time
- **Measurement**: API response times
- **Alert**: > 5s average response time

### Security
- **Target**: Zero security incidents
- **Measurement**: Security audit logs
- **Alert**: Any suspicious activity

### User Experience
- **Target**: < 1% error rate
- **Measurement**: Application error logs
- **Alert**: > 2% error rate

---

**🚀 Your KILT Liquidity Portal is now production-ready!**

For questions or issues, contact the technical team or refer to the troubleshooting section above.