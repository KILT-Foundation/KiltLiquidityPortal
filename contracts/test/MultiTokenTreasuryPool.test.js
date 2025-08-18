// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiTokenTreasuryPool", function () {
  let treasuryPool;
  let kiltToken;
  let wbtcToken;
  let wethToken;
  let owner;
  let admin;
  let user1;
  let user2;
  let unauthorized;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18); // 1M tokens
  const LOCK_PERIOD_DAYS = 7;

  beforeEach(async function () {
    [owner, admin, user1, user2, unauthorized] = await ethers.getSigners();

    // Deploy mock ERC20 tokens for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    kiltToken = await MockERC20.deploy("KILT Protocol", "KILT", 18);
    wbtcToken = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
    wethToken = await MockERC20.deploy("Wrapped Ethereum", "WETH", 18);

    await kiltToken.waitForDeployment();
    await wbtcToken.waitForDeployment();
    await wethToken.waitForDeployment();

    // Deploy MultiTokenTreasuryPool with initial daily cap
    const MultiTokenTreasuryPool = await ethers.getContractFactory("MultiTokenTreasuryPool");
    const initialDailyCap = ethers.parseUnits("10000", 18); // 10K KILT daily cap
    treasuryPool = await MultiTokenTreasuryPool.deploy(
      await kiltToken.getAddress(),
      admin.address,
      initialDailyCap
    );
    await treasuryPool.waitForDeployment();

    // Mint tokens to admin for funding treasury
    await kiltToken.mint(admin.address, INITIAL_SUPPLY);
    await wbtcToken.mint(admin.address, ethers.parseUnits("100", 8)); // 100 WBTC
    await wethToken.mint(admin.address, ethers.parseUnits("1000", 18)); // 1000 ETH

    // Approve treasury to spend admin's tokens
    await kiltToken.connect(admin).approve(await treasuryPool.getAddress(), INITIAL_SUPPLY);
    await wbtcToken.connect(admin).approve(await treasuryPool.getAddress(), ethers.parseUnits("100", 8));
    await wethToken.connect(admin).approve(await treasuryPool.getAddress(), ethers.parseUnits("1000", 18));
  });

  describe("Deployment", function () {
    it("Should set the correct primary token", async function () {
      expect(await treasuryPool.primaryToken()).to.equal(await kiltToken.getAddress());
    });

    it("Should authorize initial admin", async function () {
      expect(await treasuryPool.authorizedAdmins(admin.address)).to.be.true;
    });

    it("Should add primary token to supported tokens", async function () {
      const supportedTokens = await treasuryPool.getSupportedTokens();
      expect(supportedTokens[0]).to.equal(await kiltToken.getAddress());
    });

    it("Should set correct lock period", async function () {
      expect(await treasuryPool.lockPeriodDays()).to.equal(LOCK_PERIOD_DAYS);
    });
  });

  describe("Token Management", function () {
    it("Should allow owner to add supported tokens", async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      
      const supportedTokens = await treasuryPool.getSupportedTokens();
      expect(supportedTokens).to.include(await wbtcToken.getAddress());
      expect(await treasuryPool.supportedTokens(await wbtcToken.getAddress())).to.be.true;
    });

    it("Should emit TokenAdded event", async function () {
      await expect(treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC"))
        .to.emit(treasuryPool, "TokenAdded")
        .withArgs(await wbtcToken.getAddress(), "WBTC");
    });

    it("Should not allow non-owner to add tokens", async function () {
      await expect(
        treasuryPool.connect(admin).addSupportedToken(await wbtcToken.getAddress(), "WBTC")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow adding duplicate tokens", async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      
      await expect(
        treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC")
      ).to.be.revertedWith("Token already supported");
    });

    it("Should allow owner to remove tokens", async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(owner).removeSupportedToken(await wbtcToken.getAddress());
      
      expect(await treasuryPool.supportedTokens(await wbtcToken.getAddress())).to.be.false;
    });

    it("Should not allow removing primary token", async function () {
      await expect(
        treasuryPool.connect(owner).removeSupportedToken(await kiltToken.getAddress())
      ).to.be.revertedWith("Cannot remove primary token");
    });
  });

  describe("Treasury Funding", function () {
    beforeEach(async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(owner).addSupportedToken(await wethToken.getAddress(), "WETH");
    });

    it("Should allow admin to fund treasury with KILT", async function () {
      const fundAmount = ethers.parseUnits("10000", 18);
      
      await expect(treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), fundAmount))
        .to.emit(treasuryPool, "TreasuryFunded")
        .withArgs(admin.address, await kiltToken.getAddress(), fundAmount);

      expect(await treasuryPool.getTreasuryBalance(await kiltToken.getAddress())).to.equal(fundAmount);
    });

    it("Should allow admin to fund treasury with multiple tokens", async function () {
      const kiltAmount = ethers.parseUnits("10000", 18);
      const wbtcAmount = ethers.parseUnits("5", 8);
      const wethAmount = ethers.parseUnits("100", 18);

      await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), kiltAmount);
      await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), wbtcAmount);
      await treasuryPool.connect(admin).fundTreasury(await wethToken.getAddress(), wethAmount);

      expect(await treasuryPool.getTreasuryBalance(await kiltToken.getAddress())).to.equal(kiltAmount);
      expect(await treasuryPool.getTreasuryBalance(await wbtcToken.getAddress())).to.equal(wbtcAmount);
      expect(await treasuryPool.getTreasuryBalance(await wethToken.getAddress())).to.equal(wethAmount);
    });

    it("Should not allow non-admin to fund treasury", async function () {
      await expect(
        treasuryPool.connect(unauthorized).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("1000", 18))
      ).to.be.revertedWith("Not authorized admin");
    });

    it("Should not allow funding with unsupported token", async function () {
      // Deploy another token that's not added to supported list
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const unsupportedToken = await MockERC20.deploy("Unsupported", "UNSUP", 18);
      
      await expect(
        treasuryPool.connect(admin).fundTreasury(await unsupportedToken.getAddress(), ethers.parseUnits("1000", 18))
      ).to.be.revertedWith("Token not supported");
    });
  });

  describe("Position Registration", function () {
    it("Should allow admin to register positions", async function () {
      const tokenId = 12345;
      const liquidityAmount = ethers.parseUnits("1000", 18);

      await expect(treasuryPool.connect(admin).registerPosition(tokenId, user1.address, liquidityAmount))
        .to.emit(treasuryPool, "PositionRegistered")
        .withArgs(tokenId, user1.address, liquidityAmount);

      const position = await treasuryPool.positions(tokenId);
      expect(position.tokenId).to.equal(tokenId);
      expect(position.owner).to.equal(user1.address);
      expect(position.liquidityAmount).to.equal(liquidityAmount);
      expect(position.isActive).to.be.true;

      const userPositions = await treasuryPool.getUserPositions(user1.address);
      expect(userPositions[0]).to.equal(tokenId);
    });

    it("Should not allow registering duplicate positions", async function () {
      const tokenId = 12345;
      const liquidityAmount = ethers.parseUnits("1000", 18);

      await treasuryPool.connect(admin).registerPosition(tokenId, user1.address, liquidityAmount);
      
      await expect(
        treasuryPool.connect(admin).registerPosition(tokenId, user2.address, liquidityAmount)
      ).to.be.revertedWith("Position already registered");
    });

    it("Should not allow non-admin to register positions", async function () {
      await expect(
        treasuryPool.connect(unauthorized).registerPosition(12345, user1.address, ethers.parseUnits("1000", 18))
      ).to.be.revertedWith("Not authorized admin");
    });
  });

  describe("Reward Management", function () {
    beforeEach(async function () {
      // Add supported tokens and fund treasury
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(owner).addSupportedToken(await wethToken.getAddress(), "WETH");
      
      await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("10000", 18));
      await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), ethers.parseUnits("5", 8));
      await treasuryPool.connect(admin).fundTreasury(await wethToken.getAddress(), ethers.parseUnits("100", 18));
    });

    it("Should allow admin to add rewards in active token", async function () {
      const rewardAmount = ethers.parseUnits("100", 18);
      
      // KILT is set as active reward token by default
      expect(await treasuryPool.getActiveRewardToken()).to.equal(await kiltToken.getAddress());
      
      await expect(treasuryPool.connect(admin).addReward(user1.address, rewardAmount))
        .to.emit(treasuryPool, "RewardAdded");

      const rewards = await treasuryPool.getUserRewards(user1.address);
      expect(rewards.tokens[0]).to.equal(await kiltToken.getAddress());
      expect(rewards.amounts[0]).to.equal(rewardAmount);
      expect(rewards.claimedStatus[0]).to.be.false;
    });

    it("Should allow admin to switch active reward token", async function () {
      // Initially KILT is active
      expect(await treasuryPool.getActiveRewardToken()).to.equal(await kiltToken.getAddress());
      
      // Switch to WBTC as active reward token
      await expect(treasuryPool.connect(admin).setActiveRewardToken(await wbtcToken.getAddress(), "WBTC"))
        .to.emit(treasuryPool, "ActiveRewardTokenChanged")
        .withArgs(await kiltToken.getAddress(), await wbtcToken.getAddress(), "WBTC");
      
      expect(await treasuryPool.getActiveRewardToken()).to.equal(await wbtcToken.getAddress());
      
      // Add reward in new active token (WBTC)
      const wbtcReward = ethers.parseUnits("0.1", 8);
      await treasuryPool.connect(admin).addReward(user1.address, wbtcReward);

      const rewards = await treasuryPool.getUserRewards(user1.address);
      expect(rewards.tokens[0]).to.equal(await wbtcToken.getAddress());
      expect(rewards.amounts[0]).to.equal(wbtcReward);
    });

    it("Should set correct unlock time", async function () {
      const rewardAmount = ethers.parseUnits("100", 18);
      const beforeTime = Math.floor(Date.now() / 1000);
      
      await treasuryPool.connect(admin).addReward(user1.address, await kiltToken.getAddress(), rewardAmount);
      
      const afterTime = Math.floor(Date.now() / 1000);
      const rewards = await treasuryPool.getUserRewards(user1.address);
      const unlockTime = Number(rewards.unlockTimes[0]);
      
      // Should be approximately 7 days from now
      const expectedUnlockTime = beforeTime + (LOCK_PERIOD_DAYS * 24 * 60 * 60);
      expect(unlockTime).to.be.closeTo(expectedUnlockTime, 10); // Within 10 seconds
    });

    it("Should not allow adding rewards with insufficient treasury balance", async function () {
      const excessiveReward = ethers.parseUnits("20000", 18); // More than funded amount
      
      await expect(
        treasuryPool.connect(admin).addReward(user1.address, excessiveReward)
      ).to.be.revertedWith("Insufficient treasury balance");
    });

    it("Should not allow setting unsupported token as active", async function () {
      // Deploy another token that's not added to supported list
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const unsupportedToken = await MockERC20.deploy("Unsupported", "UNSUP", 18);
      
      await expect(
        treasuryPool.connect(admin).setActiveRewardToken(await unsupportedToken.getAddress(), "UNSUP")
      ).to.be.revertedWith("Token not supported");
    });

    it("Should not allow non-admin to set active reward token", async function () {
      await expect(
        treasuryPool.connect(unauthorized).setActiveRewardToken(await wbtcToken.getAddress(), "WBTC")
      ).to.be.revertedWith("Not authorized admin");
    });

    it("Should show correct active reward token balance", async function () {
      // Initially KILT is active with 10000 tokens funded
      expect(await treasuryPool.getActiveRewardTokenBalance()).to.equal(ethers.parseUnits("10000", 18));
      
      // Switch to WBTC
      await treasuryPool.connect(admin).setActiveRewardToken(await wbtcToken.getAddress(), "WBTC");
      expect(await treasuryPool.getActiveRewardTokenBalance()).to.equal(ethers.parseUnits("5", 8));
    });

    it("Should enforce daily distribution cap", async function () {
      // Check initial daily cap (should be set in constructor)
      const initialCap = await treasuryPool.dailyDistributionCap();
      expect(initialCap).to.be.gt(0);
      
      // Add reward within cap
      const rewardAmount = ethers.parseUnits("100", 18);
      await expect(treasuryPool.connect(admin).addReward(user1.address, rewardAmount))
        .to.emit(treasuryPool, "RewardAdded");
      
      // Check daily distribution status
      const status = await treasuryPool.getCurrentDayDistributionStatus();
      expect(status.distributed).to.equal(rewardAmount);
      expect(status.cap).to.equal(initialCap);
      expect(status.remaining).to.equal(initialCap - rewardAmount);
    });

    it("Should allow owner to update daily distribution cap", async function () {
      const newCap = ethers.parseUnits("5000", 18);
      
      await expect(treasuryPool.connect(owner).updateDailyDistributionCap(newCap))
        .to.emit(treasuryPool, "DailyDistributionCapUpdated")
        .withArgs(newCap);
      
      expect(await treasuryPool.dailyDistributionCap()).to.equal(newCap);
    });

    it("Should prevent rewards when daily cap is exceeded", async function () {
      // Set a small daily cap
      const smallCap = ethers.parseUnits("50", 18);
      await treasuryPool.connect(owner).updateDailyDistributionCap(smallCap);
      
      // First reward within cap
      await treasuryPool.connect(admin).addReward(user1.address, ethers.parseUnits("30", 18));
      
      // Second reward that would exceed cap
      await expect(
        treasuryPool.connect(admin).addReward(user2.address, ethers.parseUnits("25", 18))
      ).to.be.revertedWith("Daily distribution cap exceeded");
    });

    it("Should not allow non-owner to update daily cap", async function () {
      await expect(
        treasuryPool.connect(admin).updateDailyDistributionCap(ethers.parseUnits("1000", 18))
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Reward Claiming", function () {
    beforeEach(async function () {
      // Setup tokens and fund treasury
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(owner).addSupportedToken(await wethToken.getAddress(), "WETH");
      
      await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("10000", 18));
      await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), ethers.parseUnits("5", 8));
      await treasuryPool.connect(admin).fundTreasury(await wethToken.getAddress(), ethers.parseUnits("100", 18));

      // Add rewards
      await treasuryPool.connect(admin).addReward(user1.address, await kiltToken.getAddress(), ethers.parseUnits("100", 18));
      await treasuryPool.connect(admin).addReward(user1.address, await wbtcToken.getAddress(), ethers.parseUnits("0.1", 8));
    });

    it("Should not allow claiming locked rewards", async function () {
      await expect(
        treasuryPool.connect(user1).claimRewards([0, 1])
      ).to.be.revertedWith("Reward still locked");
    });

    it("Should allow claiming unlocked rewards", async function () {
      // Fast forward time past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD_DAYS * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      const user1BalanceBefore = await kiltToken.balanceOf(user1.address);
      const user1WbtcBefore = await wbtcToken.balanceOf(user1.address);

      await expect(treasuryPool.connect(user1).claimRewards([0, 1]))
        .to.emit(treasuryPool, "RewardClaimed")
        .and.to.emit(treasuryPool, "RewardClaimed");

      const user1BalanceAfter = await kiltToken.balanceOf(user1.address);
      const user1WbtcAfter = await wbtcToken.balanceOf(user1.address);

      expect(user1BalanceAfter - user1BalanceBefore).to.equal(ethers.parseUnits("100", 18));
      expect(user1WbtcAfter - user1WbtcBefore).to.equal(ethers.parseUnits("0.1", 8));
    });

    it("Should not allow claiming already claimed rewards", async function () {
      // Fast forward time and claim
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD_DAYS * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await treasuryPool.connect(user1).claimRewards([0]);
      
      // Try to claim again
      await expect(
        treasuryPool.connect(user1).claimRewards([0])
      ).to.be.revertedWith("Reward already claimed");
    });

    it("Should show correct claimable rewards", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD_DAYS * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      const claimableData = await treasuryPool.getClaimableRewards(user1.address);
      
      expect(claimableData.claimableIndexes.length).to.equal(2);
      expect(claimableData.claimableTokens[0]).to.equal(await kiltToken.getAddress());
      expect(claimableData.claimableTokens[1]).to.equal(await wbtcToken.getAddress());
      expect(claimableData.claimableAmounts[0]).to.equal(ethers.parseUnits("100", 18));
      expect(claimableData.claimableAmounts[1]).to.equal(ethers.parseUnits("0.1", 8));
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("10000", 18));
      await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), ethers.parseUnits("5", 8));
    });

    it("Should allow owner to emergency withdraw", async function () {
      const withdrawAmount = ethers.parseUnits("1000", 18);
      const ownerBalanceBefore = await kiltToken.balanceOf(owner.address);

      await expect(treasuryPool.connect(owner).emergencyWithdraw(
        await kiltToken.getAddress(),
        withdrawAmount,
        owner.address
      )).to.emit(treasuryPool, "TreasuryWithdrawn");

      const ownerBalanceAfter = await kiltToken.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(withdrawAmount);
    });

    it("Should allow owner to pause contract", async function () {
      await treasuryPool.connect(owner).pause();
      expect(await treasuryPool.paused()).to.be.true;

      // Should prevent adding rewards when paused
      await expect(
        treasuryPool.connect(admin).addReward(user1.address, await kiltToken.getAddress(), ethers.parseUnits("100", 18))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to update lock period", async function () {
      const newLockPeriod = 14; // 14 days
      
      await expect(treasuryPool.connect(owner).updateLockPeriod(newLockPeriod))
        .to.emit(treasuryPool, "LockPeriodUpdated")
        .withArgs(newLockPeriod);

      expect(await treasuryPool.lockPeriodDays()).to.equal(newLockPeriod);
    });
  });

  describe("Admin Management", function () {
    it("Should allow owner to authorize new admin", async function () {
      await expect(treasuryPool.connect(owner).authorizeAdmin(user1.address))
        .to.emit(treasuryPool, "AdminAuthorized")
        .withArgs(user1.address);

      expect(await treasuryPool.authorizedAdmins(user1.address)).to.be.true;
    });

    it("Should allow owner to revoke admin", async function () {
      await treasuryPool.connect(owner).authorizeAdmin(user1.address);
      
      await expect(treasuryPool.connect(owner).revokeAdmin(user1.address))
        .to.emit(treasuryPool, "AdminRevoked")
        .withArgs(user1.address);

      expect(await treasuryPool.authorizedAdmins(user1.address)).to.be.false;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
      await treasuryPool.connect(owner).addSupportedToken(await wethToken.getAddress(), "WETH");
      
      await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("10000", 18));
      await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), ethers.parseUnits("5", 8));
      await treasuryPool.connect(admin).fundTreasury(await wethToken.getAddress(), ethers.parseUnits("100", 18));
    });

    it("Should return all treasury balances", async function () {
      const balanceData = await treasuryPool.getAllTreasuryBalances();
      
      expect(balanceData.tokens.length).to.equal(3);
      expect(balanceData.balances[0]).to.equal(ethers.parseUnits("10000", 18)); // KILT
      expect(balanceData.balances[1]).to.equal(ethers.parseUnits("5", 8));      // WBTC
      expect(balanceData.balances[2]).to.equal(ethers.parseUnits("100", 18));   // WETH
    });

    it("Should return supported tokens list", async function () {
      const supportedTokens = await treasuryPool.getSupportedTokens();
      
      expect(supportedTokens.length).to.equal(3);
      expect(supportedTokens[0]).to.equal(await kiltToken.getAddress());
      expect(supportedTokens[1]).to.equal(await wbtcToken.getAddress());
      expect(supportedTokens[2]).to.equal(await wethToken.getAddress());
    });
  });
});