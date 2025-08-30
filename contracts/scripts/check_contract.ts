import { ethers } from 'hardhat';

async function main() {
  const houseAddress = process.env.HOUSE_ADDRESS || '0x6e70048899eb52F1BD255bAC4b3Ec0A279f869aF';
  
  const provider = new ethers.JsonRpcProvider('https://saigon-testnet.roninchain.com/rpc');
  
  console.log('Checking contract at:', houseAddress);
  
  // Check if there's code at the address
  const code = await provider.getCode(houseAddress);
  console.log('Contract code length:', code.length);
  console.log('Has contract code:', code !== '0x');
  
  // Check balance
  const balance = await provider.getBalance(houseAddress);
  console.log('Contract balance:', ethers.formatEther(balance), 'RON');
  
  if (code === '0x') {
    console.log('\n❌ No contract found at this address!');
    console.log('The contract needs to be redeployed.');
  } else {
    console.log('\n✅ Contract exists at this address');
    console.log('Code preview:', code.slice(0, 100) + '...');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });