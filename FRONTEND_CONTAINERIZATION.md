# Frontend Containerization & Deployment Guide
## KILT Liquidity Incentive Portal - Frontend Container Setup

### Overview
This guide provides comprehensive instructions for containerizing the KILT Liquidity Portal frontend using Docker and deploying it to various cloud platforms including AWS ECS, Google Cloud Run, and Azure Container Instances.

## Prerequisites

### Required Tools
- Docker Desktop
- Docker Compose
- Node.js 18+
- AWS CLI / Google Cloud CLI / Azure CLI (depending on deployment target)
- Git

### Project Structure
```
kilt-liquidity-portal/
├── client/                 # React frontend source
├── server/                 # Backend source (separate deployment)
├── shared/                 # Shared types and schemas
├── Dockerfile.frontend     # Frontend container definition
├── docker-compose.yml      # Local development setup
├── nginx.conf             # Nginx configuration
└── .dockerignore          # Docker ignore patterns
```

## Step 1: Frontend Containerization

### 1.1 Create Frontend Dockerfile

```dockerfile
# Dockerfile.frontend
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the frontend
RUN npm run build:client

# Production stage with Nginx
FROM nginx:alpine

# Copy built files to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 1.2 Create Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        application/javascript
        application/json
        application/xml
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    server {
        listen 80;
        listen [::]:80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;
        
        # Enable browser caching for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, no-transform";
        }
        
        # Handle React Router (SPA)
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # API proxy to backend (if running same container)
        location /api/ {
            proxy_pass http://backend:5000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 1.3 Create Docker Ignore File

```dockerfile
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.nyc_output
coverage
.DS_Store
*.log
dist
build
.vscode
.idea
*.swp
*.swo
*~
```

### 1.4 Update Package.json Scripts

```json
{
  "scripts": {
    "build:client": "cd client && npm run build",
    "build:docker": "docker build -f Dockerfile.frontend -t kilt-portal-frontend .",
    "run:docker": "docker run -p 3000:80 --name kilt-frontend kilt-portal-frontend",
    "docker:dev": "docker-compose up --build"
  }
}
```

## Step 2: Multi-Container Setup with Docker Compose

### 2.1 Create Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL Database
  database:
    image: postgres:14-alpine
    container_name: kilt-postgres
    environment:
      POSTGRES_DB: kilt_portal
      POSTGRES_USER: kiltuser
      POSTGRES_PASSWORD: kiltpass123
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - kilt-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kiltuser -d kilt_portal"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: kilt-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://kiltuser:kiltpass123@database:5432/kilt_portal
      - PORT=5000
      - CALCULATOR_PRIVATE_KEY=${CALCULATOR_PRIVATE_KEY}
    ports:
      - "5000:5000"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - kilt-network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: kilt-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - kilt-network
    environment:
      - VITE_API_URL=http://localhost:5000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Redis for session storage (optional)
  redis:
    image: redis:7-alpine
    container_name: kilt-redis
    ports:
      - "6379:6379"
    networks:
      - kilt-network
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  kilt-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
```

