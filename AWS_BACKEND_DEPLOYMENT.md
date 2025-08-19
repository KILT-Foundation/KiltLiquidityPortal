# AWS Backend Deployment Guide
## KILT Liquidity Incentive Portal - Production Backend Setup

### Overview
This guide provides step-by-step instructions for deploying the KILT Liquidity Portal backend to AWS using EC2, RDS, and other AWS services for a production-ready environment.

## Prerequisites

### Required AWS Services
- **EC2**: Application server hosting
- **RDS PostgreSQL**: Database hosting
- **Application Load Balancer (ALB)**: Traffic distribution
- **Route 53**: DNS management
- **Certificate Manager**: SSL/TLS certificates
- **CloudWatch**: Monitoring and logging
- **Systems Manager**: Parameter store for secrets

### Required Tools
- AWS CLI v2
- Node.js 18+ 
- PM2 (Process Manager)
- Git
- Docker (optional)

## Architecture Overview

```
Internet → Route 53 → ALB → EC2 Instance(s) → RDS PostgreSQL
                              ↓
                         CloudWatch Logs
```

## Step 1: Database Setup (RDS PostgreSQL)

### 1.1 Create RDS Instance

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name kilt-portal-db-subnet \
  --db-subnet-group-description "KILT Portal Database Subnet Group" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier kilt-portal-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14.9 \
  --master-username kiltadmin \
  --master-user-password 'YourSecurePassword123!' \
  --allocated-storage 20 \
  --storage-type gp2 \
  --db-subnet-group-name kilt-portal-db-subnet \
  --vpc-security-group-ids sg-xxxxx \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted
```

### 1.2 Configure Security Group for RDS

```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name kilt-portal-db-sg \
  --description "KILT Portal Database Security Group" \
  --vpc-id vpc-xxxxx

# Allow PostgreSQL access from application servers only
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-yyyyy  # Application server security group
```

### 1.3 Database Connection String
```
DATABASE_URL=postgresql://kiltadmin:YourSecurePassword123!@kilt-portal-db.xxxxx.us-east-1.rds.amazonaws.com:5432/kilt_portal
```

## Step 2: EC2 Instance Setup

### 2.1 Launch EC2 Instance

```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name kilt-portal-key \
  --query 'KeyMaterial' \
  --output text > kilt-portal-key.pem

chmod 400 kilt-portal-key.pem

# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --count 1 \
  --instance-type t3.medium \
  --key-name kilt-portal-key \
  --security-group-ids sg-xxxxx \
  --subnet-id subnet-xxxxx \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=KILT-Portal-Backend}]'
```

### 2.2 Security Group for Application Server

```bash
# Create application server security group
aws ec2 create-security-group \
  --group-name kilt-portal-app-sg \
  --description "KILT Portal Application Security Group" \
  --vpc-id vpc-xxxxx

# Allow HTTP from ALB
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 5000 \
  --source-group sg-alb-xxxxx

# Allow SSH for management
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Allow HTTPS outbound for API calls
aws ec2 authorize-security-group-egress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

## Step 3: Application Deployment

### 3.1 Connect to EC2 Instance

```bash
ssh -i kilt-portal-key.pem ec2-user@YOUR-EC2-PUBLIC-IP
```

### 3.2 Install Dependencies

```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo yum install -y git

# Create application directory
sudo mkdir -p /opt/kilt-portal
sudo chown ec2-user:ec2-user /opt/kilt-portal
```

### 3.3 Deploy Application Code

```bash
cd /opt/kilt-portal

# Clone repository (replace with your repository URL)
git clone https://github.com/your-org/kilt-liquidity-portal.git .

# Install dependencies
npm install

# Build application
npm run build
```

### 3.4 Environment Configuration

Create production environment file:

```bash
# Create environment file
cat > .env.production << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://kiltadmin:YourSecurePassword123!@kilt-portal-db.xxxxx.us-east-1.rds.amazonaws.com:5432/kilt_portal

# Server Configuration
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Smart Contract Configuration
CALCULATOR_PRIVATE_KEY=your_calculator_private_key_here

# API Keys (store in AWS Systems Manager Parameter Store)
COINGECKO_API_KEY=your_coingecko_api_key
DEXSCREENER_API_KEY=your_dexscreener_api_key

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Session Configuration
SESSION_SECRET=your_super_secure_session_secret_here

# Blockchain Configuration
BASE_RPC_URL=https://mainnet.base.org
BACKUP_RPC_URLS=https://base.blockpi.network/v1/rpc/public,https://base.drpc.org

# Admin Configuration
ADMIN_WALLETS=0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e,0x861722f739539CF31d86F1221460Fa96C9baB95C
EOF

# Set proper permissions
chmod 600 .env.production
```

