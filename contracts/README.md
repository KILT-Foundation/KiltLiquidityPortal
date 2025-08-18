# KILT Smart Contracts

## Production Contract

### DynamicTreasuryPool.sol
**Status**: ✅ Production Ready  
**Features**: Zero-restriction reward claiming with signature-based security
- OpenZeppelin v5 compatible
- Gas-optimized with unchecked arithmetic
- Cryptographic signature validation
- Time-based replay protection (1-hour windows)
- Reentrancy protection with pause functionality

**Deployment Parameters**:
- Network: Base (Chain ID: 8453)
- KILT Token: `0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8`
- Owner: `0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e`

## Archive
Previous contract iterations moved to `/archive/` for reference:
- BasicTreasuryPool.sol
- KILTTreasuryPool.sol  
- MultiTokenTreasuryPool.sol
- SimpleTreasuryPool.sol

## Deployment Scripts
- `deploy-to-base.js` - Production deployment to Base network
- `scripts/deploy.js` - General deployment script
- `scripts/test-deployment.js` - Deployment testing

## Testing
- `test/` - Contract test suites
- `run-comprehensive-tests.js` - Full test runner
- `test-runner.js` - Test execution utility

See `/docs/smart-contract-deployment.md` for complete deployment guide.