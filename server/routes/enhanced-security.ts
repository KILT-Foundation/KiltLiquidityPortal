import { Router } from 'express';
import { z } from 'zod';
import { SmartContractService } from '../smart-contract-service';

const router = Router();
const contractService = new SmartContractService();

// Enhanced signature generation endpoint
const generateSignatureSchema = z.object({
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z.number().positive('Amount must be positive')
});

router.post('/generate-claim-signature', async (req, res) => {
  try {
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'User address is required'
      });
    }
    
    // Get user's calculated rewards from the reward service
    const { db } = await import('../db');
    const { users } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    const user = await db.select().from(users).where(eq(users.address, userAddress)).limit(1);
    
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found or no liquidity positions'
      });
    }
    
    const userId = user[0].id;
    
    // Import reward service and get user's calculated rewards
    const { unifiedRewardService } = await import('../unified-reward-service');
    const userRewards = await unifiedRewardService.getUserRewardStats(userId);
    
    const claimableAmount = userRewards.totalClaimable || 0;
    
    if (claimableAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No rewards available for claiming. Start providing liquidity to earn KILT rewards.'
      });
    }
    
    console.log(`🔐 Generating secure signature for ${userAddress}: ${claimableAmount} KILT (from calculated rewards)`);
    
    const result = await contractService.generateClaimSignature(userAddress, claimableAmount);
    
    if ('error' in result) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      signature: result.signature,
      nonce: result.nonce,
      amount: claimableAmount,
      userAddress
    });
  } catch (error: unknown) {
    console.error('Enhanced signature generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Signature generation failed'
    });
  }
});

// Calculator authorization management
const calculatorAuthSchema = z.object({
  calculatorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid calculator address')
});

router.post('/set-pending-calculator', async (req, res) => {
  // Validate request body
  const validation = calculatorAuthSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid calculator address'
    });
  }
  try {
    const { calculatorAddress } = validation.data;
    
    console.log(`🔐 Setting pending calculator: ${calculatorAddress}`);
    
    const result = await contractService.setPendingCalculatorAuthorization(calculatorAddress);
    
    res.json(result);
  } catch (error: unknown) {
    console.error('Set pending calculator failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set pending calculator'
    });
  }
});

router.post('/activate-calculator', async (req, res) => {
  // Validate request body
  const validation = calculatorAuthSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid calculator address'
    });
  }
  try {
    const { calculatorAddress } = validation.data;
    
    console.log(`🔐 Activating calculator: ${calculatorAddress}`);
    
    const result = await contractService.activatePendingCalculator(calculatorAddress);
    
    res.json(result);
  } catch (error: unknown) {
    console.error('Activate calculator failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate calculator'
    });
  }
});

// Security status endpoints
router.get('/user-security-status/:userAddress', async (req, res) => {
  try {
    const { userAddress } = req.params;
    
    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }
    
    // This would typically call contract methods to get security status
    // For now, return a placeholder response
    res.json({
      success: true,
      userAddress,
      currentNonce: 0, // await contract.nonces(userAddress)
      maxClaimLimit: 0, // await contract.getMaxClaimLimit(userAddress)
      lastClaimTime: 0, // await contract.lastClaimTime(userAddress)
      canClaim: true // await contract.canUserClaim(userAddress)
    });
  } catch (error: unknown) {
    console.error('Get user security status failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security status'
    });
  }
});

export default router;