### 3.5 Database Migration

```bash
# Run database migrations
npm run db:push

# Verify database connection
node -e "
const { db } = require('./server/db');
db.select().from('users').limit(1).then(() => {
  console.log('✅ Database connection successful');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database connection failed:', err);
  process.exit(1);
});
"
```

## Step 4: Process Management with PM2

### 4.1 PM2 Configuration

Create PM2 ecosystem file:

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kilt-portal-backend',
    script: 'server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '.env.production',
    error_file: '/var/log/pm2/kilt-portal-error.log',
    out_file: '/var/log/pm2/kilt-portal-out.log',
    log_file: '/var/log/pm2/kilt-portal-combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', '.git'],
    instance_var: 'INSTANCE_ID'
  }]
};
EOF
```

### 4.2 Start Application with PM2

```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown ec2-user:ec2-user /var/log/pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by PM2

# Check application status
pm2 status
pm2 logs kilt-portal-backend
```

## Step 5: Load Balancer Configuration

### 5.1 Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name kilt-portal-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-alb-xxxxx \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4

# Create target group
aws elbv2 create-target-group \
  --name kilt-portal-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# Register EC2 instance with target group
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/kilt-portal-tg/xxxxx \
  --targets Id=i-xxxxx,Port=5000
```

### 5.2 SSL Certificate Configuration

```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --subject-alternative-names *.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/kilt-portal-alb/xxxxx \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:region:account:certificate/xxxxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:region:account:targetgroup/kilt-portal-tg/xxxxx

# Redirect HTTP to HTTPS
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:region:account:loadbalancer/app/kilt-portal-alb/xxxxx \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

## Step 6: DNS Configuration

### 6.1 Route 53 Setup

```bash
# Create A record pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "kilt-portal-alb-xxxxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true,
          "HostedZoneId": "Z35SXDOTRQ7X7K"
        }
      }
    }]
  }'
```

## Step 7: Monitoring and Logging

### 7.1 CloudWatch Configuration

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
sudo rpm -U ./amazon-cloudwatch-agent.rpm

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/pm2/kilt-portal-combined.log",
            "log_group_name": "/aws/ec2/kilt-portal/application",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "KILT/Portal",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s
```

### 7.2 Application Health Monitoring

Create health check script:

```bash
cat > /opt/kilt-portal/health-check.sh << 'EOF'
#!/bin/bash
# KILT Portal Health Check Script

HEALTH_URL="http://localhost:5000/api/health"
LOG_FILE="/var/log/kilt-portal-health.log"

# Check application health
response=$(curl -s -w "%{http_code}" "$HEALTH_URL")
http_code="${response: -3}"

if [ "$http_code" = "200" ]; then
    echo "$(date): Health check PASSED" >> "$LOG_FILE"
    exit 0
else
    echo "$(date): Health check FAILED - HTTP $http_code" >> "$LOG_FILE"
    # Restart application if health check fails
    pm2 restart kilt-portal-backend
    exit 1
fi
EOF

chmod +x /opt/kilt-portal/health-check.sh

# Setup cron job for health monitoring
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/kilt-portal/health-check.sh") | crontab -
```

## Step 8: Security Configuration

### 8.1 Systems Manager Parameter Store

Store sensitive configuration in AWS Parameter Store:

```bash
# Store calculator private key
aws ssm put-parameter \
  --name "/kilt-portal/calculator-private-key" \
  --value "your_calculator_private_key_here" \
  --type "SecureString" \
  --description "Calculator wallet private key for KILT Portal"

# Store session secret
aws ssm put-parameter \
  --name "/kilt-portal/session-secret" \
  --value "your_super_secure_session_secret_here" \
  --type "SecureString" \
  --description "Session secret for KILT Portal"

# Update application to use Parameter Store
# Add to your application startup:
# const calculatorKey = await getParameter('/kilt-portal/calculator-private-key');
```

### 8.2 IAM Role Configuration

```bash
# Create IAM role for EC2 instance
aws iam create-role \
  --role-name KILTPortalEC2Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ec2.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name KILTPortalEC2Role \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

aws iam attach-role-policy \
  --role-name KILTPortalEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name KILTPortalEC2Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name KILTPortalEC2Profile \
  --role-name KILTPortalEC2Role
```

## Step 9: Backup and Disaster Recovery

### 9.1 Database Backups

