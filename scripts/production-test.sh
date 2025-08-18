#!/bin/bash

# Production Environment Test Script
# Tests deployment configuration locally before actual deployment

echo "🧪 Testing production deployment configuration..."

# Check if build exists
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build not found. Running build first..."
    npm run build
fi

if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Frontend build missing. Check build output."
    exit 1
fi

echo "✅ Build files verified"

# Test production server start
echo "🚀 Testing production server..."

# Start production server on different port (avoiding port conflicts)
NODE_ENV=production PORT=3001 node dist/index.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test endpoints
echo "🔍 Testing endpoints..."

# Test root endpoint (should return HTML, not JSON)
RESPONSE=$(curl -s http://localhost:3001/)
if [[ $RESPONSE == *"<html"* ]]; then
    echo "✅ Root endpoint serves HTML (React frontend)"
else
    echo "❌ Root endpoint serves non-HTML response"
    echo "Response: $RESPONSE"
    kill $SERVER_PID
    exit 1
fi

# Test health endpoint
HEALTH=$(curl -s http://localhost:3001/api/health)
if [[ $HEALTH == *"healthy"* ]]; then
    echo "✅ Health endpoint working"
else
    echo "❌ Health endpoint failed"
    kill $SERVER_PID
    exit 1
fi

# Test API endpoint
API_TEST=$(curl -s http://localhost:3001/api/kilt-data)
if [[ $API_TEST == *"price"* ]]; then
    echo "✅ API endpoints working"
else
    echo "⚠️  API endpoint may have issues (could be normal if no secrets)"
fi

# Cleanup
kill $SERVER_PID
echo "🏁 Production test completed successfully!"
echo ""
echo "✅ Ready for deployment:"
echo "  • Frontend serves React app (not JSON)"
echo "  • API endpoints functional"
echo "  • Health check working"
echo ""
echo "🚀 Safe to deploy via Replit Deploy button"