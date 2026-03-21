import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// PROVIDER
// ==============================
const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
);

// ==============================
// HOT WALLET
// ==============================
const wallet = new ethers.Wallet(
  process.env.HOT_WALLET_PRIVATE_KEY,
  provider
);

// ==============================
// QUEUE (SIMPLE)
// ==============================
global.queue = global.queue || [];

// ==============================
// START WORKER
// ==============================
export const startWorker = () => {
  console.log("⚡ Withdraw worker started");

  setInterval(async () => {
    try {
      if (!global.queue.length) return;

      const job = global.queue.shift();

      if (job.type === "withdraw") {
        console.log("💸 Sending real blockchain transaction...");

        const tx = await wallet.sendTransaction({
          to: job.address,
          value: ethers.parseEther(job.amount.toString()),
        });

        await tx.wait();

        // Update DB
        await pool.query(
          "UPDATE withdrawals SET status='sent', tx_hash=$1 WHERE id=$2",
          [tx.hash, job.withdrawal_id]
        );

        // Log transaction
        await pool.query(
          `INSERT INTO transactions (type, amount, status)
           VALUES ('withdraw', $1, 'completed')`,
          [job.amount]
        );

        console.log("✅ SENT:", tx.hash);
      }

    } catch (err) {
      console.error("Worker error:", err);
    }
  }, 3000);
};
