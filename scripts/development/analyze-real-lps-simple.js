// Simple script to analyze real LP positions using our existing API
import fetch from 'node-fetch';

const WALLET_ADDRESS = '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a';

async function analyzeRealLPsFromAPI() {
  try {
    console.log('🔍 Analyzing real LP positions using our existing API...');
    console.log(`Known wallet: ${WALLET_ADDRESS}`);

    // Get positions from our API
    const response = await fetch(`http://localhost:5000/api/positions/wallet/${WALLET_ADDRESS}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const positions = await response.json();
    console.log(`\n📊 Found ${positions.length} positions in known wallet`);

    if (positions.length > 0) {
      let totalLiquidity = 0;
      let totalValueUSD = 0;
      
      console.log('\n🏆 Active LP Positions:');
      positions.forEach((pos, i) => {
        const valueUSD = parseFloat(pos.currentValueUSD || '0');
        totalValueUSD += valueUSD;
        console.log(`${i + 1}. Token ID: ${pos.tokenId}, Value: $${valueUSD.toFixed(2)}, Range: ${pos.tickLower} to ${pos.tickUpper}`);
      });

      console.log(`\n💰 Total Position Value: $${totalValueUSD.toFixed(2)}`);

      // Get program analytics to compare
      const analyticsResponse = await fetch('http://localhost:5000/api/rewards/program-analytics');
      const analytics = await analyticsResponse.json();

      console.log('\n📈 COMPARISON WITH CURRENT APR CALCULATION:');
      console.log(`Current APR calculation assumes: $${analytics.totalLiquidity} TVL`);
      console.log(`Actual registered user TVL: $${totalValueUSD.toFixed(2)}`);
      console.log(`Participation rate: ${(totalValueUSD / analytics.totalLiquidity * 100).toFixed(2)}%`);

      // Calculate real APR
      const DAILY_BUDGET_USD = analytics.dailyBudget * 0.0182; // KILT price
      const ANNUAL_BUDGET_USD = DAILY_BUDGET_USD * 365;
      const realAPR = (ANNUAL_BUDGET_USD / totalValueUSD) * 100;

      console.log('\n🎯 REAL APR CALCULATION:');
      console.log(`Treasury Annual Budget: $${ANNUAL_BUDGET_USD.toFixed(0)}`);
      console.log(`Current APR shown: ${analytics.averageAPR.toFixed(1)}% (assumes $${analytics.totalLiquidity} participation)`);
      console.log(`Real APR for registered users: ${realAPR.toFixed(0)}% (based on $${totalValueUSD.toFixed(0)} actual participation)`);
      
      console.log('\n🔍 KEY FINDINGS:');
      console.log(`• Only ${(totalValueUSD / analytics.totalLiquidity * 100).toFixed(1)}% of pool TVL is registered for rewards`);
      console.log(`• Current 125% APR assumes 100% participation (unrealistic)`);  
      console.log(`• Real APR for actual participants is ~${Math.round(realAPR/100)*100}% (${Math.round(realAPR/analytics.averageAPR)}x higher)`);
      console.log(`• More users joining would dilute the APR towards the displayed 125%`);

      // Estimate how many real LPs exist
      const avgPositionValue = totalValueUSD / positions.length;
      const estimatedTotalLPs = Math.round(analytics.totalLiquidity / avgPositionValue);
      
      console.log('\n📊 POOL PARTICIPATION ESTIMATES:');
      console.log(`Average registered position value: $${avgPositionValue.toFixed(0)}`);
      console.log(`Estimated total LPs in pool: ~${estimatedTotalLPs} (if all positions similar size)`);
      console.log(`Currently registered: ${positions.length} positions (${analytics.activeParticipants} unique users)`);
      console.log(`Pool utilization for rewards: ${((positions.length / estimatedTotalLPs) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Error analyzing real LPs:', error.message);
  }
}

analyzeRealLPsFromAPI();