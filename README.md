# KILT Liquidity Incentive Portal 🚀

A production-ready DeFi application that rewards users for providing liquidity to the KILT/ETH Uniswap V3 pool on Base network. Earn dynamic, real-time rewards from the KILT treasury with zero restrictions and instant claiming.

## ✨ Key Features

- **🔓 Zero Restrictions**: Claim rewards instantly, anytime, with no caps or limits
- **🔒 Secure**: No private key exposure - rewards distributed via cryptographic signatures
- **⚡ Real-Time**: Live reward calculations based on actual liquidity performance
- **📱 Mobile Optimized**: Full wallet integration with MetaMask, Coinbase, WalletConnect
- **💰 Low Cost**: ~$0.02 transaction fees on Base network
- **🎯 Transparent**: All calculations and transfers verifiable on-chain

## 🎯 How It Works

1. **Add Liquidity** to the KILT/ETH Uniswap V3 pool on Base
2. **Earn Rewards** automatically based on your liquidity performance
3. **Monitor Progress** with real-time reward tracking
4. **Claim Instantly** using secure signature-based validation
5. **Scale Unlimited** - supports thousands of simultaneous users

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript and Vite
- **Shadcn/ui** components with Tailwind CSS
- **Viem** for type-safe blockchain interactions
- **TanStack Query** for optimized data fetching
- **Responsive Design** with mobile-first approach

### Backend Stack
- **Express.js** with TypeScript (ESM modules)
- **PostgreSQL** with Drizzle ORM (Neon Database)
- **RESTful APIs** with Zod validation
- **Real-time Data** from CoinGecko and DexScreener
- **Parallel Processing** for sub-second responses

### Smart Contract
- **DynamicTreasuryPool** deployed on Base network
- **Signature-based Security** with 1-hour replay protection
- **Gas Optimized** with OpenZeppelin v5 compatibility
- **Zero Private Key Exposure** architecture

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Push database schema (if needed)
npm run db:push
```

## 📖 Documentation

- **[How It Works](./docs/how-it-works.md)** - Complete app explanation and smart contract role
- **[Smart Contract Deployment](./docs/smart-contract-deployment.md)** - Production deployment guide
- **[Technical Architecture](./replit.md)** - Detailed system specifications

## 🔧 Environment Setup

### Required Environment Variables
```env
DATABASE_URL=postgresql://...
```

### Optional Secrets (for production)
- `REWARD_WALLET_PRIVATE_KEY` - For reward signature generation

## 🌐 Network Information

- **Blockchain**: Base (Chain ID: 8453)
- **KILT Token**: `0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8`
- **Target Pool**: KILT/ETH Uniswap V3 (0.3% fee tier)
- **Contract**: DynamicTreasuryPool (deploy using `/contracts/deploy-production.js`)

## 💡 Core Innovation

### Signature-Based Reward System
Traditional liquidity mining requires:
- ❌ Private key exposure
- ❌ Batch processing delays  
- ❌ Artificial claiming restrictions
- ❌ Centralized control

Our solution provides:
- ✅ Cryptographic signatures (no private keys shared)
- ✅ Instant individual claims
- ✅ Unlimited simultaneous users
- ✅ Fully decentralized distribution

## 🔐 Security Features

- **No Private Key Exposure**: Users never share wallet keys
- **Cryptographic Validation**: Backend-signed reward proofs
- **Time-Based Protection**: 1-hour signature windows prevent replay attacks
- **On-Chain Verification**: Smart contract validates all claims
- **Emergency Controls**: Admin functions for security

## 📊 Real-Time Analytics

- Live KILT token price and market data
- Pool TVL, volume, and trading fees APR
- Individual position performance tracking
- Reward accumulation with time-based multipliers
- Portfolio dashboard with historical analytics

## 🎨 Design Philosophy

Inspired by Cluely.com with:
- **Inter Font** for clean typography
- **Glassmorphism Dark Theme** for modern aesthetics
- **Minimal Interface** focused on essential functions
- **Smooth Transitions** with micro-interactions
- **Mobile-First** responsive design

## 🤝 Contributing

This is a production-ready application with comprehensive documentation in `/docs/`. 

For technical details and architectural decisions, see [replit.md](./replit.md).

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for the KILT ecosystem** • **Powered by Base network** • **Secured by cryptography**