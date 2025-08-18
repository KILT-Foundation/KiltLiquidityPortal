# Remix + MetaMask Authorization Guide

## Quick Setup for Direct MetaMask Signing

### Step 1: Open Remix IDE
Visit: https://remix.ethereum.org

### Step 2: Create Contract File
1. In the file explorer, create a new file: `DynamicTreasuryPool.sol`
2. Copy the contract code (see below)

### Step 3: Connect MetaMask
1. Go to "Deploy & Run Transactions" tab
2. Select Environment: "Injected Provider - MetaMask"
3. MetaMask will prompt to connect - approve it
4. Switch MetaMask to Base network

### Step 4: Load Deployed Contract
1. In "At Address" field, enter: `0x09bcB93e7E2FF067232d83f5e7a7E8360A458175`
2. Click "At Address" button
3. Contract will appear in "Deployed Contracts" section

### Step 5: Execute Authorization Functions
1. **First**: Call `setPendingCalculatorAuthorization`
   - Parameter: `0x352c7eb64249334d8249f3486A664364013bEeA9`
   - Click function → MetaMask will open → Confirm transaction

2. **Wait 24 hours** (security delay)

3. **Then**: Call `activatePendingCalculator`
   - Parameter: `0x352c7eb64249334d8249f3486A664364013bEeA9`
   - Click function → MetaMask will open → Confirm transaction

## Contract Code for Remix

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract DynamicTreasuryPool is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable kiltToken;
    uint256 public constant ABSOLUTE_MAXIMUM_CLAIM = 100_000 * 10**18; // 100,000 KILT
    uint256 public constant CALCULATOR_AUTHORIZATION_DELAY = 24 hours;

    mapping(address => bool) public authorizedCalculators;
    mapping(address => uint256) public pendingCalculatorActivation;
    mapping(address => uint256) public nonces;
    mapping(address => uint256) public totalClaimed;

    event CalculatorAuthorizationPending(address indexed calculator, uint256 activationTime);
    event CalculatorAuthorized(address indexed calculator);
    event CalculatorRevoked(address indexed calculator);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 nonce);

    constructor(address _kiltToken) Ownable(msg.sender) {
        kiltToken = IERC20(_kiltToken);
    }

    function setPendingCalculatorAuthorization(address calculator) external onlyOwner {
        require(calculator != address(0), "Invalid calculator address");
        pendingCalculatorActivation[calculator] = block.timestamp;
        emit CalculatorAuthorizationPending(calculator, block.timestamp + CALCULATOR_AUTHORIZATION_DELAY);
    }

    function activatePendingCalculator(address calculator) external onlyOwner {
        uint256 pendingTime = pendingCalculatorActivation[calculator];
        require(pendingTime > 0, "No pending authorization");
        require(block.timestamp >= pendingTime + CALCULATOR_AUTHORIZATION_DELAY, "Authorization delay not met");
        
        authorizedCalculators[calculator] = true;
        pendingCalculatorActivation[calculator] = 0;
        emit CalculatorAuthorized(calculator);
    }

    function revokeCalculator(address calculator) external onlyOwner {
        authorizedCalculators[calculator] = false;
        pendingCalculatorActivation[calculator] = 0;
        emit CalculatorRevoked(calculator);
    }

    function claimRewards(
        uint256 rewardAmount,
        uint256 userNonce,
        bytes memory signature
    ) external {
        require(rewardAmount > 0, "Invalid reward amount");
        require(rewardAmount <= ABSOLUTE_MAXIMUM_CLAIM, "Exceeds absolute maximum");
        require(userNonce == nonces[msg.sender] + 1, "Invalid nonce");
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,
            rewardAmount,
            userNonce,
            address(this)
        )).toEthSignedMessageHash();
        
        address signer = messageHash.recover(signature);
        require(authorizedCalculators[signer], "Invalid signature");
        
        nonces[msg.sender] = userNonce;
        totalClaimed[msg.sender] += rewardAmount;
        
        require(kiltToken.transfer(msg.sender, rewardAmount), "Transfer failed");
        emit RewardsClaimed(msg.sender, rewardAmount, userNonce);
    }

    function withdrawTreasury(uint256 amount) external onlyOwner {
        require(kiltToken.transfer(owner(), amount), "Transfer failed");
    }

    function getTreasuryBalance() external view returns (uint256) {
        return kiltToken.balanceOf(address(this));
    }
}
```

## Key Addresses
- **Contract**: `0xe5771357399D58aC79A5b1161e8C363bB178B22b`
- **Calculator**: `0x352c7eb64249334d8249f3486A664364013bEeA9`
- **Base Network RPC**: `https://mainnet.base.org`

## After Authorization Complete
✅ Calculator automatically signs rewards for all users  
✅ Users can claim their 2,787.27 KILT independently  
✅ System runs autonomously without further admin intervention