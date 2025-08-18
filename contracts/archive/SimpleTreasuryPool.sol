// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title SimpleTreasuryPool
 * @dev Smart contract that allows users to claim KILT rewards automatically
 * WITHOUT requiring private keys on the backend.
 * Uses owner-set reward allowances that users can claim directly.
 */
contract SimpleTreasuryPool is Ownable, ReentrancyGuard, Pausable {
    IERC20 public immutable kiltToken;
    
    // User address => claimable amount (in wei)
    mapping(address => uint256) public claimableRewards;
    
    // User address => amount already claimed (in wei)
    mapping(address => uint256) public claimedRewards;
    
    // Events
    event RewardAllowanceSet(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event TreasuryDeposit(uint256 amount);
    event TreasuryWithdraw(uint256 amount);
    
    constructor(
        address _kiltToken,
        address _owner
    ) {
        require(_kiltToken != address(0), "Invalid token address");
        require(_owner != address(0), "Invalid owner address");
        
        kiltToken = IERC20(_kiltToken);
        _transferOwnership(_owner);
    }

    /**
     * @dev Set claimable reward allowance for a user (owner only)
     * This is done once by the owner, then users can claim anytime
     * @param user Address of the user
     * @param amount Amount of KILT tokens the user can claim (in wei)
     */
    function setRewardAllowance(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than 0");
        
        claimableRewards[user] = amount;
        emit RewardAllowanceSet(user, amount);
    }
    
    /**
     * @dev Update reward allowance for a user (can decrease if needed)
     * @param user Address of the user
     * @param newAmount New total amount (must be >= already claimed)
     */
    function updateRewardAllowance(address user, uint256 newAmount) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(newAmount >= claimedRewards[user], "Cannot set below claimed amount");
        
        claimableRewards[user] = newAmount;
        emit RewardAllowanceSet(user, newAmount);
    }
    
    /**
     * @dev Set reward allowances for multiple users (batch operation)
     * @param users Array of user addresses
     * @param amounts Array of corresponding reward amounts (in wei)
     */
    function setRewardAllowancesBatch(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 length = users.length;
        require(length == amounts.length, "Arrays length mismatch");
        require(length > 0, "Empty arrays");
        require(length <= 100, "Batch too large"); // Prevent gas limit issues
        
        for (uint256 i = 0; i < length;) {
            require(users[i] != address(0), "Invalid user address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            claimableRewards[users[i]] = amounts[i];
            emit RewardAllowanceSet(users[i], amounts[i]);
            
            unchecked { ++i; }
        }
    }
    
    /**
     * @dev Internal function to process claims (avoids code duplication)
     * @param user Address of the user claiming
     * @param amount Amount to claim
     */
    function _processClaim(address user, uint256 amount) internal {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 claimableAmount = getClaimableAmount(user);
        require(amount <= claimableAmount, "Insufficient claimable rewards");
        
        uint256 contractBalance = kiltToken.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient contract balance");
        
        // Update claimed amount BEFORE transfer (CEI pattern)
        claimedRewards[user] = claimedRewards[user] + amount;
        
        // Transfer KILT tokens to user
        bool success = kiltToken.transfer(user, amount);
        require(success, "Token transfer failed");
        
        emit RewardClaimed(user, amount);
    }
    
    /**
     * @dev Claim rewards - users pay gas, no backend interaction needed
     * @param amount Amount to claim (must not exceed claimable amount)
     */
    function claimRewards(uint256 amount) external nonReentrant whenNotPaused {
        _processClaim(msg.sender, amount);
    }
    
    /**
     * @dev Claim all available rewards for the caller
     */
    function claimAllRewards() external nonReentrant whenNotPaused {
        uint256 claimableAmount = getClaimableAmount(msg.sender);
        require(claimableAmount > 0, "No rewards to claim");
        
        _processClaim(msg.sender, claimableAmount);
    }

    /**
     * @dev Get the amount of rewards a user can claim
     * @param user Address of the user
     * @return claimable Amount of KILT tokens the user can claim (in wei)
     */
    function getClaimableAmount(address user) public view returns (uint256) {
        uint256 totalClaimable = claimableRewards[user];
        uint256 alreadyClaimed = claimedRewards[user];
        
        if (totalClaimable <= alreadyClaimed) {
            return 0;
        }
        
        return totalClaimable - alreadyClaimed;
    }

    /**
     * @dev Get total rewards (claimed + claimable) for a user
     * @param user Address of the user
     * @return total Total rewards set for the user
     */
    function getTotalRewards(address user) external view returns (uint256) {
        return claimableRewards[user];
    }
    
    /**
     * @dev Get amount already claimed by a user
     * @param user Address of the user
     * @return claimed Amount already claimed by the user
     */
    function getClaimedAmount(address user) external view returns (uint256) {
        return claimedRewards[user];
    }
    
    /**
     * @dev Get user stats in one call (gas efficient for frontends)
     * @param user Address of the user
     * @return total Total rewards allocated
     * @return claimed Amount already claimed
     * @return claimable Amount available to claim
     */
    function getUserStats(address user) external view returns (
        uint256 total,
        uint256 claimed,
        uint256 claimable
    ) {
        total = claimableRewards[user];
        claimed = claimedRewards[user];
        claimable = getClaimableAmount(user);
    }
    
    /**
     * @dev Deposit KILT tokens to the treasury (owner only)
     * @param amount Amount of KILT tokens to deposit
     */
    function depositTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        bool success = kiltToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
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
        
        bool success = kiltToken.transfer(owner(), withdrawAmount);
        require(success, "Transfer failed");
        
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
     * @dev Pause contract (owner only) - stops all claims
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only) - resumes claims
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}