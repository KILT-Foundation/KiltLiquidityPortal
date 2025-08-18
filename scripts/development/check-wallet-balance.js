// Quick wallet balance checker for testing
const BASE_RPC = 'https://mainnet.base.org';
const KILT_TOKEN = '0x5D0DD05bB095fdD6Af4865A1AdF97c39C85ad2d8';

// Example wallet to test (Uniswap deployer)
const testWallet = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';

async function checkBalance() {
  try {
    // ETH balance
    const ethResponse = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [testWallet, 'latest'],
        id: 1
      })
    });
    
    const ethResult = await ethResponse.json();
    const ethBalance = parseInt(ethResult.result, 16) / 1e18;
    
    console.log(`Wallet: ${testWallet}`);
    console.log(`ETH Balance: ${ethBalance.toFixed(4)} ETH`);
    console.log('WalletConnect should work for any wallet on Base network');
    
  } catch (error) {
    console.error('Error checking balance:', error);
  }
}

checkBalance();