```bash
# Enable automated backups (already configured in RDS creation)
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier kilt-portal-db \
  --db-snapshot-identifier kilt-portal-manual-snapshot-$(date +%Y%m%d)

# Create backup script
cat > /opt/kilt-portal/backup.sh << 'EOF'
#!/bin/bash
# Create daily manual snapshot
DATE=$(date +%Y%m%d)
aws rds create-db-snapshot \
  --db-instance-identifier kilt-portal-db \
  --db-snapshot-identifier kilt-portal-daily-$DATE

# Clean up old snapshots (keep 7 days)
CUTOFF_DATE=$(date -d '7 days ago' +%Y%m%d)
aws rds describe-db-snapshots \
  --db-instance-identifier kilt-portal-db \
  --snapshot-type manual \
  --query "DBSnapshots[?SnapshotCreateTime<='$CUTOFF_DATE'].DBSnapshotIdentifier" \
  --output text | xargs -n1 aws rds delete-db-snapshot --db-snapshot-identifier
EOF

chmod +x /opt/kilt-portal/backup.sh

# Schedule daily backup
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/kilt-portal/backup.sh") | crontab -
```

### 9.2 Application Code Backup

```bash
# Create deployment script for updates
cat > /opt/kilt-portal/deploy.sh << 'EOF'
#!/bin/bash
# KILT Portal Deployment Script

set -e

echo "Starting deployment..."

# Backup current version
cp -r /opt/kilt-portal /opt/kilt-portal-backup-$(date +%Y%m%d-%H%M%S)

# Pull latest changes
git fetch origin
git reset --hard origin/main

# Install dependencies
npm install

# Build application
npm run build

# Run migrations
npm run db:push

# Restart application
pm2 restart kilt-portal-backend

echo "Deployment completed successfully!"
EOF

chmod +x /opt/kilt-portal/deploy.sh
```

## Step 10: Performance Optimization

### 10.1 Database Optimization

```sql
-- Connect to RDS instance and run these optimizations
-- Enable connection pooling
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Restart database to apply changes
```

### 10.2 Application Optimization

```bash
# Update PM2 configuration for better performance
cat > ecosystem.config.production.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kilt-portal-backend',
    script: 'server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx --max-old-space-size=512',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      UV_THREADPOOL_SIZE: 128
    },
    env_file: '.env.production',
    node_args: '--max-old-space-size=512',
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
};
EOF
```

## Deployment Checklist

### Pre-Deployment
- [ ] RDS PostgreSQL instance created and configured
- [ ] EC2 instance launched with proper security groups
- [ ] Application Load Balancer configured
- [ ] SSL certificate obtained and configured
- [ ] DNS records created in Route 53
- [ ] Environment variables configured
- [ ] IAM roles and policies created

### Deployment
- [ ] Application code deployed to EC2
- [ ] Dependencies installed
- [ ] Database migrations executed
- [ ] PM2 process manager configured
- [ ] Application started and verified
- [ ] Health checks passing
- [ ] SSL certificate working

### Post-Deployment
- [ ] CloudWatch monitoring configured
- [ ] Backup strategy implemented
- [ ] Performance monitoring enabled
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Disaster recovery plan documented

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check security group rules
   aws ec2 describe-security-groups --group-ids sg-xxxxx
   
   # Test database connection
   psql -h kilt-portal-db.xxxxx.us-east-1.rds.amazonaws.com -U kiltadmin -d kilt_portal
   ```

2. **Application Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs kilt-portal-backend
   
   # Check system resources
   free -h
   df -h
   ```

3. **Load Balancer Health Check Failures**
   ```bash
   # Test health endpoint locally
   curl http://localhost:5000/api/health
   
   # Check target group health
   aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:...
   ```

## Estimated Costs

### Monthly AWS Costs (US East 1)
- **EC2 t3.medium**: ~$30/month
- **RDS db.t3.micro**: ~$15/month
- **Application Load Balancer**: ~$20/month
- **Data Transfer**: ~$5-10/month
- **CloudWatch**: ~$5/month
- **Route 53**: ~$1/month

**Total Estimated Monthly Cost**: ~$75-85/month

## Scaling Considerations

### Horizontal Scaling
- Add additional EC2 instances behind the load balancer
- Implement auto-scaling groups based on CPU/memory metrics
- Use RDS read replicas for read-heavy workloads

### Vertical Scaling
- Upgrade EC2 instance types (t3.large, t3.xlarge)
- Upgrade RDS instance types (db.t3.small, db.t3.medium)
- Increase allocated storage as needed

This completes the comprehensive AWS backend deployment guide for the KILT Liquidity Portal.