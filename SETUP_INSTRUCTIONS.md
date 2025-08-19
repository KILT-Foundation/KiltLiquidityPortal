# KILT-LIQ Setup Instructions

This document provides comprehensive setup instructions for the KILT-LIQ project, including both development and production environments.

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 18+ (recommended: 20.x LTS)
- **npm**: Version 9+ or **yarn** (classic)
- **PostgreSQL**: Version 13+ (for database)
- **Git**: For version control

### 1. Clone and Install
```bash
git clone https://github.com/ChaitanyaTD/KiltLiquidityPortal.git
cd KILT-LIQ
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp production.env.example .env

# Edit .env with your configuration
# See Environment Variables section below
```

### 3. Database Setup
```bash
# Ensure PostgreSQL is running and accessible
# Update DATABASE_URL in your .env file

# Push database schema
npm run db:push
```

### 4. Run Development Environment
```bash
# Run separately (recommended for development)
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client  
npm run dev:client
```

## 🛠️ Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run server only (legacy) |
| `npm run dev:server` | Run Express server with hot reload |
| `npm run dev:client` | Run Vite dev server for React app |
| `npm run build` | Build both client and server for production |
| `npm run start` | Run production build |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes |

## 🌍 Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Blockchain
BASE_RPC_URL=https://mainnet.base.org
CALCULATOR_PRIVATE_KEY=your-private-key

# Security
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
```

### Optional Variables
```bash
# Application
NODE_ENV=development
PORT=5000

# External APIs
COINGECKO_API_KEY=your-api-key
DEXSCREENER_API_KEY=your-api-key

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

## 🗄️ Database Configuration

### PostgreSQL Setup
1. **Install PostgreSQL** (if not already installed)
2. **Create Database**:
   ```sql
   CREATE DATABASE kilt_liq;
   CREATE USER kilt_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE kilt_liq TO kilt_user;
   ```

3. **Update .env**:
   ```bash
   DATABASE_URL=postgresql://kilt_user:secure_password@localhost:5432/kilt_liq
   ```

4. **Run Migrations**:
   ```bash
   npm run db:push
   ```

## 🔧 Development Workflow

### Running Separately (Recommended)

**Terminal 1 - Server:**
```bash
npm run dev:server
# Server runs on port 5000 (or PORT from .env)
# Hot reload with tsx
```

**Terminal 2 - Client:**
```bash
npm run dev:client
# Client runs on port 5173 (Vite default)
# Hot reload with Vite HMR
```

### Benefits of Separate Development
- ✅ Independent restart of server/client
- ✅ Better debugging separation
- ✅ Faster client hot reload
- ✅ Server hot reload with tsx
- ✅ Clear error attribution


## 🏗️ Project Structure

```
KILT-LIQ/
├── client/                 # React frontend (Vite)
│   ├── src/
│   ├── public/
│   └── index.html
├── server/                 # Express backend
│   ├── routes/
│   ├── services/
│   └── index.ts
├── shared/                 # Shared code/types
│   ├── schema.ts          # Database schema
│   └── contracts/         # Contract ABIs
├── contracts/              # Smart contracts
├── dist/                   # Build output
└── package.json
```


## 🚀 Production Deployment

### Build Process
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t kilt-liq .

# Run container
docker run -p 5000:5000 --env-file .env kilt-liq
```

### Environment-Specific Builds
- **Development**: Full debugging, hot reload
- **Production**: Optimized, security-focused
- **Staging**: Production-like with debugging

## 🐛 Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check what's using port 5000
lsof -i :5000

# Use different port in .env
PORT=5001
```

**Database Connection:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database status
sudo systemctl status postgresql
```

**Build Errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run check
```

### Development Tips

1. **Use separate terminals** for server and client during development
2. **Check console logs** in both terminal and browser console
3. **Verify environment variables** are loaded correctly
4. **Database changes** require `npm run db:push`
5. **Hot reload** works independently for both server and client

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [React Documentation](https://react.dev/)


---

**Happy Coding! 🎉**
