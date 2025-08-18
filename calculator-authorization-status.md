# CRITICAL: Calculator Authorization Required

## Immediate Issue Identified

**Root Cause**: The calculator wallet `0x352c7eb64249334d8249f3486A664364013bEeA9` is **NOT AUTHORIZED** in the smart contract to sign claim transactions.

**Impact**: All user reward claims are failing with "execution reverted" errors.

**Evidence**: 
- Contract owner: `0xafff1831e663b6f29fb90871ea8518e8f8b3b71a`
- Calculator wallet: `0x352c7eb64249334d8249f3486A664364013bEeA9`
- Authorization status: **UNAUTHORIZED** (contract rejects all signatures)

## Required Action (One-Time Setup)

The contract owner must authorize the calculator using a two-step security process:

### Step 1: Set Pending Authorization
Visit: https://basescan.org/address/0x09bcB93e7E2FF067232d83f5e7a7E8360A458175#writeContract

1. Connect owner wallet (`0xafff1831e663b6f29fb90871ea8518e8f8b3b71a`)
2. Find `setPendingCalculatorAuthorization` function
3. Enter calculator address: `0x352c7eb64249334d8249f3486A664364013bEeA9`
4. Execute transaction

### Step 2: Activate After 24 Hours
After 24-hour security delay:
1. Return to BaseScan contract interface
2. Find `activatePendingCalculator` function
3. Enter same calculator address: `0x352c7eb64249334d8249f3486A664364013bEeA9`
4. Execute transaction

## Once Authorized

✅ All users can claim their accumulated rewards immediately
✅ System operates autonomously without further owner intervention
✅ Calculator securely signs all future reward calculations

## Current User Impact

- Total claimable rewards waiting: **801.93 KILT** (~$12.29 USD)
- Users affected: All active liquidity providers
- System status: Fully functional except for authorization requirement

## Security Note

This authorization requirement is a security feature preventing unauthorized reward distributions. The 24-hour delay ensures no malicious calculator can be instantly authorized.