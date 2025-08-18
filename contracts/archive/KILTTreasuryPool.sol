// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MultiTokenTreasuryPool
 * @dev Secure treasury-based reward distribution contract with single-active-token model
 * 
 * Key Security Features:
 * - Contract holds multiple tokens directly (no external wallets)
 * - Admin-controlled funding and withdrawals for any ERC20 token
 * - Rolling 7-day claim system with individual locks
 * - Single active reward token at any time (KILT, BTC, ETH, SOL, BNB, DOT, etc.)
 * - Admin can switch active reward token seamlessly
 * - Comprehensive access controls and emergency stops
 * - Automatic position registration and reward tracking
 */
contract MultiTokenTreasuryPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Supported reward tokens (can hold multiple, but only one active for rewards)
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    
    // Primary program token (KILT)
    IERC20 public immutable primaryToken;
    
    // Current active reward token (only this token is distributed as rewards)
    address public activeRewardToken;
    
    // Reward configuration
    uint256 public lockPeriodDays = 7;
    uint256 public constant SECONDS_PER_DAY = 86400;
    
    // Daily distribution cap (separate from admin panel caps)
    uint256 public dailyDistributionCap;
    mapping(uint256 => uint256) public dailyDistributedAmount; // day => amount distributed
    
    // Treasury management
    mapping(address => bool) public authorizedAdmins;
    uint256 public totalRewardsDistributed;
    uint256 public totalPositionsRegistered;
    
    // Position tracking
    struct Position {
        uint256 tokenId;
        address owner;
        uint256 registeredAt;
        uint256 liquidityAmount;
        bool isActive;
    }
    
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;
    
    // Single-token reward tracking with individual locks (uses activeRewardToken)
    struct Reward {
        address token;        // Token contract address (must match activeRewardToken at creation)
        uint256 amount;       // Amount of tokens
        uint256 createdAt;    // When reward was created
        uint256 unlockTime;   // When reward unlocks
        bool claimed;         // Whether reward has been claimed
    }
    
    mapping(address => Reward[]) public userRewards;
    
    // Token balances tracking
    mapping(address => uint256) public tokenBalances;
    mapping(address => uint256) public totalRewardsDistributedByToken;
    
    // Events
    event PositionRegistered(uint256 indexed tokenId, address indexed owner, uint256 liquidityAmount);
    event RewardAdded(address indexed user, address indexed token, uint256 amount, uint256 unlockTime);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount, uint256 rewardIndex);
    event BatchRewardsClaimed(address indexed user, uint256 rewardCount, uint256 totalAmount);
    event TreasuryFunded(address indexed funder, address indexed token, uint256 amount);
    event TreasuryWithdrawn(address indexed admin, address indexed token, uint256 amount);
    event TokenAdded(address indexed token, string symbol);
    event TokenRemoved(address indexed token);
    event ActiveRewardTokenChanged(address indexed oldToken, address indexed newToken, string symbol);
    event AdminAuthorized(address indexed admin);
    event AdminRevoked(address indexed admin);
    event LockPeriodUpdated(uint256 newLockPeriodDays);
    event DailyDistributionCapUpdated(uint256 newDailyCap);
    event DailyDistributionLimitReached(uint256 date, uint256 distributedAmount, uint256 cap);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);
    
    modifier onlyAuthorizedAdmin() {
        require(authorizedAdmins[msg.sender] || msg.sender == owner(), "Not authorized admin");
        _;
    }
    
    constructor(address _primaryToken, address _initialAdmin, uint256 _initialDailyCap) {
        require(_primaryToken != address(0), "Invalid primary token address");
        require(_initialAdmin != address(0), "Invalid admin address");
        require(_initialDailyCap > 0, "Daily cap must be greater than 0");
        
        primaryToken = IERC20(_primaryToken);
        
        // Add primary token (KILT) as first supported token
        supportedTokens[_primaryToken] = true;
        supportedTokenList.push(_primaryToken);
        
        // Set KILT as initial active reward token
        activeRewardToken = _primaryToken;
        
        // Set initial daily distribution cap
        dailyDistributionCap = _initialDailyCap;
        
        authorizedAdmins[_initialAdmin] = true;
        
        emit TokenAdded(_primaryToken, "KILT");
        emit ActiveRewardTokenChanged(address(0), _primaryToken, "KILT");
        emit AdminAuthorized(_initialAdmin);
        emit DailyDistributionCapUpdated(_initialDailyCap);
    }
    
    /**
     * @dev Add a supported reward token
     * @param token Address of the ERC20 token
     * @param symbol Symbol of the token for events
     */
    function addSupportedToken(address token, string calldata symbol) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        supportedTokens[token] = true;
        supportedTokenList.push(token);
        
        emit TokenAdded(token, symbol);
    }
    
    /**
     * @dev Remove a supported reward token (emergency only)
     * @param token Address of the token to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(token != address(primaryToken), "Cannot remove primary token");
        require(token != activeRewardToken, "Cannot remove active reward token");
        
        supportedTokens[token] = false;
        
        // Remove from array
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == token) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    /**
     * @dev Set the active reward token (admin only)
     * @param token Address of the token to set as active
     * @param symbol Symbol of the token for events
     */
    function setActiveRewardToken(address token, string calldata symbol) external onlyAuthorizedAdmin {
        require(token != address(0), "Invalid token address");
        require(supportedTokens[token], "Token not supported");
        require(token != activeRewardToken, "Token already active");
        
        address oldToken = activeRewardToken;
        activeRewardToken = token;
        
        emit ActiveRewardTokenChanged(oldToken, token, symbol);
    }
    
    /**
     * @dev Fund the treasury with any supported token
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     */
    function fundTreasury(address token, uint256 amount) external onlyAuthorizedAdmin whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(supportedTokens[token], "Token not supported");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[token] += amount;
        
        emit TreasuryFunded(msg.sender, token, amount);
    }
    
    /**
     * @dev Emergency withdraw from treasury (admin only)
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     * @param recipient Address to receive the tokens
     */
    function emergencyWithdraw(address token, uint256 amount, address recipient) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(recipient != address(0), "Invalid recipient");
        require(supportedTokens[token], "Token not supported");
        
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient treasury balance");
        
        IERC20(token).safeTransfer(recipient, amount);
        tokenBalances[token] = contractBalance - amount;
        
        emit TreasuryWithdrawn(msg.sender, token, amount);
    }
    
    /**
     * @dev Register a Uniswap V3 position for rewards
     * @param tokenId NFT token ID of the position
     * @param owner Address of the position owner
     * @param liquidityAmount Amount of liquidity in the position
     */
    function registerPosition(
        uint256 tokenId,
        address owner,
        uint256 liquidityAmount
    ) external onlyAuthorizedAdmin whenNotPaused {
        require(owner != address(0), "Invalid owner address");
        require(liquidityAmount > 0, "Liquidity amount must be greater than 0");
        require(positions[tokenId].tokenId == 0, "Position already registered");
        
        positions[tokenId] = Position({
            tokenId: tokenId,
            owner: owner,
            registeredAt: block.timestamp,
            liquidityAmount: liquidityAmount,
            isActive: true
        });
        
        userPositions[owner].push(tokenId);
        totalPositionsRegistered++;
        
        emit PositionRegistered(tokenId, owner, liquidityAmount);
    }
    
    /**
     * @dev Add reward for user with 7-day lock in currently active reward token only
     * @param user Address of the user
     * @param amount Amount of tokens to reward
     */
    function addReward(address user, uint256 amount) external onlyAuthorizedAdmin whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Amount must be greater than 0");
        require(activeRewardToken != address(0), "No active reward token set");
        
        uint256 contractBalance = IERC20(activeRewardToken).balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient treasury balance");
        
        // Check daily distribution cap
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        uint256 dailyDistributed = dailyDistributedAmount[currentDay];
        require(dailyDistributed + amount <= dailyDistributionCap, "Daily distribution cap exceeded");
        
        // Update daily distribution tracking
        dailyDistributedAmount[currentDay] += amount;
        
        // Emit event if near cap limit
        if (dailyDistributedAmount[currentDay] >= dailyDistributionCap) {
            emit DailyDistributionLimitReached(currentDay, dailyDistributedAmount[currentDay], dailyDistributionCap);
        }
        
        uint256 unlockTime = block.timestamp + (lockPeriodDays * SECONDS_PER_DAY);
        
        userRewards[user].push(Reward({
            token: activeRewardToken,
            amount: amount,
            createdAt: block.timestamp,
            unlockTime: unlockTime,
            claimed: false
        }));
        
        totalRewardsDistributedByToken[activeRewardToken] += amount;
        totalRewardsDistributed += amount;
        
        emit RewardAdded(user, activeRewardToken, amount, unlockTime);
    }
    
    /**
     * @dev Claim unlocked rewards (gas paid by user, supports batch claiming)
     * @param rewardIndexes Array of reward indexes to claim
     * @notice Users pay gas costs for claiming their own rewards
     * @notice Batch multiple rewards to save on gas costs
     */
    function claimRewards(uint256[] calldata rewardIndexes) external nonReentrant whenNotPaused {
        require(rewardIndexes.length > 0, "No rewards specified");
        require(rewardIndexes.length <= 50, "Too many rewards in single batch"); // Gas limit protection
        
        Reward[] storage rewards = userRewards[msg.sender];
        
        // Track claim amounts by token (gas optimized)
        address[] memory claimTokens = new address[](rewardIndexes.length);
        uint256[] memory claimAmounts = new uint256[](rewardIndexes.length);
        uint256 uniqueTokenCount = 0;
        uint256 totalClaimedValue = 0;
        
        // Process rewards and accumulate by token type
        for (uint256 i = 0; i < rewardIndexes.length; i++) {
            uint256 index = rewardIndexes[i];
            require(index < rewards.length, "Invalid reward index");
            
            Reward storage reward = rewards[index];
            require(!reward.claimed, "Reward already claimed");
            require(block.timestamp >= reward.unlockTime, "Reward still locked");
            
            reward.claimed = true;
            totalClaimedValue += reward.amount;
            
            // Find existing token in arrays or add new one
            bool found = false;
            for (uint256 j = 0; j < uniqueTokenCount; j++) {
                if (claimTokens[j] == reward.token) {
                    claimAmounts[j] += reward.amount;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                claimTokens[uniqueTokenCount] = reward.token;
                claimAmounts[uniqueTokenCount] = reward.amount;
                uniqueTokenCount++;
            }
            
            emit RewardClaimed(msg.sender, reward.token, reward.amount, index);
        }
        
        // Execute transfers for each unique token
        for (uint256 i = 0; i < uniqueTokenCount; i++) {
            address token = claimTokens[i];
            uint256 claimAmount = claimAmounts[i];
            
            // Verify sufficient treasury balance
            uint256 contractBalance = IERC20(token).balanceOf(address(this));
            require(contractBalance >= claimAmount, "Insufficient treasury balance");
            
            // Update tracking and transfer
            totalRewardsDistributedByToken[token] += claimAmount;
            tokenBalances[token] -= claimAmount;
            IERC20(token).safeTransfer(msg.sender, claimAmount);
        }
        
        // Emit batch claim event
        emit BatchRewardsClaimed(msg.sender, rewardIndexes.length, totalClaimedValue);
    }
    
    /**
     * @dev Claim all available rewards for user (convenience function)
     * @notice Users pay gas costs - use when you want to claim everything at once
     */
    function claimAllRewards() external nonReentrant whenNotPaused {
        (uint256[] memory claimableIndexes,,) = this.getClaimableRewards(msg.sender);
        require(claimableIndexes.length > 0, "No claimable rewards");
        require(claimableIndexes.length <= 50, "Too many rewards - use batch claiming");
        
        this.claimRewards(claimableIndexes);
    }
    
    /**
     * @dev Get claimable rewards for user (multi-token support)
     * @param user Address of the user
     * @return claimableIndexes Array of claimable reward indexes
     * @return claimableTokens Array of claimable token addresses
     * @return claimableAmounts Array of claimable amounts
     */
    function getClaimableRewards(address user) external view returns (
        uint256[] memory claimableIndexes,
        address[] memory claimableTokens,
        uint256[] memory claimableAmounts
    ) {
        Reward[] storage rewards = userRewards[user];
        uint256 claimableCount = 0;
        
        // Count claimable rewards
        for (uint256 i = 0; i < rewards.length; i++) {
            if (!rewards[i].claimed && block.timestamp >= rewards[i].unlockTime) {
                claimableCount++;
            }
        }
        
        // Build arrays
        claimableIndexes = new uint256[](claimableCount);
        claimableTokens = new address[](claimableCount);
        claimableAmounts = new uint256[](claimableCount);
        
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            if (!rewards[i].claimed && block.timestamp >= rewards[i].unlockTime) {
                claimableIndexes[currentIndex] = i;
                claimableTokens[currentIndex] = rewards[i].token;
                claimableAmounts[currentIndex] = rewards[i].amount;
                currentIndex++;
            }
        }
    }
    
    /**
     * @dev Get all rewards for user (multi-token support)
     * @param user Address of the user
     * @return tokens Array of reward token addresses
     * @return amounts Array of reward amounts
     * @return unlockTimes Array of unlock timestamps
     * @return claimedStatus Array of claimed status
     */
    function getUserRewards(address user) external view returns (
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory unlockTimes,
        bool[] memory claimedStatus
    ) {
        Reward[] storage rewards = userRewards[user];
        uint256 length = rewards.length;
        
        tokens = new address[](length);
        amounts = new uint256[](length);
        unlockTimes = new uint256[](length);
        claimedStatus = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            tokens[i] = rewards[i].token;
            amounts[i] = rewards[i].amount;
            unlockTimes[i] = rewards[i].unlockTime;
            claimedStatus[i] = rewards[i].claimed;
        }
    }
    
    /**
     * @dev Get user's registered positions
     * @param user Address of the user
     * @return tokenIds Array of registered position token IDs
     */
    function getUserPositions(address user) external view returns (uint256[] memory tokenIds) {
        return userPositions[user];
    }
    
    /**
     * @dev Get treasury balance for specific token
     * @param token Address of the token
     * @return Current token balance in the contract
     */
    function getTreasuryBalance(address token) external view returns (uint256) {
        require(supportedTokens[token], "Token not supported");
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev Get treasury balances for all supported tokens
     * @return tokens Array of supported token addresses
     * @return balances Array of corresponding balances
     */
    function getAllTreasuryBalances() external view returns (
        address[] memory tokens,
        uint256[] memory balances
    ) {
        tokens = supportedTokenList;
        balances = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }
    
    /**
     * @dev Get list of supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokenList;
    }
    
    /**
     * @dev Get current active reward token
     * @return Address of the currently active reward token
     */
    function getActiveRewardToken() external view returns (address) {
        return activeRewardToken;
    }
    
    /**
     * @dev Get current active reward token balance
     * @return Balance of the active reward token in the contract
     */
    function getActiveRewardTokenBalance() external view returns (uint256) {
        require(activeRewardToken != address(0), "No active reward token set");
        return IERC20(activeRewardToken).balanceOf(address(this));
    }
    
    /**
     * @dev Authorize admin address
     * @param admin Address to authorize
     */
    function authorizeAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Invalid admin address");
        authorizedAdmins[admin] = true;
        emit AdminAuthorized(admin);
    }
    
    /**
     * @dev Revoke admin authorization
     * @param admin Address to revoke
     */
    function revokeAdmin(address admin) external onlyOwner {
        authorizedAdmins[admin] = false;
        emit AdminRevoked(admin);
    }
    
    /**
     * @dev Update lock period
     * @param newLockPeriodDays New lock period in days
     */
    function updateLockPeriod(uint256 newLockPeriodDays) external onlyOwner {
        require(newLockPeriodDays <= 365, "Lock period too long");
        lockPeriodDays = newLockPeriodDays;
        emit LockPeriodUpdated(newLockPeriodDays);
    }
    
    /**
     * @dev Update daily distribution cap (separate from admin panel caps)
     * @param newDailyCap New daily distribution cap amount
     */
    function updateDailyDistributionCap(uint256 newDailyCap) external onlyOwner {
        require(newDailyCap > 0, "Daily cap must be greater than 0");
        dailyDistributionCap = newDailyCap;
        emit DailyDistributionCapUpdated(newDailyCap);
    }
    
    /**
     * @dev Get daily distribution status for specific day
     * @param day Day to check (timestamp / SECONDS_PER_DAY)
     * @return distributed Amount distributed on that day
     * @return cap Daily distribution cap
     * @return remaining Amount remaining for that day
     */
    function getDailyDistributionStatus(uint256 day) external view returns (
        uint256 distributed,
        uint256 cap,
        uint256 remaining
    ) {
        distributed = dailyDistributedAmount[day];
        cap = dailyDistributionCap;
        remaining = cap > distributed ? cap - distributed : 0;
    }
    
    /**
     * @dev Get current day distribution status
     * @return distributed Amount distributed today
     * @return cap Daily distribution cap
     * @return remaining Amount remaining today
     */
    function getCurrentDayDistributionStatus() external view returns (
        uint256 distributed,
        uint256 cap,
        uint256 remaining
    ) {
        uint256 currentDay = block.timestamp / SECONDS_PER_DAY;
        return this.getDailyDistributionStatus(currentDay);
    }
    
    /**
     * @dev Pause contract operations (emergency stop)
     * @notice Only owner can pause - stops all operations except emergency withdraw
     */
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }
    
    /**
     * @dev Unpause contract operations
     * @notice Only owner can unpause - resumes normal operations
     */
    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
    
    /**
     * @dev Check if user has claimable rewards
     * @param user Address to check
     * @return hasClaimable True if user has any claimable rewards
     * @return claimableCount Number of claimable reward entries
     * @return estimatedGas Estimated gas cost for claiming all rewards
     */
    function checkClaimableStatus(address user) external view returns (
        bool hasClaimable,
        uint256 claimableCount,
        uint256 estimatedGas
    ) {
        (uint256[] memory claimableIndexes,,) = this.getClaimableRewards(user);
        claimableCount = claimableIndexes.length;
        hasClaimable = claimableCount > 0;
        
        // Rough gas estimation (Base network optimized)
        if (claimableCount > 0) {
            estimatedGas = 50000 + (claimableCount * 15000); // Base cost + per-reward cost
        }
    }
    
    /**
     * @dev Get contract statistics
     * @return totalUsers Number of users with rewards
     * @return totalRewards Total number of rewards created
     * @return activeTokens Number of supported tokens
     * @return contractVersion Version identifier
     */
    function getContractStats() external view returns (
        uint256 totalUsers,
        uint256 totalRewards,
        uint256 activeTokens,
        string memory contractVersion
    ) {
        activeTokens = supportedTokenList.length;
        totalRewards = totalRewardsDistributed;
        totalUsers = totalPositionsRegistered; // Approximate
        contractVersion = "MultiTokenTreasuryPool v1.0 - Base Network";
    }
}