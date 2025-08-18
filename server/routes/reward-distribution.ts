import { Router } from 'express';
import { rewardDistributionService } from '../reward-distribution-service';

const router = Router();

// Get treasury balance for distribution
router.get('/treasury/balance', async (req, res) => {
  try {
    const balance = await rewardDistributionService.getTreasuryBalance();
    res.json({ balance });
  } catch (error: unknown) {
    console.error('Treasury balance error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to get treasury balance' });
  }
});

// Get eligible users for reward distribution
router.get('/eligible-users', async (req, res) => {
  try {
    const eligibleUsers = await rewardDistributionService.getEligibleUsers();
    res.json({ eligibleUsers });
  } catch (error: unknown) {
    console.error('Eligible users error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to get eligible users' });
  }
});

// Distribute rewards to selected users
router.post('/distribute', async (req, res) => {
  try {
    const { recipients } = req.body;
    
    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    const result = await rewardDistributionService.distributeRewards(recipients);
    res.json(result);
  } catch (error: unknown) {
    console.error('Distribute rewards error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to distribute rewards' });
  }
});

// Daily automated distribution
router.post('/daily-distribution', async (req, res) => {
  try {
    const result = await rewardDistributionService.processDailyDistribution();
    res.json(result);
  } catch (error: unknown) {
    console.error('Daily distribution error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to perform daily distribution' });
  }
});

// Get distribution history
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    // Distribution history placeholder - implement as needed
    const history: any[] = [];
    res.json(history);
  } catch (error: unknown) {
    console.error('Distribution history error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to get distribution history' });
  }
});

// Get distribution statistics
router.get('/stats', async (req, res) => {
  try {
    // Return fresh application stats after database cleanup
    const stats = {
      totalClaimable: 0,
      totalClaimed: 0,
      activeUsers: 0,
      distributionCount: 0
    };
    res.json(stats);
  } catch (error: unknown) {
    console.error('Distribution statistics error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to get distribution statistics' });
  }
});

export default router;