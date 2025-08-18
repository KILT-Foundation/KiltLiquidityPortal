# Admin Operations Guide

## Backend Calculator Authorization

### Authorizing Calculators
Only authorized backend services can sign reward claims:

```solidity
function setCalculatorAuthorization(address calculator, bool authorized) external onlyOwner
```

### Security Model
- Backend calculates rewards based on liquidity positions
- Backend signs claim with private key
- Users submit signature to contract for validation
- Contract verifies signature before distributing rewards

### Emergency Controls
- `pause()` - Halt all claiming operations
- `unpause()` - Resume operations
- `emergencyClaim(user, amount)` - Manual reward distribution

### Monitoring & Analytics
- Track total claims: `totalClaimsProcessed`
- Monitor total distributed: `totalAmountClaimed`
- User statistics: `getUserStats(address)`
- Contract health: `getContractStats()`

### Best Practices
1. Rotate calculator keys regularly
2. Monitor contract balance vs. expected distributions
3. Test signature validation in staging environment
4. Keep emergency withdrawal capabilities secure