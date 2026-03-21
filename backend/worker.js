import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);

const wallet = new ethers.Wallet(
  process.env.HOT_WALLET_PRIVATE_KEY,
  provider
);

// ==============================
// PROCESS QUEUE
// ==============================
export const startWorker = () => {
  console.log("⚡ Withdraw worker started");

  setInterval(async () => {
    try {
      if (!global.queue || global.queue.length === 0) return;

      const job = global.queue.shift();

      if (job.type === "withdraw") {
        console.log("💸 Sending real transaction...");

        const tx = await wallet.sendTransaction({
          to: job.address,
          value: ethers.parseEther(job.amount.toString()),
        });

        await tx.wait();

        console.log("✅ SENT:", tx.hash);
      }

    } catch (err) {
      console.error("Worker error:", err);
    }
  }, 3000);
};
