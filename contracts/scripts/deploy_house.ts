import { ethers } from "hardhat";

async function main() {
  const House = await ethers.getContractFactory("CoinflipHouse");

  // Saigon often requires a min priority fee; set a small but acceptable tip.
  const priority = ethers.parseUnits("20", "gwei"); // exact tip needed
  const maxFee   = ethers.parseUnits("40", "gwei"); // safe cap

  const house = await House.deploy({
    maxPriorityFeePerGas: priority,
    maxFeePerGas: maxFee,
  });
  await house.waitForDeployment();
  
  const address = await house.getAddress();
  console.log("CoinflipHouse deployed:", address);
  
  // Fund the house with some initial balance for payouts
  const [deployer] = await ethers.getSigners();
  const fundAmount = ethers.parseEther("10"); // Fund with 10 RON
  
  console.log("Funding house with", ethers.formatEther(fundAmount), "RON...");
  const fundTx = await house.fund({ value: fundAmount });
  await fundTx.wait();
  console.log("House funded successfully");
  
  console.log("\nContract deployed and ready!");
  console.log("Address:", address);
  console.log("Initial balance:", ethers.formatEther(await ethers.provider.getBalance(address)), "RON");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });


