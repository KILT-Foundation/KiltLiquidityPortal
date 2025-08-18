# 🏠 KILT Liquidity Portal - Local Deployment Setup

## 📋 Complete Local Environment Configuration

### **System Requirements:**
- Node.js 18+ or 20+
- npm 8+
- PostgreSQL 14+ (or use Docker)
- Git

---

## 🔧 **Step 1: Environment Setup**

Create a `.env` file in your project root with these exact values:

```env
# Application Configuration
NODE_ENV=development
PORT=5000
INSTANCE_ID=0

# Database Configuration (Local PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/kilt_liquidity_portal
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=kilt_liquidity_portal

# Blockchain Configuration (Production Values)
BASE_RPC_URL=https://mainnet.base.org
CALCULATOR_PRIVATE_KEY=0x1a6a86ea6444f8501fc2d8142661aee283dd5befb21286f330fff3f884ab882e
BACKUP_RPC_URL=https://api.developer.coinbase.com/rpc/v1/base/FtQSiNzg6tfPcB1Hmirpy4T9SGDGFveA
BACKUP_RPC_URL_2=https://base-mainnet.g.alchemy.com/v2/demo

# External APIs (Get your own keys for production)
COINGECKO_API_KEY=your-coingecko-api-key-here
DEXSCREENER_API_KEY=your-dexscreener-api-key-here

# Security Configuration
SESSION_SECRET=super-secure-local-development-session-secret-key-256-bits
JWT_SECRET=super-secure-local-development-jwt-secret-key-256-bits
ENCRYPTION_KEY=super-secure-local-development-encryption-key-256-bits

# Development Settings
LOG_LEVEL=debug
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
CACHE_TTL=60
MAX_CONNECTIONS=20
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000
CORS_CREDENTIALS=true

# Development Features
DEBUG_ENABLED=true
VERBOSE_LOGGING=true
PERFORMANCE_MONITORING=true
```

---

## 🗄️ **Step 2: Database Setup**

### **Option A: Local PostgreSQL Installation**

**Windows:**
```bash
# Using Chocolatey
choco install postgresql

# Or download from: https://www.postgresql.org/download/windows/
```

**Mac:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql

# Create database
createdb kilt_liquidity_portal
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE kilt_liquidity_portal;
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE kilt_liquidity_portal TO postgres;
\q
```

### **Option B: Docker PostgreSQL (Recommended)**

Create `docker-compose.local.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: kilt_liquidity_portal
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Start database:
```bash
docker-compose -f docker-compose.local.yml up -d
```

---

## 🚀 **Step 3: Project Setup**

### **Clone and Install:**
```bash
# Clone the repository
git clone <your-repo-url>
cd kilt-liquidity-portal

# Install dependencies
npm install

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

---

## 🔑 **Step 4: API Keys Setup**

### **Required API Keys for Full Functionality:**

1. **CoinGecko API (Free Tier Available)**
   ```
   Website: https://www.coingecko.com/en/api
   Sign up → Get API key
   Add to .env: COINGECKO_API_KEY=cg_your_api_key_here
   ```

2. **DexScreener API (Optional but Recommended)**
   ```
   Website: https://dexscreener.com/api
   Contact for API access
   Add to .env: DEXSCREENER_API_KEY=your_dexscreener_key
   ```

3. **Coinbase Developer API (Optional)**
   ```
   Website: https://developers.coinbase.com/
   Create project → Get API key
   Replace in BACKUP_RPC_URL: YOUR_COINBASE_KEY
   ```

---

## 📊 **Step 5: Verify Setup**

### **Health Check Commands:**

```bash
# Check if app starts correctly
npm run dev

# Test database connection
node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'kilt_liquidity_portal',
  user: 'postgres',
  password: 'password'
});
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? '❌ DB Error:' + err : '✅ DB Connected: ' + res.rows[0].now);
  pool.end();
});
"

# Test blockchain connection
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}'

# Check app endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/kilt-data
```

---

## 🌐 **Step 6: Access Your Local App**

Once running, access:
- **Main App**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **API Status**: http://localhost:5000/api/status

---

## 🔧 **Current Production Contract Addresses (Base Mainnet)**

Your local app will connect to these live contracts:

```env
# Smart Contract Addresses (Live Production)
SMART_CONTRACT_ADDRESS=0x09bcB93e7E2FF067232d83f5e7a7E8360A458175
KILT_TOKEN_ADDRESS=0x9E5189a77f698305Ef76510AFF1C528cff48779c
WETH_ADDRESS=0x4200000000000000000000000000000000000006
UNISWAP_V3_POOL_ADDRESS=0x4D69971CCd4A636c403a3C1B00c85e99bB9B5606
POSITION_MANAGER_ADDRESS=0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1
CALCULATOR_WALLET_ADDRESS=0x352c7eb64249334d8249f3486A664364013bEeA9

# Network Configuration
CHAIN_ID=8453
NETWORK_NAME=Base
```

---

## 📈 **Current Live Data (Your Local App Will Show)**

- **Pool TVL**: $98,764.37
- **KILT Price**: $0.015605
- **Active Users**: 3 registered wallets
- **Total Positions**: 11 active
- **Distributed Rewards**: 15,505 KILT
- **Program APR**: 144.2%
- **Trading APR**: 4.5%
- **Total APR**: 148.7%

---

## 🛠️ **Development Commands**

```bash
# Development mode with hot reload
npm run dev

# Build for production testing
npm run build

# Start production build locally
npm start

# Database operations
npm run db:push          # Apply schema changes
npm run db:generate      # Generate migrations

# Type checking
npm run check

# View logs
tail -f logs/app.log     # If logging to file
```

---

## 🔍 **Troubleshooting Local Setup**

### **Common Issues:**

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Or for Docker
   docker ps | grep postgres
   ```

2. **Port 5000 Already in Use**
   ```bash
   # Find what's using port 5000
   lsof -i :5000
   
   # Kill the process or change PORT in .env
   PORT=3001
   ```

3. **RPC Rate Limits**
   - Get your own Coinbase Developer API key
   - Add multiple backup RPC URLs
   - The app has built-in fallback mechanisms

4. **Missing API Data**
   - CoinGecko API key required for KILT price
   - App will show placeholder data without keys
   - Get free API keys from the services listed above

### **Environment Validation Script:**

```bash
# Create validate-env.js
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
```

---

## 🎯 **Local Development Features**

With your local setup, you get:
- **Real-time blockchain data** from Base network
- **Live KILT token prices** from CoinGecko
- **Actual pool TVL data** from DexScreener
- **Working wallet connections** (MetaMask, WalletConnect)
- **Full Uniswap V3 integration**
- **Admin panel access** for testing
- **Hot reload** for development
- **Debug logging** enabled

---

## 🚨 **Security Notes for Local Development**

1. **Private Keys**: The calculator private key is included for local testing only
2. **API Keys**: Use your own API keys, don't commit them to version control
3. **Database**: Local database is for development only
4. **CORS**: Configured for local origins only

---

## 📱 **Mobile Testing**

To test mobile wallet connections locally:

1. **Find your local IP**:
   ```bash
   # Mac/Linux
   ifconfig | grep inet
   
   # Windows
   ipconfig
   ```

2. **Access via IP**: Use `http://YOUR_IP:5000` on mobile device

3. **Update CORS**: Add your IP to ALLOWED_ORIGINS in .env

---

## ✅ **Local Deployment Checklist**

- [ ] Node.js 18+ installed
- [ ] PostgreSQL running (local or Docker)
- [ ] .env file created with all variables
- [ ] Dependencies installed (`npm install`)
- [ ] Database migrated (`npm run db:push`)
- [ ] API keys obtained (at least CoinGecko)
- [ ] App starts without errors (`npm run dev`)
- [ ] Health check passes (`curl localhost:5000/health`)
- [ ] Database connection works
- [ ] Blockchain data loads
- [ ] Wallet connection works (MetaMask)

**🎉 Your local KILT Liquidity Portal is ready!**

Access it at: **http://localhost:5000**