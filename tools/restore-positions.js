#!/usr/bin/env node

// Quick script to restore the missing positions that are active on blockchain but missing from database

const { PositionRegistrationService } = require('../server/position-registration-service.js');

async function restorePositions() {
  console.log('🔧 Restoring missing positions...');
  
  const registrationService = new PositionRegistrationService();
  
  const positionsToRestore = [
    { tokenId: '3534947', walletAddress: '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a' },
    { tokenId: '3689299', walletAddress: '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a' },
    { tokenId: '3689302', walletAddress: '0xAFff1831e663B6F29fb90871Ea8518e8f8B3b71a' }
  ];
  
  for (const position of positionsToRestore) {
    try {
      console.log(`Restoring position ${position.tokenId}...`);
      const result = await registrationService.registerPosition(
        position.walletAddress,
        position.tokenId,
        null, // sessionId
        null  // transactionHash
      );
      console.log(`✅ Position ${position.tokenId} restored:`, result);
    } catch (error) {
      console.error(`❌ Failed to restore position ${position.tokenId}:`, error.message);
    }
  }
  
  console.log('🎯 Position restoration complete');
}

restorePositions().catch(console.error);