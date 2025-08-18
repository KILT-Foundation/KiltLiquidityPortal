const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing MultiTokenTreasuryPool deployment and functionality...\n");

  // Deploy with test parameters
  const [owner, admin, user1, user2] = await ethers.getSigners();
  
  console.log("👥 Test Accounts:");
  console.log("- Owner:", owner.address);
  console.log("- Admin:", admin.address);
  console.log("- User1:", user1.address);
  console.log("- User2:", user2.address);

  // Deploy mock tokens for testing
  console.log("\n🪙 Deploying mock tokens...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  const kiltToken = await MockERC20.deploy("KILT Protocol", "KILT", 18);
  const wbtcToken = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
  const wethToken = await MockERC20.deploy("Wrapped Ethereum", "WETH", 18);

  await kiltToken.waitForDeployment();
  await wbtcToken.waitForDeployment();
  await wethToken.waitForDeployment();

  console.log("- KILT Token:", await kiltToken.getAddress());
  console.log("- WBTC Token:", await wbtcToken.getAddress());
  console.log("- WETH Token:", await wethToken.getAddress());

  // Deploy treasury pool
  console.log("\n🏦 Deploying MultiTokenTreasuryPool...");
  const MultiTokenTreasuryPool = await ethers.getContractFactory("MultiTokenTreasuryPool");
  const treasuryPool = await MultiTokenTreasuryPool.deploy(
    await kiltToken.getAddress(),
    admin.address
  );
  await treasuryPool.waitForDeployment();
  console.log("- Treasury Pool:", await treasuryPool.getAddress());

  // Test 1: Add supported tokens
  console.log("\n🔧 Test 1: Adding supported tokens...");
  await treasuryPool.connect(owner).addSupportedToken(await wbtcToken.getAddress(), "WBTC");
  await treasuryPool.connect(owner).addSupportedToken(await wethToken.getAddress(), "WETH");
  
  const supportedTokens = await treasuryPool.getSupportedTokens();
  console.log("✅ Supported tokens:", supportedTokens.length);

  // Test 2: Fund treasury
  console.log("\n💰 Test 2: Funding treasury...");
  
  // Mint tokens to admin
  await kiltToken.mint(admin.address, ethers.parseUnits("100000", 18));
  await wbtcToken.mint(admin.address, ethers.parseUnits("10", 8));
  await wethToken.mint(admin.address, ethers.parseUnits("100", 18));

  // Approve treasury to spend
  await kiltToken.connect(admin).approve(await treasuryPool.getAddress(), ethers.parseUnits("100000", 18));
  await wbtcToken.connect(admin).approve(await treasuryPool.getAddress(), ethers.parseUnits("10", 8));
  await wethToken.connect(admin).approve(await treasuryPool.getAddress(), ethers.parseUnits("100", 18));

  // Fund treasury
  await treasuryPool.connect(admin).fundTreasury(await kiltToken.getAddress(), ethers.parseUnits("50000", 18));
  await treasuryPool.connect(admin).fundTreasury(await wbtcToken.getAddress(), ethers.parseUnits("5", 8));
  await treasuryPool.connect(admin).fundTreasury(await wethToken.getAddress(), ethers.parseUnits("50", 18));

  const balanceData = await treasuryPool.getAllTreasuryBalances();
  console.log("✅ Treasury funded:");
  console.log("- KILT:", ethers.formatUnits(balanceData.balances[0], 18));
  console.log("- WBTC:", ethers.formatUnits(balanceData.balances[1], 8));
  console.log("- WETH:", ethers.formatUnits(balanceData.balances[2], 18));

  // Test 3: Register position
  console.log("\n📝 Test 3: Registering position...");
  const tokenId = 12345;
  const liquidityAmount = ethers.parseUnits("1000", 18);
  
  await treasuryPool.connect(admin).registerPosition(tokenId, user1.address, liquidityAmount);
  const userPositions = await treasuryPool.getUserPositions(user1.address);
  console.log("✅ Position registered:", userPositions[0].toString());

  // Test 4: Add multi-token rewards
  console.log("\n🎁 Test 4: Adding multi-token rewards...");
  
  await treasuryPool.connect(admin).addReward(user1.address, await kiltToken.getAddress(), ethers.parseUnits("1000", 18));
  await treasuryPool.connect(admin).addReward(user1.address, await wbtcToken.getAddress(), ethers.parseUnits("0.1", 8));
  await treasuryPool.connect(admin).addReward(user1.address, await wethToken.getAddress(), ethers.parseUnits("2", 18));

  const rewards = await treasuryPool.getUserRewards(user1.address);
  console.log("✅ Rewards added:", rewards.tokens.length);
  console.log("- KILT:", ethers.formatUnits(rewards.amounts[0], 18));
  console.log("- WBTC:", ethers.formatUnits(rewards.amounts[1], 8));
  console.log("- WETH:", ethers.formatUnits(rewards.amounts[2], 18));

  // Test 5: Fast forward time and claim rewards
  console.log("\n⏰ Test 5: Fast forwarding time and claiming rewards...");
  
  // Fast forward 7 days + 1 second
  await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
  await ethers.provider.send("evm_mine");

  // Check claimable rewards
  const claimableData = await treasuryPool.getClaimableRewards(user1.address);
  console.log("✅ Claimable rewards:", claimableData.claimableIndexes.length);

  // Claim all rewards
  const user1KiltBefore = await kiltToken.balanceOf(user1.address);
  const user1WbtcBefore = await wbtcToken.balanceOf(user1.address);
  const user1WethBefore = await wethToken.balanceOf(user1.address);

  await treasuryPool.connect(user1).claimRewards([0, 1, 2]);

  const user1KiltAfter = await kiltToken.balanceOf(user1.address);
  const user1WbtcAfter = await wbtcToken.balanceOf(user1.address);
  const user1WethAfter = await wethToken.balanceOf(user1.address);

  console.log("✅ Rewards claimed:");
  console.log("- KILT received:", ethers.formatUnits(user1KiltAfter - user1KiltBefore, 18));
  console.log("- WBTC received:", ethers.formatUnits(user1WbtcAfter - user1WbtcBefore, 8));
  console.log("- WETH received:", ethers.formatUnits(user1WethAfter - user1WethBefore, 18));

  // Test 6: Emergency functions
  console.log("\n🚨 Test 6: Testing emergency functions...");
  
  // Test pause
  await treasuryPool.connect(owner).pause();
  console.log("✅ Contract paused");

  // Test unpause
  await treasuryPool.connect(owner).unpause();
  console.log("✅ Contract unpaused");

  // Test emergency withdraw
  const ownerKiltBefore = await kiltToken.balanceOf(owner.address);
  await treasuryPool.connect(owner).emergencyWithdraw(
    await kiltToken.getAddress(),
    ethers.parseUnits("1000", 18),
    owner.address
  );
  const ownerKiltAfter = await kiltToken.balanceOf(owner.address);
  console.log("✅ Emergency withdraw:", ethers.formatUnits(ownerKiltAfter - ownerKiltBefore, 18), "KILT");

  console.log("\n🎉 All tests completed successfully!");
  console.log("\n📊 Final State:");
  
  const finalBalances = await treasuryPool.getAllTreasuryBalances();
  console.log("Treasury Balances:");
  console.log("- KILT:", ethers.formatUnits(finalBalances.balances[0], 18));
  console.log("- WBTC:", ethers.formatUnits(finalBalances.balances[1], 8));
  console.log("- WETH:", ethers.formatUnits(finalBalances.balances[2], 18));

  console.log("\nContract is ready for deployment! 🚀");
}

main()
  .then(() => {
    console.log("\n✅ Test deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test deployment failed:", error);
    process.exit(1);
  });