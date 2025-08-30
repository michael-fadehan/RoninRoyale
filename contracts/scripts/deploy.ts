import { ethers } from "hardhat";

async function main() {
  const Coinflip = await ethers.getContractFactory("CoinflipP2P");
  const coinflip = await Coinflip.deploy();
  await coinflip.waitForDeployment();
  // eslint-disable-next-line no-console
  console.log("CoinflipP2P deployed to:", await coinflip.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


