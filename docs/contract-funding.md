# Contract Funding Guide

## Treasury Management

### Funding the Contract
The DynamicTreasuryPool contract requires KILT tokens to distribute rewards:

```solidity
function depositTreasury(uint256 amount) external onlyOwner
```

### Steps to Fund
1. Ensure owner wallet has sufficient KILT tokens
2. Approve the contract to spend KILT tokens
3. Call `depositTreasury(amount)` with desired funding amount
4. Monitor contract balance with `getContractBalance()`

### Emergency Withdrawal
Owner can withdraw funds if needed:
```solidity
function emergencyWithdraw(uint256 amount) external onlyOwner
```

### Monitoring
- Contract balance: `getContractBalance()`
- Total claims processed: `getContractStats()`
- Individual user claims: `getClaimedAmount(user)`

### Recommended Treasury Size
Based on daily reward distributions and user base growth projections.
Current pool supports ~$100K TVL with proportional reward distribution.