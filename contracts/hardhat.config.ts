import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.23",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    "ronin-testnet": {
      url: "https://saigon-testnet.roninchain.com/rpc",
      chainId: 2021,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      // increase request timeout to avoid SSL / RPC timeouts on slow networks
      timeout: 120000, // 120 seconds
      httpHeaders: {
        // optional: keep-alive can help some providers
        Connection: "keep-alive",
      },
      // providerOptions removed to satisfy Hardhat types
    },
    "ronin-mainnet": {
      url: "https://api.roninchain.com/rpc",
      chainId: 2020,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};
export default config;


