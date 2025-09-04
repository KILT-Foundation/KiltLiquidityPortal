const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DynamicTreasuryPool", function () {
    let DynamicTreasuryPool, MockERC20;
    let dynamicTreasuryPool, mockKiltToken;
    let owner, calculator1, calculator2, user1, user2, user3;

    const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
    const TREASURY_AMOUNT = ethers.parseEther("100000"); // 100K tokens
    const REWARD_AMOUNT = ethers.parseEther("1000"); // 1K tokens
    const ABSOLUTE_MAX_CLAIM = ethers.parseEther("100000"); // 100K tokens

    // Helper function to create message hash (exactly matches the contract's internal _createMessageHash)
    function createMessageHash(user, totalRewardBalance, nonce) {

        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256'],
            [user, totalRewardBalance, nonce]
        );
        
       
        
        return messageHash;
    }

    beforeEach(async function () {
        [owner, calculator1, calculator2, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy mock KILT token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockKiltToken = await MockERC20.deploy("KILT Protocol", "KILT", 18);
        
        // Deploy DynamicTreasuryPool
        DynamicTreasuryPool = await ethers.getContractFactory("DynamicTreasuryPool");
        dynamicTreasuryPool = await DynamicTreasuryPool.deploy(
            await mockKiltToken.getAddress(),
            owner.address
        );
        
        // Mint tokens to owner and transfer to treasury
        await mockKiltToken.mint(owner.address, INITIAL_SUPPLY);
        await mockKiltToken.transfer(await dynamicTreasuryPool.getAddress(), TREASURY_AMOUNT);
        
        // Authorize calculator1 immediately for testing
        await dynamicTreasuryPool.setPendingCalculatorAuthorization(calculator1.address);
        await ethers.provider.send("evm_increaseTime", [3600]); // Increase time by 1 hour
        await dynamicTreasuryPool.activatePendingCalculator(calculator1.address);
    });

    describe("Deployment", function () {
        it("Should deploy with correct initial state", async function () {
            expect(await dynamicTreasuryPool.owner()).to.equal(owner.address);
            expect(await dynamicTreasuryPool.kiltToken()).to.equal(await mockKiltToken.getAddress());
            expect(await dynamicTreasuryPool.absoluteMaxClaim()).to.equal(ABSOLUTE_MAX_CLAIM);
            expect(await dynamicTreasuryPool.totalClaimsProcessed()).to.equal(0);
            expect(await dynamicTreasuryPool.totalAmountClaimed()).to.equal(0);
        });

        it("Should have correct treasury balance", async function () {
            expect(await dynamicTreasuryPool.getContractBalance()).to.equal(TREASURY_AMOUNT);
        });
    });

    describe("Calculator Authorization", function () {
        it("Should set pending calculator authorization", async function () {
            await dynamicTreasuryPool.setPendingCalculatorAuthorization(calculator2.address);
            const pendingInfo = await dynamicTreasuryPool.getPendingCalculatorInfo(calculator2.address);
            expect(pendingInfo.isPending).to.be.true;
            expect(pendingInfo.activationTime).to.be.gt(0);
        });

        it("Should activate calculator after delay", async function () {
            await dynamicTreasuryPool.setPendingCalculatorAuthorization(calculator2.address);
            await ethers.provider.send("evm_increaseTime", [3600]); // Increase time by 1 hour
            await dynamicTreasuryPool.activatePendingCalculator(calculator2.address);
            expect(await dynamicTreasuryPool.authorizedCalculators(calculator2.address)).to.be.true;
        });

        it("Should not activate calculator before delay", async function () {
            await dynamicTreasuryPool.setPendingCalculatorAuthorization(calculator2.address);
            await expect(
                dynamicTreasuryPool.activatePendingCalculator(calculator2.address)
            ).to.be.revertedWith("Activation delay not met");
        });

        it("Should revoke calculator authorization", async function () {
            await dynamicTreasuryPool.revokeCalculatorAuthorization(calculator1.address);
            expect(await dynamicTreasuryPool.authorizedCalculators(calculator1.address)).to.be.false;
        });
    });

    describe("Reward Claiming", function () {
        let signature;

        beforeEach(async function () {
            // Create signature for user1 to claim REWARD_AMOUNT
            const messageHash = createMessageHash(user1.address, REWARD_AMOUNT, 0);
            signature = await calculator1.signMessage(ethers.getBytes(messageHash));
        });

        it("Should claim rewards successfully", async function () {
            const initialBalance = await mockKiltToken.balanceOf(user1.address);
            const initialTreasuryBalance = await dynamicTreasuryPool.getContractBalance();
            
            await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature);
            
            expect(await mockKiltToken.balanceOf(user1.address)).to.equal(initialBalance + REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.getContractBalance()).to.equal(initialTreasuryBalance - REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.claimedAmount(user1.address)).to.equal(REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.totalClaimsProcessed()).to.equal(1);
            expect(await dynamicTreasuryPool.totalAmountClaimed()).to.equal(REWARD_AMOUNT);
        });

        it("Should track user interaction for reset capability", async function () {
            await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature);
            expect(await dynamicTreasuryPool.hasInteracted(user1.address)).to.be.true;
        });

        it("Should prevent replay attacks with nonce", async function () {
            await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature);
            
            // Try to claim again with same signature (should fail)
            await expect(
                dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature)
            ).to.be.revertedWith("Invalid calculator signature");
        });

        it("Should enforce absolute maximum claim limit", async function () {
            const largeAmount = ethers.parseEther("200000"); // Exceeds 100K limit
            const messageHash = createMessageHash(user1.address, largeAmount, 0);
            const largeSignature = await calculator1.signMessage(ethers.getBytes(messageHash));
            
            await expect(
                dynamicTreasuryPool.connect(user1).claimRewards(largeAmount, largeSignature)
            ).to.be.revertedWith("Reward balance exceeds maximum claim limit");
        });

        it("Should require valid calculator signature", async function () {
            const invalidSignature = "0x" + "1".repeat(130);
            await expect(
                dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, invalidSignature)
            ).to.be.reverted;
        });
    });

    describe("Emergency Claim", function () {
        it("Should allow owner to emergency claim for user", async function () {
            const initialBalance = await mockKiltToken.balanceOf(user1.address);
            const initialTreasuryBalance = await dynamicTreasuryPool.getContractBalance();
            
            await dynamicTreasuryPool.emergencyClaim(user1.address, REWARD_AMOUNT);
            
            expect(await mockKiltToken.balanceOf(user1.address)).to.equal(initialBalance + REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.getContractBalance()).to.equal(initialTreasuryBalance - REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.claimedAmount(user1.address)).to.equal(REWARD_AMOUNT);
        });

        it("Should track user interaction in emergency claim", async function () {
            await dynamicTreasuryPool.emergencyClaim(user1.address, REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.hasInteracted(user1.address)).to.be.true;
        });

        it("Should not allow non-owner to emergency claim", async function () {
            await expect(
                dynamicTreasuryPool.connect(user1).emergencyClaim(user2.address, REWARD_AMOUNT)
            ).to.be.revertedWithCustomError(dynamicTreasuryPool, "OwnableUnauthorizedAccount");
        });
    });

    describe("State Reset Functionality", function () {
        beforeEach(async function () {
            // Setup multiple users with claims
            const signature1 = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user1.address, REWARD_AMOUNT, 0))
            );
            const signature2 = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user2.address, REWARD_AMOUNT, 0))
            );
            
            await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature1);
            await dynamicTreasuryPool.connect(user2).claimRewards(REWARD_AMOUNT, signature2);
        });

        it("Should reset all states when called by owner", async function () {
            // Verify initial state
            expect(await dynamicTreasuryPool.totalClaimsProcessed()).to.equal(2);
            expect(await dynamicTreasuryPool.totalAmountClaimed()).to.equal(REWARD_AMOUNT * 2n);
            expect(await dynamicTreasuryPool.claimedAmount(user1.address)).to.equal(REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.claimedAmount(user2.address)).to.equal(REWARD_AMOUNT);
            expect(await dynamicTreasuryPool.hasInteracted(user1.address)).to.be.true;
            expect(await dynamicTreasuryPool.hasInteracted(user2.address)).to.be.true;
            
            // Reset all states
            await dynamicTreasuryPool.resetAllStates();
            
            // Verify reset state
            expect(await dynamicTreasuryPool.totalClaimsProcessed()).to.equal(0);
            expect(await dynamicTreasuryPool.totalAmountClaimed()).to.equal(0);
            expect(await dynamicTreasuryPool.claimedAmount(user1.address)).to.equal(0);
            expect(await dynamicTreasuryPool.claimedAmount(user2.address)).to.equal(0);
            expect(await dynamicTreasuryPool.hasInteracted(user1.address)).to.be.false;
            expect(await dynamicTreasuryPool.hasInteracted(user2.address)).to.be.false;
        });

        it("Should not allow non-owner to reset states", async function () {
            await expect(
                dynamicTreasuryPool.connect(user1).resetAllStates()
            ).to.be.revertedWithCustomError(dynamicTreasuryPool, "OwnableUnauthorizedAccount");
        });

        it("Should emit StatesReset event", async function () {
            await expect(dynamicTreasuryPool.resetAllStates())
                .to.emit(dynamicTreasuryPool, "StatesReset");
        });

        it("Should allow users to claim again after reset", async function () {
            await dynamicTreasuryPool.resetAllStates();
            
            // Users should be able to claim again
            const signature1 = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user1.address, REWARD_AMOUNT, 0))
            );
            
            await expect(
                dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature1)
            ).to.not.be.reverted;
        });
    });

    describe("Treasury Management", function () {
        it("Should allow owner to deposit tokens", async function () {
            const depositAmount = ethers.parseEther("10000");
            await mockKiltToken.approve(await dynamicTreasuryPool.getAddress(), depositAmount);
            
            await expect(dynamicTreasuryPool.depositTreasury(depositAmount))
                .to.emit(dynamicTreasuryPool, "TreasuryDeposit")
                .withArgs(depositAmount);
            
            expect(await dynamicTreasuryPool.getContractBalance()).to.equal(TREASURY_AMOUNT + depositAmount);
        });

        it("Should allow owner to withdraw tokens", async function () {
            const withdrawAmount = ethers.parseEther("10000");
            const initialOwnerBalance = await mockKiltToken.balanceOf(owner.address);
            
            await expect(dynamicTreasuryPool.emergencyWithdraw(withdrawAmount))
                .to.emit(dynamicTreasuryPool, "TreasuryWithdraw")
                .withArgs(withdrawAmount);
            
            expect(await mockKiltToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + withdrawAmount);
        });

        it("Should allow owner to withdraw all tokens", async function () {
            const initialOwnerBalance = await mockKiltToken.balanceOf(owner.address);
            
            await dynamicTreasuryPool.emergencyWithdraw(0); // 0 means withdraw all
            
            expect(await dynamicTreasuryPool.getContractBalance()).to.equal(0);
            expect(await mockKiltToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + TREASURY_AMOUNT);
        });
    });

    describe("Pause/Unpause Functionality", function () {
        it("Should allow owner to pause contract", async function () {
            await expect(dynamicTreasuryPool.pause())
                .to.emit(dynamicTreasuryPool, "ContractPaused");
            
            expect(await dynamicTreasuryPool.paused()).to.be.true;
        });

        it("Should allow owner to unpause contract", async function () {
            await dynamicTreasuryPool.pause();
            
            await expect(dynamicTreasuryPool.unpause())
                .to.emit(dynamicTreasuryPool, "ContractUnpaused");
            
            expect(await dynamicTreasuryPool.paused()).to.be.false;
        });

        it("Should not allow claims when paused", async function () {
            await dynamicTreasuryPool.pause();
            
            const signature = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user1.address, REWARD_AMOUNT, 0))
            );
            
            await expect(
                dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature)
            ).to.be.reverted;
        });
    });

    describe("View Functions", function () {
        it("Should return correct user stats", async function () {
            const stats = await dynamicTreasuryPool.getUserStats(user1.address);
            expect(stats.claimed).to.equal(0);
            expect(stats.lastClaim).to.equal(0);
            expect(stats.canClaimAt).to.equal(0);
            expect(stats.currentNonce).to.equal(0);
        });

        it("Should return correct contract stats", async function () {
            const stats = await dynamicTreasuryPool.getContractStats();
            expect(stats.balance).to.equal(TREASURY_AMOUNT);
            expect(stats.totalClaims).to.equal(0);
            expect(stats.totalAmount).to.equal(0);
        });

        it("Should return correct absolute max claim", async function () {
            expect(await dynamicTreasuryPool.getAbsoluteMaxClaim()).to.equal(ABSOLUTE_MAX_CLAIM);
        });

        it("Should check if user can claim", async function () {
            expect(await dynamicTreasuryPool.canUserClaim(user1.address, REWARD_AMOUNT)).to.be.true;
            expect(await dynamicTreasuryPool.canUserClaim(user1.address, ethers.parseEther("200000"))).to.be.false;
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle multiple users correctly", async function () {
            // User 1 claims
            const signature1 = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user1.address, REWARD_AMOUNT, 0))
            );
            await dynamicTreasuryPool.connect(user1).claimRewards(REWARD_AMOUNT, signature1);
            
            // User 2 claims
            const signature2 = await calculator1.signMessage(
                ethers.getBytes(createMessageHash(user2.address, REWARD_AMOUNT, 0))
            );
            await dynamicTreasuryPool.connect(user2).claimRewards(REWARD_AMOUNT, signature2);
            
            expect(await dynamicTreasuryPool.totalClaimsProcessed()).to.equal(2);
            expect(await dynamicTreasuryPool.totalAmountClaimed()).to.equal(REWARD_AMOUNT * 2n);
        });

        it("Should prevent unauthorized access to internal functions", async function () {
            // These functions should not be accessible externally
            // Note: In newer versions of OpenZeppelin, these functions may not exist in the ABI
            // So we test that they're not callable by checking if they exist
            expect(typeof dynamicTreasuryPool._createMessageHash).to.equal('undefined');
            expect(typeof dynamicTreasuryPool._recoverSignerOptimized).to.equal('undefined');
        });
    });
});
