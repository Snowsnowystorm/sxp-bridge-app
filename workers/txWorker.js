import { Worker } from "bullmq";
import { redis } from "../utils/redis.js";
import { ethers } from "ethers";
import { getHotWallet } from "../utils/hotWallet.js";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export function startWorker() {
  console.log("⚡ Worker started");

  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );

  new Worker(
    "transactions",
    async job => {
      const { type, to, amount, txId } = job.data;

      try {
        if (type === "withdraw") {
          const hotWallet = getHotWallet(provider);

          const tx = await hotWallet.sendTransaction({
            to,
            value: ethers.parseEther(amount.toString())
          });

          console.log("✅ TX SENT:", tx.hash);

          /* ===============================
             UPDATE SUCCESS
          =============================== */
          await pool.query(
            `UPDATE transactions
             SET status='completed', tx_hash=$1
             WHERE id=$2`,
            [tx.hash, txId]
          );

          return { txHash: tx.hash };
        }
      } catch (err) {
        console.error("❌ TX FAILED:", err);

        /* ===============================
           UPDATE FAILED
        =============================== */
        await pool.query(
          `UPDATE transactions
           SET status='failed'
           WHERE id=$1`,
          [txId]
        );
      }
    },
    { connection: redis }
  );
}
