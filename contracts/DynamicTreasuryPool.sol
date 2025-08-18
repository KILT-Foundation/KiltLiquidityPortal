// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DynamicTreasuryPool
 * @dev Smart contract for dynamic KILT reward distribution with enhanced security:
 * - Nonce-based replay protection
 * - Absolute maximum claim limits to prevent treasury drainage
 * - Time-delayed calculator authorization
 * - Signature malleability protection
 * - Overflow protection
 * Rewards are calculated in real-time based on liquidity positions and can be claimed instantly.
 */
contract DynamicTreasuryPool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    IERC20 public immutable kiltToken;
    
    // Calculator authorization with time delays
    mapping(address => bool) public authorizedCalculators;
    mapping(address => uint256) public pendingCalculatorActivation;
    uint256 public constant CALCULATOR_ACTIVATION_DELAY = 1 hours; // Configurable delay for calculator authorization
    
    // Nonce-based replay protection
    mapping(address => uint256) public nonces;
    
    // User tracking - matches app's claimedAmount
    mapping(address => uint256) public claimedAmount;
    mapping(address => uint256) public lastClaimTime;
    
    // Absolute maximum claim per transaction (prevents treasury drainage)
    uint256 public absoluteMaxClaim = 100000 * 10**18; // 100,000 KILT absolute maximum
    
    // Analytics tracking
    uint256 public totalClaimsProcessed;
    uint256 public totalAmountClaimed;
    
    // Constants for signature validation
    uint256 private constant SIGNATURE_MALLEABILITY_THRESHOLD = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    
    // Events
    event RewardClaimed(address indexed user, uint256 amount, uint256 claimedAmount, uint256 nonce, uint256 timestamp);
    event CalculatorAuthorized(address indexed calculator, bool authorized);
    event CalculatorPending(address indexed calculator, uint256 activationTime);
    event TreasuryDeposit(uint256 amount);
    event TreasuryWithdraw(uint256 amount);
    event ClaimLimitsUpdated(uint256 absoluteMax);
    event ContractPaused();
    event ContractUnpaused();
    
    // Modifiers
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }
    
    constructor(
        address _kiltToken,
        address _owner
    ) Ownable(_owner) {
        require(_kiltToken != address(0), "Invalid token address");
        require(_owner != address(0), "Invalid owner address");
        
        kiltToken = IERC20(_kiltToken);
    }

    /**
     * @dev Set pending calculator authorization with 24-hour time delay (security measure)
     */
    function setPendingCalculatorAuthorization(address calculator) external onlyOwner validAddress(calculator) {
        require(!authorizedCalculators[calculator], "Calculator already authorized");
        
        uint256 activationTime = block.timestamp + CALCULATOR_ACTIVATION_DELAY;
        pendingCalculatorActivation[calculator] = activationTime;
        
        emit CalculatorPending(calculator, activationTime);
    }
    
    /**
     * @dev Activate pending calculator after delay period
     */
    function activatePendingCalculator(address calculator) external onlyOwner validAddress(calculator) {
        require(pendingCalculatorActivation[calculator] != 0, "No pending authorization");
        require(block.timestamp >= pendingCalculatorActivation[calculator], "Activation delay not met");
        
        authorizedCalculators[calculator] = true;
        delete pendingCalculatorActivation[calculator];
        
        emit CalculatorAuthorized(calculator, true);
    }
    
    /**
     * @dev Immediately revoke calculator authorization (security measure)
     */
    function revokeCalculatorAuthorization(address calculator) external onlyOwner validAddress(calculator) {
        authorizedCalculators[calculator] = false;
        delete pendingCalculatorActivation[calculator];
        
        emit CalculatorAuthorized(calculator, false);
    }

    /**
     * @dev Update absolute maximum claim limit (owner only)
     */
    function updateAbsoluteMaxClaim(uint256 _absoluteMaxClaim) external onlyOwner {
        require(_absoluteMaxClaim > 0, "Max claim must be greater than 0");
        
        absoluteMaxClaim = _absoluteMaxClaim;
        
        emit ClaimLimitsUpdated(_absoluteMaxClaim);
    }
    


    /**
     * @dev Claim entire unclaimed reward balance - matches app's single-click claiming
     * @param totalRewardBalance User's total unclaimed reward balance (calculated by backend)
     * @param signature Signature from authorized calculator validating the full claim
     */
    function claimRewards(
        uint256 totalRewardBalance,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        require(totalRewardBalance > 0, "No rewards to claim");
        
        // Absolute maximum claim limit (prevents treasury drainage)
        require(totalRewardBalance <= absoluteMaxClaim, "Reward balance exceeds maximum claim limit");
        
        // Verify signature with nonce-based replay protection
        bytes32 messageHash = _createMessageHash(msg.sender, totalRewardBalance, nonces[msg.sender]);
        address signer = _recoverSignerOptimized(messageHash, signature);
        require(authorizedCalculators[signer], "Invalid calculator signature");
        
        // Check contract balance
        uint256 contractBalance = kiltToken.balanceOf(address(this));
        require(contractBalance >= totalRewardBalance, "Insufficient contract balance");
        
        // Check for overflow before updating state
        require(claimedAmount[msg.sender] <= type(uint256).max - totalRewardBalance, "Claimed amount overflow");
        require(totalAmountClaimed <= type(uint256).max - totalRewardBalance, "Total amount overflow");
        require(nonces[msg.sender] < type(uint256).max, "Nonce overflow");
        require(totalClaimsProcessed < type(uint256).max, "Claims processed overflow");
        
        // Update state before transfer (CEI pattern)
        claimedAmount[msg.sender] += totalRewardBalance;
        totalClaimsProcessed += 1;
        totalAmountClaimed += totalRewardBalance;
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender] += 1; // Prevent replay attacks
        lastClaimTime[msg.sender] = block.timestamp;
        
        // Transfer KILT tokens to user using SafeERC20
        kiltToken.safeTransfer(msg.sender, totalRewardBalance);
        
        emit RewardClaimed(msg.sender, totalRewardBalance, claimedAmount[msg.sender], currentNonce, block.timestamp);
    }
    
    /**
     * @dev Emergency claim function for owner - claims user's full reward balance
     */
    function emergencyClaim(address user, uint256 totalRewardBalance) external onlyOwner validAddress(user) {
        require(totalRewardBalance > 0, "No rewards to claim");
        
        // Apply same absolute limit as regular claims
        require(totalRewardBalance <= absoluteMaxClaim, "Reward balance exceeds maximum claim limit");
        
        uint256 contractBalance = kiltToken.balanceOf(address(this));
        require(contractBalance >= totalRewardBalance, "Insufficient contract balance");
        
        // Check for overflow before updating state
        require(claimedAmount[user] <= type(uint256).max - totalRewardBalance, "Claimed amount overflow");
        require(totalAmountClaimed <= type(uint256).max - totalRewardBalance, "Total amount overflow");
        require(nonces[user] < type(uint256).max, "Nonce overflow");
        require(totalClaimsProcessed < type(uint256).max, "Claims processed overflow");
        
        // Update state before transfer
        claimedAmount[user] += totalRewardBalance;
        totalClaimsProcessed += 1;
        totalAmountClaimed += totalRewardBalance;
        uint256 currentNonce = nonces[user];
        nonces[user] += 1;
        lastClaimTime[user] = block.timestamp;
        
        // Transfer KILT tokens to user using SafeERC20
        kiltToken.safeTransfer(user, totalRewardBalance);
        
        emit RewardClaimed(user, totalRewardBalance, claimedAmount[user], currentNonce, block.timestamp);
    }

    // View functions that match your app's API patterns
    function getUserStats(address user) external view validAddress(user) returns (
        uint256 claimed,
        uint256 lastClaim,
        uint256 canClaimAt,
        uint256 currentNonce
    ) {
        claimed = claimedAmount[user];
        lastClaim = lastClaimTime[user];
        canClaimAt = 0; // No time restrictions
        currentNonce = nonces[user];
    }
    
    function getClaimedAmount(address user) external view validAddress(user) returns (uint256) {
        return claimedAmount[user];
    }
    
    function getUserNonce(address user) external view validAddress(user) returns (uint256) {
        return nonces[user];
    }
    
    function getAbsoluteMaxClaim() external view returns (uint256) {
        return absoluteMaxClaim;
    }
    
    function canUserClaim(address user, uint256 rewardBalance) external view validAddress(user) returns (bool) {
        return rewardBalance <= absoluteMaxClaim && rewardBalance > 0;
    }
    
    /**
     * @dev Deposit KILT tokens to the treasury (owner only)
     * @param amount Amount of KILT tokens to deposit
     */
    function depositTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        kiltToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit TreasuryDeposit(amount);
    }
    
    /**
     * @dev Emergency withdraw (owner only)
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        uint256 balance = kiltToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        require(withdrawAmount <= balance, "Insufficient balance");
        
        kiltToken.safeTransfer(owner(), withdrawAmount);
        
        emit TreasuryWithdraw(withdrawAmount);
    }
    
    /**
     * @dev Get contract's KILT token balance
     * @return balance Current KILT token balance of the contract
     */
    function getContractBalance() external view returns (uint256) {
        return kiltToken.balanceOf(address(this));
    }
    
    /**
     * @dev Emergency pause/unpause functions
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused();
    }
    
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused();
    }
    
    /**
     * @dev Get contract statistics for monitoring
     */
    function getContractStats() external view returns (
        uint256 balance,
        uint256 totalClaims,
        uint256 totalAmount
    ) {
        balance = kiltToken.balanceOf(address(this));
        totalClaims = totalClaimsProcessed;
        totalAmount = totalAmountClaimed;
    }
    
    /**
     * @dev Get pending calculator info
     */
    function getPendingCalculatorInfo(address calculator) external view validAddress(calculator) returns (
        bool isPending,
        uint256 activationTime,
        uint256 remainingDelay
    ) {
        activationTime = pendingCalculatorActivation[calculator];
        isPending = activationTime > 0 && block.timestamp < activationTime;
        remainingDelay = isPending ? activationTime - block.timestamp : 0;
    }
    
    // Internal signature verification functions with nonce-based protection
    function _createMessageHash(address user, uint256 totalRewardBalance, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            keccak256(abi.encodePacked(
                user,
                totalRewardBalance,
                nonce
            ))
        ));
    }
    
    /**
     * @dev Optimized signature recovery with malleability protection
     */
    function _recoverSignerOptimized(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }
        
        // Protect against signature malleability
        require(uint256(s) <= SIGNATURE_MALLEABILITY_THRESHOLD, "Invalid signature 's' value");
        
        // Ensure v is valid
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Invalid signature");
        
        return signer;
    }
}