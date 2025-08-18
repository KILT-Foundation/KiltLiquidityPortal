#!/bin/bash

# KILT Liquidity Portal - Local Setup Script
# Run this script to set up the entire local development environment

set -e  # Exit on error

echo "🚀 KILT Liquidity Portal - Local Setup Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${BLUE}Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    echo "Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -c2-)
echo -e "${GREEN}✅ Node.js ${NODE_VERSION} found${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found.${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm ${NPM_VERSION} found${NC}"

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker found - will use Docker for PostgreSQL${NC}"
    USE_DOCKER=true
else
    echo -e "${YELLOW}⚠️  Docker not found - will use local PostgreSQL${NC}"
    USE_DOCKER=false
fi

# Install dependencies
echo -e "${BLUE}Installing npm dependencies...${NC}"
npm install

# Set up environment file
echo -e "${BLUE}Setting up environment file...${NC}"
if [ ! -f .env ]; then
    cp .env.local .env
    echo -e "${GREEN}✅ .env file created from .env.local${NC}"
    echo -e "${YELLOW}⚠️  Please add your API keys to .env file${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

# Database setup
echo -e "${BLUE}Setting up database...${NC}"

if [ "$USE_DOCKER" = true ]; then
    echo -e "${BLUE}Starting PostgreSQL with Docker...${NC}"
    docker-compose -f docker-compose.local.yml up -d postgres
    
    # Wait for database to be ready
    echo -e "${BLUE}Waiting for database to be ready...${NC}"
    sleep 10
    
    # Check if database is ready
    until docker exec kilt-postgres-local pg_isready -h localhost -p 5432 -U postgres; do
        echo -e "${YELLOW}⏳ Waiting for database...${NC}"
        sleep 2
    done
    
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
else
    # Check if PostgreSQL is installed locally
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✅ PostgreSQL found locally${NC}"
        
        # Try to create database
        echo -e "${BLUE}Creating local database...${NC}"
        createdb kilt_liquidity_portal 2>/dev/null || echo -e "${YELLOW}⚠️  Database might already exist${NC}"
    else
        echo -e "${RED}❌ PostgreSQL not found locally and Docker not available${NC}"
        echo -e "${YELLOW}Please install PostgreSQL or Docker to continue${NC}"
        echo -e "${BLUE}PostgreSQL download: https://www.postgresql.org/download/${NC}"
        echo -e "${BLUE}Docker download: https://www.docker.com/products/docker-desktop${NC}"
        exit 1
    fi
fi

# Run database migrations
echo -e "${BLUE}Running database migrations...${NC}"
npm run db:push

# Validate environment
echo -e "${BLUE}Validating environment...${NC}"

# Create validation script
cat > validate-env.js << 'EOF'
const required = [
  'DATABASE_URL',
  'BASE_RPC_URL',
  'CALCULATOR_PRIVATE_KEY',
  'SESSION_SECRET'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
EOF

# Run validation
node validate-env.js
rm validate-env.js

# Test database connection
echo -e "${BLUE}Testing database connection...${NC}"
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/kilt_liquidity_portal'
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Database connection successful');
  pool.end();
});
"

# Test blockchain connection
echo -e "${BLUE}Testing blockchain connection...${NC}"
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}' | \
  node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    if (data.result) {
      console.log('✅ Blockchain connection successful - Block:', parseInt(data.result, 16));
    } else {
      console.log('⚠️  Blockchain connection issue, but app will still work');
    }
  "

echo ""
echo -e "${GREEN}🎉 Local setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Add your API keys to the .env file:"
echo -e "   - COINGECKO_API_KEY=your_key_here"
echo -e "   - DEXSCREENER_API_KEY=your_key_here"
echo ""
echo -e "2. Start the development server:"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo -e "3. Open your browser to:"
echo -e "   ${YELLOW}http://localhost:5000${NC}"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"

# Optional: Start the dev server
read -p "Would you like to start the development server now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Starting development server...${NC}"
    npm run dev
fi