### 2.2 Create Backend Dockerfile

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Change ownership of app directory
RUN chown -R backend:nodejs /app
USER backend

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
```

## Step 3: AWS ECS Deployment

### 3.1 Create ECS Task Definition

```json
{
  "family": "kilt-portal-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "kilt-frontend",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/kilt-portal-frontend:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "VITE_API_URL",
          "value": "https://api.yourdomain.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/kilt-portal-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 3.2 ECS Deployment Script

```bash
#!/bin/bash
# deploy-ecs.sh

set -e

# Configuration
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="kilt-portal-frontend"
ECS_CLUSTER="kilt-portal-cluster"
ECS_SERVICE="kilt-frontend-service"
IMAGE_TAG="latest"

echo "🚀 Starting ECS deployment..."

# Build and push Docker image to ECR
echo "📦 Building Docker image..."
docker build -f Dockerfile.frontend -t $ECR_REPOSITORY:$IMAGE_TAG .

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "🏷️ Tagging image..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "⬆️ Pushing image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

# Update ECS service
echo "🔄 Updating ECS service..."
aws ecs update-service \
  --cluster $ECS_CLUSTER \
  --service $ECS_SERVICE \
  --force-new-deployment

echo "⏳ Waiting for deployment to complete..."
aws ecs wait services-stable \
  --cluster $ECS_CLUSTER \
  --services $ECS_SERVICE

echo "✅ ECS deployment completed successfully!"
```

### 3.3 Create ECS Infrastructure with Terraform

```hcl
# terraform/ecs.tf
provider "aws" {
  region = var.aws_region
}

# ECR Repository
resource "aws_ecr_repository" "kilt_frontend" {
  name                 = "kilt-portal-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "kilt_portal" {
  name = "kilt-portal-cluster"

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Application Load Balancer
resource "aws_lb" "kilt_frontend" {
  name               = "kilt-frontend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false
}

# Target Group
resource "aws_lb_target_group" "kilt_frontend" {
  name        = "kilt-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

# ECS Service
resource "aws_ecs_service" "kilt_frontend" {
  name            = "kilt-frontend-service"
  cluster         = aws_ecs_cluster.kilt_portal.id
  task_definition = aws_ecs_task_definition.kilt_frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    security_groups = [aws_security_group.ecs_tasks.id]
    subnets         = var.private_subnet_ids
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.kilt_frontend.arn
    container_name   = "kilt-frontend"
    container_port   = 80
  }

  depends_on = [aws_lb_listener.kilt_frontend]
}
```

## Step 4: Google Cloud Run Deployment

### 4.1 Cloud Run Deployment Script

```bash
#!/bin/bash
# deploy-cloudrun.sh

set -e

# Configuration
PROJECT_ID="your-gcp-project-id"
SERVICE_NAME="kilt-portal-frontend"
REGION="us-central1"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Starting Google Cloud Run deployment..."

# Build and push to Google Container Registry
echo "📦 Building and pushing Docker image..."
gcloud builds submit --tag $IMAGE_NAME .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --port 80 \
  --set-env-vars "VITE_API_URL=https://api.yourdomain.com" \
  --min-instances 1 \
  --max-instances 10

echo "✅ Cloud Run deployment completed successfully!"

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo "🌐 Service URL: $SERVICE_URL"
```

### 4.2 Cloud Run Configuration File

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: kilt-portal-frontend
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/ingress-status: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "512Mi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containerConcurrency: 80
      containers:
      - image: gcr.io/PROJECT_ID/kilt-portal-frontend:latest
        ports:
        - containerPort: 80
        env:
        - name: VITE_API_URL
          value: "https://api.yourdomain.com"
        resources:
          limits:
            memory: "512Mi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Step 5: Azure Container Instances Deployment

### 5.1 Azure Container Instance Configuration

```yaml
# azure-container-group.yaml
apiVersion: 2019-12-01
location: eastus
name: kilt-portal-frontend
properties:
  containers:
  - name: kilt-frontend
    properties:
      image: your-registry.azurecr.io/kilt-portal-frontend:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 1
      ports:
      - port: 80
        protocol: TCP
      environmentVariables:
      - name: VITE_API_URL
        value: https://api.yourdomain.com
      livenessProbe:
        httpGet:
          path: /health
          port: 80
          scheme: Http
        initialDelaySeconds: 30
        periodSeconds: 30
      readinessProbe:
        httpGet:
          path: /health
          port: 80
          scheme: Http
        initialDelaySeconds: 5
        periodSeconds: 10
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 80
    dnsNameLabel: kilt-portal-frontend
tags:
  environment: production
  application: kilt-portal
type: Microsoft.ContainerInstance/containerGroups
```

### 5.2 Azure Deployment Script

```bash
#!/bin/bash
# deploy-azure.sh

set -e

# Configuration
RESOURCE_GROUP="kilt-portal-rg"
REGISTRY_NAME="kiltportalregistry"
IMAGE_NAME="kilt-portal-frontend"
CONTAINER_GROUP="kilt-frontend-group"
LOCATION="eastus"

echo "🚀 Starting Azure Container Instances deployment..."

# Build and push to Azure Container Registry
echo "📦 Building Docker image..."
docker build -f Dockerfile.frontend -t $IMAGE_NAME:latest .

echo "🔐 Logging in to ACR..."
az acr login --name $REGISTRY_NAME

echo "🏷️ Tagging image..."
docker tag $IMAGE_NAME:latest $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:latest

echo "⬆️ Pushing image to ACR..."
docker push $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:latest

# Deploy to Azure Container Instances
echo "🚀 Deploying to Azure Container Instances..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_GROUP \
  --image $REGISTRY_NAME.azurecr.io/$IMAGE_NAME:latest \
  --cpu 1 \
  --memory 1 \
  --registry-login-server $REGISTRY_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $REGISTRY_NAME --query username --output tsv) \
  --registry-password $(az acr credential show --name $REGISTRY_NAME --query passwords[0].value --output tsv) \
  --dns-name-label kilt-portal-frontend \
  --ports 80 \
  --environment-variables VITE_API_URL=https://api.yourdomain.com \
  --location $LOCATION

echo "✅ Azure deployment completed successfully!"

# Get container group details
FQDN=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_GROUP --query ipAddress.fqdn --output tsv)
echo "🌐 Frontend URL: http://$FQDN"
```

## Step 6: CI/CD Pipeline Configuration

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/frontend-deployment.yml
name: Frontend Deployment

on:
  push:
    branches: [main]
    paths: ['client/**', 'Dockerfile.frontend', 'nginx.conf']
  pull_request:
    branches: [main]
    paths: ['client/**', 'Dockerfile.frontend', 'nginx.conf']

env:
  IMAGE_NAME: kilt-portal-frontend

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        cd client && npm ci
    
    - name: Run tests
      run: |
        cd client && npm test -- --coverage --watchAll=false
    
    - name: Build application
      run: npm run build:client
    
    - name: Build Docker image
      run: docker build -f Dockerfile.frontend -t $IMAGE_NAME:${{ github.sha }} .
    
    - name: Run container security scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: '${{ env.IMAGE_NAME }}:${{ github.sha }}'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-aws:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Login to ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: kilt-portal-frontend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -f Dockerfile.frontend -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
    
    - name: Update ECS service
      run: |
        aws ecs update-service --cluster kilt-portal-cluster --service kilt-frontend-service --force-new-deployment
        aws ecs wait services-stable --cluster kilt-portal-cluster --services kilt-frontend-service

  deploy-gcp:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
    
    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Configure Docker for GCR
      run: gcloud auth configure-docker
    
    - name: Build and push Docker image
      env:
        PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
      run: |
        docker build -f Dockerfile.frontend -t gcr.io/$PROJECT_ID/$IMAGE_NAME:${{ github.sha }} .
        docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:${{ github.sha }}
        docker tag gcr.io/$PROJECT_ID/$IMAGE_NAME:${{ github.sha }} gcr.io/$PROJECT_ID/$IMAGE_NAME:latest
        docker push gcr.io/$PROJECT_ID/$IMAGE_NAME:latest
    
    - name: Deploy to Cloud Run
      env:
        PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
      run: |
        gcloud run deploy kilt-portal-frontend \
          --image gcr.io/$PROJECT_ID/$IMAGE_NAME:latest \
          --platform managed \
          --region us-central1 \
          --allow-unauthenticated \
          --memory 512Mi \
          --cpu 1
```

## Step 7: Monitoring and Logging

### 7.1 Application Monitoring

```javascript
// monitoring/frontend-monitoring.js
class FrontendMonitoring {
  constructor() {
    this.metrics = {
      pageViews: 0,
      apiCalls: 0,
      errors: 0,
      loadTime: 0
    };
  }

  // Track page views
  trackPageView(path) {
    this.metrics.pageViews++;
    this.sendMetric('page_view', { path });
  }

  // Track API calls
  trackApiCall(endpoint, duration, status) {
    this.metrics.apiCalls++;
    this.sendMetric('api_call', {
      endpoint,
      duration,
      status
    });
  }

  // Track errors
  trackError(error, context) {
    this.metrics.errors++;
    this.sendMetric('error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }

  // Send metrics to monitoring service
  sendMetric(type, data) {
    fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        data,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }).catch(err => {
      console.warn('Failed to send metric:', err);
    });
  }
}

// Initialize monitoring
const monitoring = new FrontendMonitoring();

// Track page views
window.addEventListener('popstate', () => {
  monitoring.trackPageView(window.location.pathname);
});

// Track errors
window.addEventListener('error', (event) => {
  monitoring.trackError(event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Track unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  monitoring.trackError(new Error(event.reason), {
    type: 'unhandled_promise_rejection'
  });
});

export default monitoring;
```

### 7.2 Logging Configuration

```dockerfile
# Add to Dockerfile.frontend for structured logging
FROM nginx:alpine

# Install curl for health checks and jq for log parsing
RUN apk add --no-cache curl jq

# Copy custom log format configuration
COPY nginx-logging.conf /etc/nginx/conf.d/logging.conf

# Copy log rotation configuration
COPY logrotate.conf /etc/logrotate.d/nginx

# Create log directory
RUN mkdir -p /var/log/nginx/structured

# Copy logging script
COPY scripts/process-logs.sh /usr/local/bin/process-logs.sh
RUN chmod +x /usr/local/bin/process-logs.sh

# Start log processor in background
CMD ["/bin/sh", "-c", "/usr/local/bin/process-logs.sh & nginx -g 'daemon off;'"]
```

## Step 8: Performance Optimization

### 8.1 Multi-stage Build Optimization

```dockerfile
# Optimized Dockerfile.frontend
FROM node:18-alpine as base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:client

FROM nginx:alpine as runtime
RUN apk add --no-cache curl
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Optimize for production
RUN gzip -9 -c /usr/share/nginx/html/index.html > /usr/share/nginx/html/index.html.gz
RUN find /usr/share/nginx/html -name "*.js" -exec gzip -9 -c {} \; -exec mv {}.gz {} \;
RUN find /usr/share/nginx/html -name "*.css" -exec gzip -9 -c {} \; -exec mv {}.gz {} \;

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 8.2 CDN Integration

```nginx
# nginx-cdn.conf - Enhanced configuration with CDN support
server {
    listen 80;
    server_name _;
    
    # CDN-friendly headers
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
        add_header Vary "Accept-Encoding";
        
        # CORS headers for CDN
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
        
        # Precompressed static assets
        gzip_static on;
    }
    
    # Service worker caching
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # API caching
    location /api/ {
        proxy_pass http://backend:5000/api/;
        proxy_cache_valid 200 5m;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] Docker images build successfully
- [ ] Container security scan passes
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] DNS configuration ready
- [ ] CDN configuration (if applicable)

### Deployment
- [ ] Container registry authentication working
- [ ] Images pushed to registry
- [ ] Container instances deployed
- [ ] Load balancer/ingress configured
- [ ] Health checks passing
- [ ] Auto-scaling configured

### Post-Deployment
- [ ] Monitoring and alerting configured
- [ ] Log aggregation working
- [ ] Performance metrics collected
- [ ] Backup strategy implemented
- [ ] Disaster recovery tested
- [ ] CI/CD pipeline validated

## Cost Optimization

### Container Resource Optimization
```yaml
# Optimized resource allocation
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Auto-scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kilt-frontend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kilt-frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Estimated Monthly Costs

### AWS ECS Fargate
- **2 vCPU, 1GB RAM, 2 instances**: ~$30/month
- **Application Load Balancer**: ~$20/month
- **Data Transfer**: ~$5-10/month
- **Total**: ~$55-60/month

### Google Cloud Run
- **1 vCPU, 512MB RAM**: ~$15-25/month
- **Data Transfer**: ~$5/month
- **Total**: ~$20-30/month

### Azure Container Instances
- **1 vCPU, 1GB RAM**: ~$35/month
- **Data Transfer**: ~$5/month
- **Total**: ~$40/month

This comprehensive guide covers all aspects of frontend containerization and deployment for the KILT Liquidity Portal across multiple cloud platforms.