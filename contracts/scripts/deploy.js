const { ethers } = require("hardhat");

async function main() {
  // Get deployment parameters
  const KILT_TOKEN_ADDRESS = process.env.KILT_TOKEN_ADDRESS || "0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8"; // KILT on Base
  const INITIAL_ADMIN = process.env.INITIAL_ADMIN_ADDRESS;

  if (!INITIAL_ADMIN) {
    throw new Error("Please set INITIAL_ADMIN_ADDRESS environment variable");
  }

  console.log("Deploying MultiTokenTreasuryPool with:");
  console.log("- KILT Token:", KILT_TOKEN_ADDRESS);
  console.log("- Initial Admin:", INITIAL_ADMIN);
  console.log("- Deployer:", (await ethers.getSigners())[0].address);

  // Deploy the contract
  const MultiTokenTreasuryPool = await ethers.getContractFactory("MultiTokenTreasuryPool");
  const treasuryPool = await MultiTokenTreasuryPool.deploy(KILT_TOKEN_ADDRESS, INITIAL_ADMIN);

  await treasuryPool.waitForDeployment();
  const contractAddress = await treasuryPool.getAddress();

  console.log("\n✅ MultiTokenTreasuryPool deployed to:", contractAddress);

  // Verify initial state
  console.log("\n📋 Contract State:");
  console.log("- Primary Token:", await treasuryPool.primaryToken());
  console.log("- Initial Admin Authorized:", await treasuryPool.authorizedAdmins(INITIAL_ADMIN));
  console.log("- Lock Period Days:", (await treasuryPool.lockPeriodDays()).toString());
  console.log("- Owner:", await treasuryPool.owner());

  // Get supported tokens
  const supportedTokens = await treasuryPool.getSupportedTokens();
  console.log("- Supported Tokens:", supportedTokens);

  console.log("\n🔧 Next Steps:");
  console.log("1. Add additional reward tokens using addSupportedToken()");
  console.log("2. Fund treasury using fundTreasury(token, amount)");
  console.log("3. Update backend with contract address:", contractAddress);
  console.log("4. Test contract integration before production use");

  // Save deployment info
  const deploymentInfo = {
    contractAddress,
    kiltTokenAddress: KILT_TOKEN_ADDRESS,
    initialAdmin: INITIAL_ADMIN,
    deployer: (await ethers.getSigners())[0].address,
    network: (await ethers.provider.getNetwork()).name,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };

  console.log("\n💾 Deployment Info:", JSON.stringify(deploymentInfo, null, 2));

  return contractAddress;
}

main()
  .then((contractAddress) => {
    console.log("\n🎉 Deployment completed successfully!");
    console.log("Contract Address:", contractAddress);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });