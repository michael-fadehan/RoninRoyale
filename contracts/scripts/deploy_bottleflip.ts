import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  const Bottle = await ethers.getContractFactory('Bottleflip');

  // Optionally set gas fees for Ronin Saigon if needed (uncomment and adjust):
  // const priority = ethers.parseUnits('20', 'gwei');
  // const maxFee = ethers.parseUnits('40', 'gwei');
  // const bottle = await Bottle.deploy({ maxPriorityFeePerGas: priority, maxFeePerGas: maxFee });

  const bottle = await Bottle.deploy();
  await bottle.waitForDeployment();
  const address = await bottle.getAddress();
  console.log('Bottleflip deployed to:', address);

  // Optional: fund the contract so it can pay out
  const fundAmount = ethers.parseEther('5');
  console.log('Funding bottle with', ethers.formatEther(fundAmount), 'RON...');
  const fundTx = await bottle.fund({ value: fundAmount });
  await fundTx.wait();
  console.log('Bottle funded successfully');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


