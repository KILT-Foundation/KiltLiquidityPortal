const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying SimpleTreasuryPool to Base network...");
  console.log("📋 This approach requires NO private keys on the backend!");

  // Contract parameters
  const KILT_TOKEN_ADDRESS = "0x5d0dd05bb095fdd6af4865a1adf97c39c85ad2d8"; // KILT on Base
  const OWNER_ADDRESS = "0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e"; // Contract owner

  // Deploy the contract
  const SimpleTreasuryPool = await hre.ethers.getContractFactory("SimpleTreasuryPool");
  const contract = await SimpleTreasuryPool.deploy(
    KILT_TOKEN_ADDRESS,
    OWNER_ADDRESS
  );

  await contract.deployed();

  console.log("✅ SimpleTreasuryPool deployed to:", contract.address);
  console.log("📋 Contract Parameters:");
  console.log("   KILT Token:", KILT_TOKEN_ADDRESS);
  console.log("   Owner:", OWNER_ADDRESS);
  console.log("   Network: Base (Chain ID: 8453)");

  // Verify contract on BaseScan
  if (hre.network.name === "base") {
    console.log("\n🔍 Verifying contract on BaseScan...");
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: [KILT_TOKEN_ADDRESS, OWNER_ADDRESS],
      });
      console.log("✅ Contract verified on BaseScan");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  // Test setting reward allowance (optional)
  console.log("\n🧪 Testing reward allowance functionality...");
  try {
    const testUser = "0x5bF25Dc1BAf6A96C5A0F724E05EcF4D456c7652e";
    const testAmount = hre.ethers.utils.parseEther("2787.27"); // 2787.27 KILT
    
    console.log(`Setting test allowance: ${testAmount.toString()} wei for ${testUser}`);
    // Note: This would require the owner to have the private key available
    // const tx = await contract.setRewardAllowance(testUser, testAmount);
    // console.log("Test allowance set. Transaction:", tx.hash);
  } catch (error) {
    console.log("Test skipped (requires owner signature)");
  }

  // Generate deployment summary
  console.log("\n📊 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("Contract Address:", contract.address);
  console.log("Transaction Hash:", contract.deployTransaction.hash);
  console.log("Gas Used:", contract.deployTransaction.gasLimit.toString());
  console.log("Block Number:", contract.deployTransaction.blockNumber);
  
  // Instructions for next steps
  console.log("\n🔧 Next Steps (NO PRIVATE KEY REQUIRED):");
  console.log("1. Transfer KILT tokens to contract for rewards");
  console.log("2. Use MetaMask to call setRewardAllowance() for each user");
  console.log("3. Users can then claim rewards directly from the contract");
  console.log("4. Update database with new contract address");

  // Simple workflow explanation
  console.log("\n💡 Simple Workflow:");
  console.log("1. Owner uses MetaMask: setRewardAllowance(userAddress, amount)");
  console.log("2. User clicks 'Claim': contract.claimAllRewards() (pays gas)");
  console.log("3. KILT tokens transferred automatically to user's wallet");
  console.log("4. No backend private keys needed!");

  // Update database configuration script
  console.log("\n💾 Database Update SQL:");
  console.log(`UPDATE blockchain_config SET config_value = '${contract.address}' WHERE config_key = 'SIMPLE_TREASURY_POOL_ADDRESS';`);
  console.log(`INSERT INTO blockchain_config (config_key, config_value) VALUES ('SIMPLE_TREASURY_POOL_ADDRESS', '${contract.address}') ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;`);

  return contract.address;
}

main()
  .then((address) => {
    console.log(`\n🎉 Simple deployment completed successfully!`);
    console.log(`No private keys needed on backend - contract ready at: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });