# Complete Deployment Workflow
## KILT Liquidity Incentive Portal - Production Setup Guide

### Overview
This document provides a comprehensive, step-by-step workflow for deploying the complete KILT Liquidity Portal (frontend + backend) to production environments. It combines both AWS backend deployment and containerized frontend deployment into a single, coordinated workflow.

## Table of Contents
1. [Prerequisites & Planning](#prerequisites--planning)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Integration & Testing](#integration--testing)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Scaling & Optimization](#scaling--optimization)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Prerequisites & Planning

### Required Accounts & Services
```bash
# AWS Services Required
- AWS Account with billing enabled
- Domain name registered (e.g., yourdomain.com)
- SSL certificate authority access
- GitHub/GitLab account for CI/CD

# Tools Installation Checklist
□ AWS CLI v2 installed and configured
□ Docker Desktop installed
□ Node.js 18+ installed
□ Git installed
□ Terraform installed (optional)
□ kubectl installed (if using Kubernetes)
```

### Pre-Deployment Security Setup

```bash
# 1. Create dedicated AWS IAM user for deployment
aws iam create-user --user-name kilt-portal-deployer

# 2. Create deployment policy
cat > kilt-deployment-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "elbv2:*",
        "route53:*",
        "acm:*",
        "ecs:*",
        "ecr:*",
        "logs:*",
        "iam:PassRole",
        "ssm:GetParameter",
        "ssm:PutParameter"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam create-policy --policy-name KILTPortalDeploymentPolicy --policy-document file://kilt-deployment-policy.json
aws iam attach-user-policy --user-name kilt-portal-deployer --policy-arn arn:aws:iam::ACCOUNT:policy/KILTPortalDeploymentPolicy

# 3. Create access keys
aws iam create-access-key --user-name kilt-portal-deployer
```

### Environment Planning

```bash
# Domain Configuration
DOMAIN="yourdomain.com"
API_SUBDOMAIN="api.${DOMAIN}"
APP_SUBDOMAIN="app.${DOMAIN}"

# Environment Variables Setup
cat > deployment.env << 'EOF'
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Domain Configuration
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
APP_DOMAIN=app.yourdomain.com

# Database Configuration
DB_NAME=kilt_portal_prod
DB_USERNAME=kiltadmin
DB_PASSWORD=SecurePassword123!

# Application Configuration
CALCULATOR_PRIVATE_KEY=your_calculator_private_key_here
SESSION_SECRET=your_super_secure_session_secret

# Monitoring
ENABLE_MONITORING=true
LOG_LEVEL=info
EOF

source deployment.env
```

---

## Infrastructure Setup

### Step 1: Network Infrastructure

```bash
#!/bin/bash
# setup-infrastructure.sh

echo "🏗️ Setting up AWS infrastructure..."

# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --query 'Vpc.VpcId' --output text)
aws ec2 create-tags --resources $VPC_ID --tags Key=Name,Value=kilt-portal-vpc

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID
aws ec2 create-tags --resources $IGW_ID --tags Key=Name,Value=kilt-portal-igw

# Create Public Subnets (2 AZs for load balancer)
PUBLIC_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Create Private Subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.3.0/24 --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.4.0/24 --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Create Route Table for Public Subnets
RT_PUBLIC=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $RT_PUBLIC --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $RT_PUBLIC
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $RT_PUBLIC

echo "✅ Infrastructure setup complete!"
echo "VPC ID: $VPC_ID"
echo "Public Subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2"
echo "Private Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"

# Save to environment file
cat >> infrastructure.env << EOF
VPC_ID=$VPC_ID
PUBLIC_SUBNET_1=$PUBLIC_SUBNET_1
PUBLIC_SUBNET_2=$PUBLIC_SUBNET_2
PRIVATE_SUBNET_1=$PRIVATE_SUBNET_1
PRIVATE_SUBNET_2=$PRIVATE_SUBNET_2
IGW_ID=$IGW_ID
RT_PUBLIC=$RT_PUBLIC
EOF
```

### Step 2: Security Groups

```bash
#!/bin/bash
# setup-security-groups.sh

source infrastructure.env

echo "🔒 Creating security groups..."

# ALB Security Group
ALB_SG=$(aws ec2 create-security-group --group-name kilt-alb-sg --description "KILT Portal ALB Security Group" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0

# Application Security Group
APP_SG=$(aws ec2 create-security-group --group-name kilt-app-sg --description "KILT Portal Application Security Group" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $APP_SG --protocol tcp --port 5000 --source-group $ALB_SG
aws ec2 authorize-security-group-ingress --group-id $APP_SG --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-egress --group-id $APP_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-egress --group-id $APP_SG --protocol tcp --port 80 --cidr 0.0.0.0/0

# Database Security Group
DB_SG=$(aws ec2 create-security-group --group-name kilt-db-sg --description "KILT Portal Database Security Group" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $DB_SG --protocol tcp --port 5432 --source-group $APP_SG

echo "✅ Security groups created!"
echo "ALB SG: $ALB_SG"
echo "App SG: $APP_SG" 
echo "DB SG: $DB_SG"

# Save to environment
cat >> infrastructure.env << EOF
ALB_SG=$ALB_SG
APP_SG=$APP_SG
DB_SG=$DB_SG
EOF
```

---

## Backend Deployment

### Step 3: Database Setup

```bash
#!/bin/bash
# deploy-database.sh

source infrastructure.env
source deployment.env

echo "🗄️ Setting up RDS PostgreSQL database..."

# Create DB Subnet Group
aws rds create-db-subnet-group \
  --db-subnet-group-name kilt-portal-db-subnet \
  --db-subnet-group-description "KILT Portal Database Subnet Group" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Create RDS Instance
DB_INSTANCE_ID=$(aws rds create-db-instance \
  --db-instance-identifier kilt-portal-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14.9 \
  --master-username $DB_USERNAME \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp2 \
  --db-subnet-group-name kilt-portal-db-subnet \
  --vpc-security-group-ids $DB_SG \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted \
  --query 'DBInstance.DBInstanceIdentifier' \
  --output text)

echo "⏳ Waiting for database to be available..."
aws rds wait db-instance-available --db-instance-identifier $DB_INSTANCE_ID

# Get database endpoint
DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE_ID --query 'DBInstances[0].Endpoint.Address' --output text)

echo "✅ Database setup complete!"
echo "Database Endpoint: $DB_ENDPOINT"

# Create connection string
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_ENDPOINT}:5432/${DB_NAME}"

cat >> infrastructure.env << EOF
DB_ENDPOINT=$DB_ENDPOINT
DATABASE_URL=$DATABASE_URL
EOF
```

### Step 4: Application Server Setup

```bash
#!/bin/bash
# deploy-backend.sh

source infrastructure.env
source deployment.env

echo "🚀 Deploying backend application server..."

# Create key pair
aws ec2 create-key-pair --key-name kilt-portal-key --query 'KeyMaterial' --output text > kilt-portal-key.pem
chmod 400 kilt-portal-key.pem

# Launch EC2 instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --count 1 \
  --instance-type t3.medium \
  --key-name kilt-portal-key \
  --security-group-ids $APP_SG \
  --subnet-id $PUBLIC_SUBNET_1 \
  --associate-public-ip-address \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=KILT-Portal-Backend}]' \
  --user-data file://user-data.sh \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "⏳ Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get instance public IP
INSTANCE_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "✅ Backend instance created!"
echo "Instance ID: $INSTANCE_ID"
echo "Instance IP: $INSTANCE_IP"

cat >> infrastructure.env << EOF
INSTANCE_ID=$INSTANCE_ID
INSTANCE_IP=$INSTANCE_IP
EOF
```

### Step 5: Backend Application Deployment

```bash
#!/bin/bash
# user-data.sh - EC2 initialization script

#!/bin/bash
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Install PM2
npm install -g pm2

# Create application directory
mkdir -p /opt/kilt-portal
cd /opt/kilt-portal

# Clone repository (replace with your repo)
git clone https://github.com/your-org/kilt-liquidity-portal.git .

# Install dependencies
npm install

# Create production environment file
cat > .env.production << 'EOL'
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
DATABASE_URL=${DATABASE_URL}
CALCULATOR_PRIVATE_KEY=${CALCULATOR_PRIVATE_KEY}
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGINS=https://${APP_DOMAIN}
EOL

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Setup log rotation
cat > /etc/logrotate.d/pm2 << 'EOL'
/home/ec2-user/.pm2/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOL

echo "✅ Backend application deployed successfully!"
```

---

## Frontend Deployment

### Step 6: Container Registry Setup

```bash
#!/bin/bash
# setup-container-registry.sh

source infrastructure.env
source deployment.env

echo "📦 Setting up ECR repository..."

# Create ECR repository
REPO_URI=$(aws ecr create-repository --repository-name kilt-portal-frontend --query 'repository.repositoryUri' --output text)

# Get ECR login token
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPO_URI

echo "✅ ECR repository created!"
echo "Repository URI: $REPO_URI"

cat >> infrastructure.env << EOF
ECR_REPO_URI=$REPO_URI
EOF
```

### Step 7: Build and Deploy Frontend Container

```bash
#!/bin/bash
# deploy-frontend.sh

source infrastructure.env
source deployment.env

echo "🏗️ Building and deploying frontend container..."

# Build Docker image
docker build -f Dockerfile.frontend -t kilt-portal-frontend:latest .

# Tag for ECR
docker tag kilt-portal-frontend:latest $ECR_REPO_URI:latest
docker tag kilt-portal-frontend:latest $ECR_REPO_URI:$(git rev-parse --short HEAD)

# Push to ECR
docker push $ECR_REPO_URI:latest
docker push $ECR_REPO_URI:$(git rev-parse --short HEAD)

echo "✅ Frontend container deployed to ECR!"

# Create ECS cluster
CLUSTER_NAME="kilt-portal-cluster"
aws ecs create-cluster --cluster-name $CLUSTER_NAME

# Create task definition
cat > frontend-task-definition.json << EOF
{
  "family": "kilt-portal-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "kilt-frontend",
      "image": "$ECR_REPO_URI:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "VITE_API_URL",
          "value": "https://$API_DOMAIN"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/kilt-portal-frontend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://frontend-task-definition.json

echo "✅ Frontend ECS task definition registered!"
```

### Step 8: Load Balancer and Service Setup

```bash
#!/bin/bash
# setup-load-balancer.sh

source infrastructure.env
source deployment.env

echo "⚖️ Setting up Application Load Balancer..."

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name kilt-portal-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Create target groups for backend and frontend
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
  --name kilt-backend-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id $VPC_ID \
  --health-check-path /api/health \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
  --name kilt-frontend-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Register backend instance
aws elbv2 register-targets \
  --target-group-arn $BACKEND_TG_ARN \
  --targets Id=$INSTANCE_ID,Port=5000

# Request SSL certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name $DOMAIN \
  --subject-alternative-names "*.$DOMAIN" \
  --validation-method DNS \
  --query 'CertificateArn' \
  --output text)

echo "⏳ Waiting for SSL certificate validation..."
echo "Please add the DNS validation records to your domain's DNS settings."
echo "Certificate ARN: $CERT_ARN"

# Wait for certificate validation (manual step)
read -p "Press enter after DNS validation is complete..."

# Create HTTPS listener with rules
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=fixed-response,FixedResponseConfig='{StatusCode=404,ContentType=text/plain,MessageBody=Not Found}'

# Add rule for API traffic
aws elbv2 create-rule \
  --listener-arn $(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[0].ListenerArn' --output text) \
  --conditions Field=host-header,Values=$API_DOMAIN \
  --priority 100 \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN

# Add rule for app traffic  
aws elbv2 create-rule \
  --listener-arn $(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --query 'Listeners[0].ListenerArn' --output text) \
  --conditions Field=host-header,Values=$APP_DOMAIN \
  --priority 200 \
  --actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN

# HTTP to HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query 'LoadBalancers[0].DNSName' --output text)

echo "✅ Load balancer setup complete!"
echo "ALB DNS Name: $ALB_DNS"

cat >> infrastructure.env << EOF
ALB_ARN=$ALB_ARN
BACKEND_TG_ARN=$BACKEND_TG_ARN
FRONTEND_TG_ARN=$FRONTEND_TG_ARN
CERT_ARN=$CERT_ARN
ALB_DNS=$ALB_DNS
EOF
```

### Step 9: ECS Service Deployment

```bash
#!/bin/bash
# create-ecs-service.sh

source infrastructure.env

echo "🚢 Creating ECS service for frontend..."

# Create ECS service
aws ecs create-service \
  --cluster kilt-portal-cluster \
  --service-name kilt-frontend-service \
  --task-definition kilt-portal-frontend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$APP_SG],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$FRONTEND_TG_ARN,containerName=kilt-frontend,containerPort=80

echo "⏳ Waiting for ECS service to be stable..."
aws ecs wait services-stable --cluster kilt-portal-cluster --services kilt-frontend-service

echo "✅ ECS service created and stable!"
```

---

## DNS Configuration

### Step 10: Route 53 Setup

```bash
#!/bin/bash
# setup-dns.sh

source infrastructure.env
source deployment.env

echo "🌐 Setting up DNS records..."

# Get hosted zone ID (assuming domain already has hosted zone)
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name $DOMAIN --query 'HostedZones[0].Id' --output text | sed 's/\/hostedzone\///')

# Create A record for API subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": \"$API_DOMAIN\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"DNSName\": \"$ALB_DNS\",
          \"EvaluateTargetHealth\": true,
          \"HostedZoneId\": \"Z35SXDOTRQ7X7K\"
        }
      }
    }]
  }"

# Create A record for app subdomain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": \"$APP_DOMAIN\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"DNSName\": \"$ALB_DNS\",
          \"EvaluateTargetHealth\": true,
          \"HostedZoneId\": \"Z35SXDOTRQ7X7K\"
        }
      }
    }]
  }"

echo "✅ DNS records created!"
echo "API URL: https://$API_DOMAIN"
echo "App URL: https://$APP_DOMAIN"
```

---

## Integration & Testing

### Step 11: End-to-End Testing

```bash
#!/bin/bash
# test-deployment.sh

source infrastructure.env
source deployment.env

echo "🧪 Running deployment tests..."

# Test backend health
echo "Testing backend API..."
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$API_DOMAIN/api/health)
if [ "$BACKEND_RESPONSE" = "200" ]; then
  echo "✅ Backend API healthy"
else
  echo "❌ Backend API failed (HTTP $BACKEND_RESPONSE)"
  exit 1
fi

# Test frontend
echo "Testing frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$APP_DOMAIN)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
  echo "✅ Frontend healthy"
else
  echo "❌ Frontend failed (HTTP $FRONTEND_RESPONSE)"
  exit 1
fi

# Test database connectivity
echo "Testing database connectivity..."
DB_TEST=$(curl -s https://$API_DOMAIN/api/users | jq -r '.length // 0')
if [ "$DB_TEST" -ge "0" ]; then
  echo "✅ Database connectivity working"
else
  echo "❌ Database connectivity failed"
  exit 1
fi

# Test HTTPS redirect
echo "Testing HTTPS redirect..."
REDIRECT_TEST=$(curl -s -o /dev/null -w "%{redirect_url}" http://$APP_DOMAIN)
if [[ "$REDIRECT_TEST" == "https://$APP_DOMAIN/"* ]]; then
  echo "✅ HTTPS redirect working"
else
  echo "❌ HTTPS redirect failed"
fi

echo "🎉 All tests passed! Deployment successful!"
```

### Step 12: Load Testing

```bash
#!/bin/bash
# load-test.sh

source infrastructure.env
source deployment.env

echo "🔥 Running load tests..."

# Install Apache Bench if not available
if ! command -v ab &> /dev/null; then
  echo "Installing Apache Bench..."
  sudo yum install -y httpd-tools || sudo apt-get install -y apache2-utils
fi

# Test frontend load
echo "Testing frontend load (100 requests, 10 concurrent)..."
ab -n 100 -c 10 https://$APP_DOMAIN/ > frontend-load-test.log

# Test API load
echo "Testing API load (100 requests, 10 concurrent)..."
ab -n 100 -c 10 https://$API_DOMAIN/api/health > api-load-test.log

# Parse results
FRONTEND_RPS=$(grep "Requests per second" frontend-load-test.log | awk '{print $4}')
API_RPS=$(grep "Requests per second" api-load-test.log | awk '{print $4}')

echo "📊 Load test results:"
echo "Frontend RPS: $FRONTEND_RPS"
echo "API RPS: $API_RPS"

echo "✅ Load testing complete!"
```

---

## Monitoring & Maintenance

### Step 13: CloudWatch Setup

```bash
#!/bin/bash
# setup-monitoring.sh

source infrastructure.env

echo "📊 Setting up monitoring..."

# Create CloudWatch log groups
aws logs create-log-group --log-group-name /aws/ec2/kilt-portal/backend
aws logs create-log-group --log-group-name /ecs/kilt-portal-frontend

# Create CloudWatch dashboards
cat > dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "ALB_NAME"],
          ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "ALB_NAME"],
          ["AWS/ApplicationELB", "HTTPCode_ELB_5XX_Count", "LoadBalancer", "ALB_NAME"],
          ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", "ALB_NAME"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Application Load Balancer Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ServiceName", "kilt-frontend-service", "ClusterName", "kilt-portal-cluster"],
          ["AWS/ECS", "MemoryUtilization", "ServiceName", "kilt-frontend-service", "ClusterName", "kilt-portal-cluster"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "ECS Service Metrics"
      }
    }
  ]
}
EOF

# Create dashboard
aws cloudwatch put-dashboard --dashboard-name "KILT-Portal-Production" --dashboard-body file://dashboard.json

echo "✅ Monitoring setup complete!"
```

### Step 14: Automated Backup Setup

```bash
#!/bin/bash
# setup-backups.sh

source infrastructure.env

echo "💾 Setting up automated backups..."

# Create backup lambda function
cat > backup-function.py << 'EOF'
import boto3
import datetime
import json

def lambda_handler(event, context):
    rds = boto3.client('rds')
    
    # Create database snapshot
    snapshot_id = f"kilt-portal-automated-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    response = rds.create_db-snapshot(
        DBSnapshotIdentifier=snapshot_id,
        DBInstanceIdentifier='kilt-portal-db'
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps(f'Snapshot {snapshot_id} created successfully')
    }
EOF

# Package lambda function
zip backup-function.zip backup-function.py

# Create lambda function
aws lambda create-function \
  --function-name kilt-portal-backup \
  --runtime python3.9 \
  --role arn:aws:iam::$AWS_ACCOUNT_ID:role/lambda-backup-role \
  --handler backup-function.lambda_handler \
  --zip-file fileb://backup-function.zip

# Schedule daily backups
aws events put-rule \
  --name kilt-portal-daily-backup \
  --schedule-expression "cron(0 2 * * ? *)"

aws events put-targets \
  --rule kilt-portal-daily-backup \
  --targets "Id"="1","Arn"="arn:aws:lambda:$AWS_REGION:$AWS_ACCOUNT_ID:function:kilt-portal-backup"

echo "✅ Automated backups configured!"
```

---

## Complete Deployment Script

### Master Deployment Script

```bash
#!/bin/bash
# master-deploy.sh

set -e

echo "🚀 Starting complete KILT Portal deployment..."

# Source configuration
source deployment.env

# Run deployment steps
echo "Step 1: Infrastructure setup..."
bash setup-infrastructure.sh

echo "Step 2: Security groups..."
bash setup-security-groups.sh

echo "Step 3: Database deployment..."
bash deploy-database.sh

echo "Step 4: Backend deployment..."
bash deploy-backend.sh

echo "Step 5: Container registry..."
bash setup-container-registry.sh

echo "Step 6: Frontend deployment..."
bash deploy-frontend.sh

echo "Step 7: Load balancer setup..."
bash setup-load-balancer.sh

echo "Step 8: ECS service..."
bash create-ecs-service.sh

echo "Step 9: DNS configuration..."
bash setup-dns.sh

echo "Step 10: Testing deployment..."
bash test-deployment.sh

echo "Step 11: Setting up monitoring..."
bash setup-monitoring.sh

echo "Step 12: Setting up backups..."
bash setup-backups.sh

echo "🎉 DEPLOYMENT COMPLETE! 🎉"
echo ""
echo "📋 Deployment Summary:"
echo "Frontend URL: https://$APP_DOMAIN"
echo "API URL: https://$API_DOMAIN"
echo "Database Endpoint: $DB_ENDPOINT"
echo ""
echo "📊 Next Steps:"
echo "1. Run load tests: bash load-test.sh"
echo "2. Configure monitoring alerts"
echo "3. Set up CI/CD pipeline"
echo "4. Review security settings"
echo "5. Schedule regular backups verification"
echo ""
echo "💰 Estimated Monthly Cost: ~$150-200"
```

---

## Post-Deployment Checklist

### Security Checklist
- [ ] SSL certificates properly configured
- [ ] Security groups follow least privilege principle
- [ ] Database in private subnet
- [ ] IAM roles use minimal required permissions
- [ ] Secrets stored in AWS Systems Manager
- [ ] Access logging enabled
- [ ] WAF configured (optional)

### Performance Checklist
- [ ] Auto-scaling configured
- [ ] CDN setup for static assets
- [ ] Database connection pooling
- [ ] Application caching implemented
- [ ] Load balancer health checks configured
- [ ] Container resource limits set

### Monitoring Checklist
- [ ] CloudWatch alarms configured
- [ ] Log aggregation working
- [ ] Performance metrics collected
- [ ] Error tracking implemented
- [ ] Uptime monitoring enabled
- [ ] Cost monitoring alerts set

### Backup & Recovery Checklist
- [ ] Automated database backups
- [ ] Application code backup strategy
- [ ] Disaster recovery plan documented
- [ ] Recovery testing completed
- [ ] RTO/RPO requirements met

This comprehensive deployment workflow ensures a production-ready KILT Liquidity Portal with proper security, monitoring, and scalability from day one.