import { ethers } from 'hardhat';

async function main() {
  const houseAddress = process.env.HOUSE_ADDRESS || '0x6e70048899eb52F1BD255bAC4b3Ec0A279f869aF';
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('Please set PRIVATE_KEY in env to the funder account');

  const provider = new ethers.JsonRpcProvider('https://saigon-testnet.roninchain.com/rpc');
  const wallet = new ethers.Wallet(pk, provider as any);
  const amount = process.env.FUND_AMOUNT || '1'; // RON
  const value = ethers.parseUnits(amount, 18);

  console.log(`Funding ${houseAddress} with ${amount} RON from ${wallet.address}`);
  const tx = await wallet.sendTransaction({ to: houseAddress, value });
  console.log('tx submitted:', tx.hash);
  await tx.wait();
  console.log('tx confirmed');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });


