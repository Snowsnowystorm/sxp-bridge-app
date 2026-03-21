import { Worker } from "bullmq";
import { redis } from "../utils/redis.js";
import { ethers } from "ethers";
import { getHotWallet } from "../utils/hotWallet.js";

const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
);

new Worker(
  "transactions",
  async job => {
    const { type, to, amount } = job.data;

    if (type === "withdraw") {
      const hotWallet = getHotWallet(provider);

      const tx = await hotWallet.sendTransaction({
        to,
        value: ethers.parseEther(amount.toString())
      });

      console.log("✅ Withdrawal TX:", tx.hash);

      return { txHash: tx.hash };
    }
  },
  { connection: redis }
);
