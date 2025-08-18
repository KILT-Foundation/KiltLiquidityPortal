// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title MultiTokenTreasuryPool
 * @dev Advanced treasury-based reward distribution system for liquidity providers
 * Supports multiple token types with rolling lock periods and proportional rewards
 */
contract MultiTokenTreasuryPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Supported reward tokens
    struct RewardToken {
        IERC20 token;
        uint256 totalReserves;
        uint256 dailyDistributionRate;
        bool isActive;
    }

    // User reward tracking
    struct UserReward {
        uint256 amount;
        uint256 lockTimestamp;
        bool claimed;
        address tokenAddress;
    }

    // User liquidity position tracking
    struct LiquidityPosition {
        uint256 tokenId;
        uint256 liquidityAmount;
        uint256 lastUpdateTimestamp;
        bool isActive;
    }

    // State variables
    mapping(address => RewardToken) public rewardTokens;
    mapping(address => mapping(uint256 => UserReward)) public userRewards; // user => rewardId => reward
    mapping(address => uint256) public userRewardCount;
    mapping(address => LiquidityPosition[]) public userPositions;
    mapping(uint256 => address) public positionOwners; // tokenId => owner
    
    uint256 public constant LOCK_PERIOD = 7 days; // Rolling 7-day lock period
    uint256 public totalActiveLiquidity;
    uint256 private rewardIdCounter;

    // Events
    event RewardTokenAdded(address indexed token, uint256 dailyRate);
    event RewardDistributed(address indexed user, address indexed token, uint256 amount, uint256 lockTimestamp);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event LiquidityPositionRegistered(address indexed user, uint256 indexed tokenId, uint256 liquidity);
    event LiquidityPositionUpdated(address indexed user, uint256 indexed tokenId, uint256 newLiquidity);
    event TreasuryDeposit(address indexed token, uint256 amount);

    constructor() {
        // Initialize with KILT token support
        // KILT token address on Base: 0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8
    }

    /**
     * @dev Add a new reward token to the system
     * @param tokenAddress ERC20 token contract address
     * @param dailyDistributionRate Daily distribution rate (tokens per day)
     */
    function addRewardToken(
        address tokenAddress,
        uint256 dailyDistributionRate
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(!rewardTokens[tokenAddress].isActive, "Token already exists");

        rewardTokens[tokenAddress] = RewardToken({
            token: IERC20(tokenAddress),
            totalReserves: 0,
            dailyDistributionRate: dailyDistributionRate,
            isActive: true
        });

        emit RewardTokenAdded(tokenAddress, dailyDistributionRate);
    }

    /**
     * @dev Deposit tokens to treasury reserves
     * @param tokenAddress Token to deposit
     * @param amount Amount to deposit
     */
    function depositToTreasury(address tokenAddress, uint256 amount) external onlyOwner {
        require(rewardTokens[tokenAddress].isActive, "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        rewardTokens[tokenAddress].token.safeTransferFrom(msg.sender, address(this), amount);
        rewardTokens[tokenAddress].totalReserves = rewardTokens[tokenAddress].totalReserves.add(amount);

        emit TreasuryDeposit(tokenAddress, amount);
    }

    /**
     * @dev Register a liquidity position for reward tracking
     * @param tokenId Uniswap V3 NFT token ID
     * @param liquidityAmount Amount of liquidity in position
     */
    function registerLiquidityPosition(
        uint256 tokenId,
        uint256 liquidityAmount
    ) external {
        require(liquidityAmount > 0, "Liquidity must be greater than 0");
        require(positionOwners[tokenId] == address(0), "Position already registered");

        positionOwners[tokenId] = msg.sender;
        userPositions[msg.sender].push(LiquidityPosition({
            tokenId: tokenId,
            liquidityAmount: liquidityAmount,
            lastUpdateTimestamp: block.timestamp,
            isActive: true
        }));

        totalActiveLiquidity = totalActiveLiquidity.add(liquidityAmount);

        emit LiquidityPositionRegistered(msg.sender, tokenId, liquidityAmount);
    }

    /**
     * @dev Update liquidity position amount
     * @param tokenId Uniswap V3 NFT token ID
     * @param newLiquidityAmount New liquidity amount
     */
    function updateLiquidityPosition(
        uint256 tokenId,
        uint256 newLiquidityAmount
    ) external {
        require(positionOwners[tokenId] == msg.sender, "Not position owner");

        // Find and update the position
        LiquidityPosition[] storage positions = userPositions[msg.sender];
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i].tokenId == tokenId && positions[i].isActive) {
                uint256 oldLiquidity = positions[i].liquidityAmount;
                positions[i].liquidityAmount = newLiquidityAmount;
                positions[i].lastUpdateTimestamp = block.timestamp;

                // Update total active liquidity
                totalActiveLiquidity = totalActiveLiquidity.sub(oldLiquidity).add(newLiquidityAmount);

                emit LiquidityPositionUpdated(msg.sender, tokenId, newLiquidityAmount);
                break;
            }
        }
    }

    /**
     * @dev Distribute rewards to a user based on their liquidity share
     * @param user User address
     * @param tokenAddress Reward token address
     * @param amount Reward amount
     */
    function distributeReward(
        address user,
        address tokenAddress,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(rewardTokens[tokenAddress].isActive, "Token not supported");
        require(amount > 0, "Amount must be greater than 0");
        require(rewardTokens[tokenAddress].totalReserves >= amount, "Insufficient treasury reserves");

        uint256 rewardId = userRewardCount[user];
        userRewards[user][rewardId] = UserReward({
            amount: amount,
            lockTimestamp: block.timestamp,
            claimed: false,
            tokenAddress: tokenAddress
        });

        userRewardCount[user] = userRewardCount[user].add(1);
        rewardTokens[tokenAddress].totalReserves = rewardTokens[tokenAddress].totalReserves.sub(amount);

        emit RewardDistributed(user, tokenAddress, amount, block.timestamp);
    }

    /**
     * @dev Claim available rewards (after lock period)
     * @param rewardIds Array of reward IDs to claim
     */
    function claimRewards(uint256[] calldata rewardIds) external nonReentrant whenNotPaused {
        require(rewardIds.length > 0, "No rewards to claim");

        uint256 totalClaimed = 0;
        address tokenAddress;

        for (uint256 i = 0; i < rewardIds.length; i++) {
            uint256 rewardId = rewardIds[i];
            UserReward storage reward = userRewards[msg.sender][rewardId];

            require(!reward.claimed, "Reward already claimed");
            require(
                block.timestamp >= reward.lockTimestamp.add(LOCK_PERIOD),
                "Reward still locked"
            );

            if (i == 0) {
                tokenAddress = reward.tokenAddress;
            } else {
                require(reward.tokenAddress == tokenAddress, "All rewards must be same token");
            }

            reward.claimed = true;
            totalClaimed = totalClaimed.add(reward.amount);

            emit RewardClaimed(msg.sender, tokenAddress, reward.amount);
        }

        if (totalClaimed > 0) {
            rewardTokens[tokenAddress].token.safeTransfer(msg.sender, totalClaimed);
        }
    }

    /**
     * @dev Get user's claimable rewards for a specific token
     * @param user User address
     * @param tokenAddress Token address
     * @return claimableAmount Total claimable amount
     * @return claimableRewardIds Array of claimable reward IDs
     */
    function getClaimableRewards(
        address user,
        address tokenAddress
    ) external view returns (uint256 claimableAmount, uint256[] memory claimableRewardIds) {
        uint256 rewardCount = userRewardCount[user];
        uint256[] memory tempIds = new uint256[](rewardCount);
        uint256 claimableCount = 0;
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < rewardCount; i++) {
            UserReward memory reward = userRewards[user][i];
            
            if (!reward.claimed && 
                reward.tokenAddress == tokenAddress &&
                block.timestamp >= reward.lockTimestamp.add(LOCK_PERIOD)) {
                tempIds[claimableCount] = i;
                totalAmount = totalAmount.add(reward.amount);
                claimableCount++;
            }
        }

        // Create properly sized array
        claimableRewardIds = new uint256[](claimableCount);
        for (uint256 i = 0; i < claimableCount; i++) {
            claimableRewardIds[i] = tempIds[i];
        }

        claimableAmount = totalAmount;
    }

    /**
     * @dev Get user's liquidity positions
     * @param user User address
     * @return positions Array of user's liquidity positions
     */
    function getUserPositions(address user) external view returns (LiquidityPosition[] memory positions) {
        return userPositions[user];
    }

    /**
     * @dev Get reward token information
     * @param tokenAddress Token address
     * @return rewardToken Reward token struct
     */
    function getRewardToken(address tokenAddress) external view returns (RewardToken memory rewardToken) {
        return rewardTokens[tokenAddress];
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal function (only owner)
     * @param tokenAddress Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) external onlyOwner {
        require(rewardTokens[tokenAddress].isActive, "Token not supported");
        rewardTokens[tokenAddress].token.safeTransfer(owner(), amount);
        rewardTokens[tokenAddress].totalReserves = rewardTokens[tokenAddress].totalReserves.sub(amount);
    }
}