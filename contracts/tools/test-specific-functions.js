const { ethers } = require("hardhat");

async function testSpecificFunctions() {
    console.log('🧪 Testing Specific DynamicTreasuryPool Functions...\n');

    try {
        // Get signers
        const [owner, calculator1, calculator2, user1, user2, user3] = await ethers.getSigners();
        
        console.log('📋 Test Accounts:');
        console.log(`Owner: ${owner.address}`);
        console.log(`Calculator 1: ${calculator1.address}`);
        console.log(`Calculator 2: ${calculator2.address}`);
        console.log(`User 1: ${user1.address}`);
        console.log(`User 2: ${user2.address}`);
        console.log(`User 3: ${user3.address}\n`);

        // Deploy mock KILT token
        console.log('🪙 Deploying Mock KILT Token...');
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockKiltToken = await MockERC20.deploy("KILT Protocol", "KILT", 18);
        await mockKiltToken.waitForDeployment();
        console.log(`✅ Mock KILT Token deployed at: ${await mockKiltToken.getAddress()}`);

        // Deploy DynamicTreasuryPool
        console.log('\n🏗️  Deploying DynamicTreasuryPool...');
        const DynamicTreasuryPool = await ethers.getContractFactory("DynamicTreasuryPool");
        const dynamicTreasuryPool = await DynamicTreasuryPool.deploy(
            await mockKiltToken.getAddress(),
            owner.address
        );
        await dynamicTreasuryPool.waitForDeployment();
        console.log(`✅ DynamicTreasuryPool deployed at: ${await dynamicTreasuryPool.getAddress()}`);

        // Setup treasury
        console.log('\n💰 Setting up Treasury...');
        const TREASURY_AMOUNT = ethers.parseEther("100000"); // 100K tokens
        const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
        
        await mockKiltToken.mint(owner.address, INITIAL_SUPPLY);
        await mockKiltToken.transfer(await dynamicTreasuryPool.getAddress(), TREASURY_AMOUNT);
        console.log(`✅ Treasury funded with ${ethers.formatEther(TREASURY_AMOUNT)} KILT tokens`);

        // Test 1: Calculator Authorization
        console.log('\n🔐 Testing Calculator Authorization...');
        await dynamicTreasuryPool.setPendingCalculatorAuthorization(calculator1.address);
        console.log('✅ Calculator 1 pending authorization set');
        
        // Increase time by 1 hour
        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine");
        
        await dynamicTreasuryPool.activatePendingCalculator(calculator1.address);
        console.log('✅ Calculator 1 activated');
        
        const isAuthorized = await dynamicTreasuryPool.authorizedCalculators(calculator1.address);
        console.log(`✅ Calculator 1 authorized: ${isAuthorized}`);

        // Test 2: User Tracking
        console.log('\n👥 Testing User Tracking...');
        const REWARD_AMOUNT = ethers.parseEther("1000"); // 1K tokens
        
        // Create signature for user1
        const messageHash = await dynamicTreasuryPool._createMessageHash(
            user1.address,
            REWARD_AMOUNT,
            0 // nonce
        );
        const signature = await calculator1.signMessage(ethers.getBytes(messageHash));
        
        // Claim rewards
        await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature);
        console.log('✅ User 1 claimed rewards');
        
        const hasInteracted = await dynamicTreasuryPool.hasInteracted(user1.address);
        console.log(`✅ User 1 interaction tracked: ${hasInteracted}`);

        // Test 3: State Reset
        console.log('\n🔄 Testing State Reset Functionality...');
        console.log('Before reset:');
        console.log(`- Total claims processed: ${await dynamicTreasuryPool.totalClaimsProcessed()}`);
        console.log(`- Total amount claimed: ${ethers.formatEther(await dynamicTreasuryPool.totalAmountClaimed())} KILT`);
        console.log(`- User 1 claimed amount: ${ethers.formatEther(await dynamicTreasuryPool.claimedAmount(user1.address))} KILT`);
        
        // Reset all states
        await dynamicTreasuryPool.resetAllStates();
        console.log('✅ All states reset');
        
        console.log('After reset:');
        console.log(`- Total claims processed: ${await dynamicTreasuryPool.totalClaimsProcessed()}`);
        console.log(`- Total amount claimed: ${ethers.formatEther(await dynamicTreasuryPool.totalAmountClaimed())} KILT`);
        console.log(`- User 1 claimed amount: ${ethers.formatEther(await dynamicTreasuryPool.claimedAmount(user1.address))} KILT`);
        console.log(`- User 1 interaction tracked: ${await dynamicTreasuryPool.hasInteracted(user1.address)}`);

        // Test 4: Post-Reset Functionality
        console.log('\n🔄 Testing Post-Reset Functionality...');
        
        // User should be able to claim again after reset
        const newMessageHash = await dynamicTreasuryPool._createMessageHash(
            user1.address,
            REWARD_AMOUNT,
            0 // nonce resets to 0
        );
        const newSignature = await calculator1.signMessage(ethers.getBytes(newMessageHash));
        
        await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, newSignature);
        console.log('✅ User 1 successfully claimed rewards after reset');
        
        const newClaimedAmount = await dynamicTreasuryPool.claimedAmount(user1.address);
        console.log(`✅ New claimed amount: ${ethers.formatEther(newClaimedAmount)} KILT`);

        // Test 5: Contract Statistics
        console.log('\n📊 Testing Contract Statistics...');
        const stats = await dynamicTreasuryPool.getContractStats();
        console.log(`- Contract balance: ${ethers.formatEther(stats.balance)} KILT`);
        console.log(`- Total claims: ${stats.totalClaims}`);
        console.log(`- Total amount: ${ethers.formatEther(stats.totalAmount)} KILT`);

        // Test 6: Pause/Unpause
        console.log('\n⏸️  Testing Pause/Unpause Functionality...');
        await dynamicTreasuryPool.pause();
        console.log('✅ Contract paused');
        
        const isPaused = await dynamicTreasuryPool.paused();
        console.log(`✅ Contract paused state: ${isPaused}`);
        
        await dynamicTreasuryPool.unpause();
        console.log('✅ Contract unpaused');
        
        const isUnpaused = await dynamicTreasuryPool.paused();
        console.log(`✅ Contract paused state: ${isUnpaused}`);

        console.log('\n🎉 All specific function tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

// Run the tests
testSpecificFunctions()
    .then(() => {
        console.log('\n✨ Testing completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Testing failed:', error);
        process.exit(1);
    });
