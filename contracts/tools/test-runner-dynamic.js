const { exec } = require('child_process');
const path = require('path');

console.log('🚀 Starting DynamicTreasuryPool Contract Tests...\n');

// Run the specific test file
const testCommand = 'npx hardhat test test/DynamicTreasuryPool.test.js';

console.log(`Executing: ${testCommand}\n`);

exec(testCommand, { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Test execution failed:');
        console.error(error);
        return;
    }
    
    if (stderr) {
        console.error('⚠️  Test warnings/errors:');
        console.error(stderr);
    }
    
    console.log('📊 Test Results:');
    console.log(stdout);
    
    // Check if tests passed
    if (stdout.includes('passing') && !stdout.includes('failing')) {
        console.log('\n✅ All tests passed successfully!');
    } else {
        console.log('\n❌ Some tests failed. Check the output above for details.');
    }
});
