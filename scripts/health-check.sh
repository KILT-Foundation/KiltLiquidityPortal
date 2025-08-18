#!/bin/bash
# Comprehensive Health Check Script

set -e

# Configuration
HOST=${HOST:-"localhost"}
PORT=${PORT:-"5000"}
PROTOCOL=${PROTOCOL:-"http"}
BASE_URL="$PROTOCOL://$HOST:$PORT"

echo "🏥 Running comprehensive health check for KILT Liquidity Portal"
echo "Target: $BASE_URL"
echo ""

# Test basic health endpoint
echo "1️⃣ Testing basic health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Basic health check passed"
else
    echo "❌ Basic health check failed (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

# Test system health endpoint
echo "2️⃣ Testing system health endpoint..."
SYSTEM_HEALTH=$(curl -s "$BASE_URL/api/system/health" | grep -o '"status":"healthy"' || echo "")
if [ ! -z "$SYSTEM_HEALTH" ]; then
    echo "✅ System health check passed"
else
    echo "❌ System health check failed"
    exit 1
fi

# Test deployment readiness
echo "3️⃣ Testing deployment readiness..."
DEPLOYMENT_READY=$(curl -s "$BASE_URL/api/system/deployment-readiness" | grep -o '"ready":true' || echo "")
if [ ! -z "$DEPLOYMENT_READY" ]; then
    echo "✅ Deployment readiness check passed"
else
    echo "❌ Deployment readiness check failed"
    exit 1
fi

# Test production validation
echo "4️⃣ Testing production validation..."
PRODUCTION_READY=$(curl -s "$BASE_URL/api/system/production-validation" | grep -o '"productionReady":true' || echo "")
if [ ! -z "$PRODUCTION_READY" ]; then
    echo "✅ Production validation passed"
else
    echo "❌ Production validation failed"
    exit 1
fi

# Test database connectivity
echo "5️⃣ Testing database connectivity..."
DB_STATUS=$(curl -s "$BASE_URL/api/system/health" | grep -o '"database":"connected"' || echo "")
if [ ! -z "$DB_STATUS" ]; then
    echo "✅ Database connectivity check passed"
else
    echo "❌ Database connectivity check failed"
    exit 1
fi

# Test API endpoints
echo "6️⃣ Testing critical API endpoints..."

# Test program analytics
ANALYTICS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/rewards/program-analytics")
if [ "$ANALYTICS_RESPONSE" = "200" ]; then
    echo "✅ Program analytics endpoint working"
else
    echo "❌ Program analytics endpoint failed (HTTP $ANALYTICS_RESPONSE)"
    exit 1
fi

# Test trading fees
TRADING_FEES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/trading-fees/pool-apr")
if [ "$TRADING_FEES_RESPONSE" = "200" ]; then
    echo "✅ Trading fees endpoint working"
else
    echo "❌ Trading fees endpoint failed (HTTP $TRADING_FEES_RESPONSE)"
    exit 1
fi

# Test performance (response time should be < 5 seconds for health)
echo "7️⃣ Testing response time performance..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/health")
if (( $(echo "$RESPONSE_TIME < 5.0" | bc -l) )); then
    echo "✅ Response time acceptable ($RESPONSE_TIME seconds)"
else
    echo "⚠️ Response time slow ($RESPONSE_TIME seconds)"
fi

# Check if PM2 is running (if available)
if command -v pm2 &> /dev/null; then
    echo "8️⃣ Checking PM2 process status..."
    PM2_STATUS=$(pm2 jlist | grep '"name":"kilt-liquidity-portal"' | grep '"status":"online"' || echo "")
    if [ ! -z "$PM2_STATUS" ]; then
        echo "✅ PM2 process running"
    else
        echo "⚠️ PM2 process not found or not running"
    fi
fi

# Memory usage check
echo "9️⃣ Checking memory usage..."
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')
echo "📊 Memory usage: $MEMORY_USAGE"

# Disk space check
echo "🔟 Checking disk space..."
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
echo "💾 Disk usage: ${DISK_USAGE}%"
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "⚠️ Disk usage high (${DISK_USAGE}%)"
else
    echo "✅ Disk usage acceptable (${DISK_USAGE}%)"
fi

echo ""
echo "🎉 Comprehensive health check completed successfully!"
echo "🚀 System is ready for production traffic"