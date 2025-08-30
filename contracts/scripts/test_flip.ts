import { ethers } from 'hardhat';

async function main() {
  const houseAddress = process.env.HOUSE_ADDRESS || '0x6e70048899eb52F1BD255bAC4b3Ec0A279f869aF';
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('Please set PRIVATE_KEY in env');

  const provider = new ethers.JsonRpcProvider('https://saigon-testnet.roninchain.com/rpc');
  const wallet = new ethers.Wallet(pk, provider as any);
  
  const houseAbi = [
    { "inputs": [ { "internalType": "bool", "name": "choice", "type": "bool" } ], "name": "flip", "outputs": [ { "internalType": "bool", "name": "won", "type": "bool" }, { "internalType": "uint256", "name": "payout", "type": "uint256" } ], "stateMutability": "payable", "type": "function" },
    { "inputs": [], "name": "getHouseStats", "outputs": [ { "internalType": "uint256", "name": "balance", "type": "uint256" }, { "internalType": "uint256", "name": "games", "type": "uint256" }, { "internalType": "uint256", "name": "wagered", "type": "uint256" }, { "internalType": "uint256", "name": "paidOut", "type": "uint256" }, { "internalType": "uint256", "name": "houseProfit", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "minWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "maxWager", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }
  ];

  const house = new ethers.Contract(houseAddress, houseAbi, wallet);

  console.log('Testing house contract at:', houseAddress);
  console.log('Wallet address:', wallet.address);
  console.log('Wallet balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'RON');

  // Get house stats
  try {
    const stats = await house.getHouseStats();
    console.log('House balance:', ethers.formatEther(stats[0]), 'RON');
    console.log('Total games:', stats[1].toString());
    console.log('Min wager:', ethers.formatEther(await house.minWager()), 'RON');
    console.log('Max wager:', ethers.formatEther(await house.maxWager()), 'RON');
  } catch (e) {
    console.error('Failed to get house stats:', e);
    return;
  }

  // Try a small flip
  const wager = ethers.parseEther('0.01'); // 0.01 RON
  console.log('\nTesting flip with', ethers.formatEther(wager), 'RON...');
  
  try {
    // First try to estimate gas
    const gasEstimate = await house.flip.estimateGas(true, { value: wager });
    console.log('Gas estimate:', gasEstimate.toString());
    
    // Now try the actual transaction
    const tx = await house.flip(true, { value: wager, gasLimit: gasEstimate * 2n });
    console.log('Flip tx submitted:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('Flip tx confirmed, status:', receipt?.status);
    
    if (receipt?.logs) {
      console.log('Transaction logs:', receipt.logs.length);
    }
  } catch (e: any) {
    console.error('Flip failed:', e.message);
    if (e.data) {
      console.error('Error data:', e.data);
    }
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });