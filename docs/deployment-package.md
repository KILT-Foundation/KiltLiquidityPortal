# Production Deployment Package

## Complete Stack Deployment

### Frontend Deployment (Replit)
- Build: `npm run build`
- Static assets served from `dist/`
- Environment variables configured in Replit secrets
- Domain: Custom domain recommended (e.g., liq.kilt.io)

### Backend Services
- Express.js API server
- PostgreSQL database (Neon)
- Real-time data processing
- Signature service for reward validation

### Smart Contract
- **Network**: Base mainnet
- **Gas Estimates**: ~$0.02 total transaction costs
- **Contract**: DynamicTreasuryPool.sol
- **Verification**: Source code verified on Basescan

### Required Secrets
- `DATABASE_URL` - PostgreSQL connection
- `REWARD_WALLET_PRIVATE_KEY` - Backend calculator signing key
- API keys for external services (CoinGecko, DexScreener)

### Post-Deployment Checklist
- [ ] Smart contract deployed and verified
- [ ] Backend calculator authorized
- [ ] Treasury funded with initial KILT tokens
- [ ] Frontend connected to contract
- [ ] Real-time data feeds operational
- [ ] Mobile wallet deep links configured
- [ ] Analytics dashboard functional

### Monitoring
- Contract balance alerts
- API response time monitoring
- Error rate tracking
- User activity analytics