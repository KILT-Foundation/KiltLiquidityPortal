// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BasicTreasuryPool
 * @dev Simplified treasury-based reward distribution system for KILT token rewards
 * This is a basic implementation without external dependencies for quick deployment
 */
contract BasicTreasuryPool {
    
    // KILT token interface
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
        function transferFrom(address from, address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }

    // State variables
    address public owner;
    IERC20 public kiltToken;
    uint256 public totalTreasuryBalance;
    
    // User reward tracking
    struct UserReward {
        uint256 amount;
        uint256 lockTimestamp;
        bool claimed;
    }
    
    mapping(address => UserReward[]) public userRewards;
    mapping(address => uint256) public userRewardCount;
    
    // Events
    event RewardDistributed(address indexed user, uint256 amount, uint256 lockTimestamp);
    event RewardClaimed(address indexed user, uint256 amount);
    event TreasuryDeposit(uint256 amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor(address _kiltTokenAddress) {
        owner = msg.sender;
        kiltToken = IERC20(_kiltTokenAddress);
    }
    
    /**
     * @dev Deposit KILT tokens to treasury
     * @param amount Amount to deposit
     */
    function depositToTreasury(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(kiltToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        totalTreasuryBalance += amount;
        emit TreasuryDeposit(amount);
    }
    
    /**
     * @dev Distribute rewards to a user (owner only)
     * @param user User address
     * @param amount Reward amount
     */
    function distributeReward(address user, uint256 amount) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalTreasuryBalance >= amount, "Insufficient treasury balance");
        
        userRewards[user].push(UserReward({
            amount: amount,
            lockTimestamp: block.timestamp,
            claimed: false
        }));
        
        userRewardCount[user]++;
        totalTreasuryBalance -= amount;
        
        emit RewardDistributed(user, amount, block.timestamp);
    }
    
    /**
     * @dev Claim available rewards (no lock period for testing)
     */
    function claimRewards() external {
        uint256 totalClaimable = 0;
        uint256 rewardCount = userRewardCount[msg.sender];
        
        require(rewardCount > 0, "No rewards to claim");
        
        // Calculate total claimable amount
        for (uint256 i = 0; i < rewardCount; i++) {
            UserReward storage reward = userRewards[msg.sender][i];
            if (!reward.claimed) {
                reward.claimed = true;
                totalClaimable += reward.amount;
            }
        }
        
        require(totalClaimable > 0, "No unclaimed rewards");
        require(kiltToken.transfer(msg.sender, totalClaimable), "Transfer failed");
        
        emit RewardClaimed(msg.sender, totalClaimable);
    }
    
    /**
     * @dev Get user's total claimable rewards
     * @param user User address
     * @return claimableAmount Total claimable amount
     */
    function getClaimableRewards(address user) external view returns (uint256 claimableAmount) {
        uint256 rewardCount = userRewardCount[user];
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < rewardCount; i++) {
            UserReward memory reward = userRewards[user][i];
            if (!reward.claimed) {
                totalAmount += reward.amount;
            }
        }
        
        return totalAmount;
    }
    
    /**
     * @dev Get user's reward history
     * @param user User address
     * @return rewards Array of user's rewards
     */
    function getUserRewards(address user) external view returns (UserReward[] memory rewards) {
        return userRewards[user];
    }
    
    /**
     * @dev Emergency withdrawal (owner only)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(amount <= kiltToken.balanceOf(address(this)), "Insufficient balance");
        require(kiltToken.transfer(owner, amount), "Transfer failed");
        
        if (amount <= totalTreasuryBalance) {
            totalTreasuryBalance -= amount;
        } else {
            totalTreasuryBalance = 0;
        }
    }
    
    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return kiltToken.balanceOf(address(this));
    }
}