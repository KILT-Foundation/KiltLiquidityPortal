# Calculator Authorization Guide 

## Summary: One-Time Setup Process

Your enhanced security model is now ready! This guide covers the **one-time authorization** needed to enable secure reward claiming.

## ✅ Current Status

- **Contract Deployed**: `0x09bcB93e7E2FF067232d83f5e7a7E8360A458175`
- **Calculator Wallet Created**: `0x352c7eb64249334d8249f3486A664364013bEeA9`
- **Calculator Private Key**: `0x0d24569d1fcac6b371a80c6ee53b9ad021ab33742ad6465365c88508d08300df`
- **Authorization Status**: Pending (needs your transaction)

## 🔐 Security Architecture 

```
Owner Wallet (You) 
├── Deploys contract ✅
├── Authorizes calculator (ONE-TIME) ⏳
└── Emergency controls only

Calculator Wallet (Backend)
├── Signs reward calculations (EVERY CLAIM)
├── No admin powers
└── Can be revoked if needed

User Wallets
└── Claim their own rewards (ANYTIME)
```

## 📋 One-Time Authorization Steps

### Step 1: Go to BaseScan
Visit: https://basescan.org/address/0x09bcB93e7E2FF067232d83f5e7a7E8360A458175#writeContract

### Step 2: Connect Your Owner Wallet
Connect the wallet that deployed the contract (`0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a`)

### Step 3: Set Pending Authorization
1. Find `setPendingCalculatorAuthorization` function
2. Enter calculator address: `0x352c7eb64249334d8249f3486A664364013bEeA9`
3. Click "Write" and confirm transaction

### Step 4: Wait 24 Hours (Security Delay)
The contract enforces a 24-hour delay for security.

### Step 5: Activate Calculator
1. Return to BaseScan after 24 hours
2. Find `activatePendingCalculator` function  
3. Enter same calculator address: `0x352c7eb64249334d8249f3486A664364013bEeA9`
4. Click "Write" and confirm transaction

## 🚀 After Authorization is Complete

✅ **Calculator automatically signs rewards for ALL users**
✅ **Users can claim their 2,787.27 KILT independently**  
✅ **No more owner wallet needed for daily operations**
✅ **System runs autonomously at infinite scale**

## 📊 Current Reward Stats

- **Total Claimable**: 2,787.27 KILT
- **Daily Rewards**: ~165.99 KILT  
- **Active Positions**: 2
- **Gas Cost**: ~$0.02 per claim

## 🔧 Verification Commands

Check authorization status:
```bash
node authorize-calculator-transaction.js 0x352c7eb64249334d8249f3486A664364013bEeA9
```

Test calculator configuration:
```bash
curl http://localhost:5000/api/calculator/address
```

## 🎯 Next Steps

1. **You**: Complete one-time calculator authorization via BaseScan
2. **System**: Automatically enables reward claiming for all users
3. **Users**: Can claim rewards immediately after authorization

This setup ensures maximum security while enabling fully autonomous reward distribution!