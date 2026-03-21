import { ethers } from "ethers";
import pkg from "pg";
import { decrypt } from "./utils/encryption.js";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function startWithdrawWorker() {
  setInterval(async () => {
    const pending = await pool.query(
      "SELECT * FROM withdrawals WHERE status='pending'"
    );

    for (const w of pending.rows) {
      try {
        const walletRes = await pool.query(
          "SELECT * FROM wallets WHERE user_id=$1 AND chain=$2",
          [w.user_id, w.chain]
        );

        const privateKey = decrypt(walletRes.rows[0].private_key);

        const provider = new ethers.JsonRpcProvider(
          w.chain === "SXP-ETH"
            ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
            : "https://bsc-dataseed.binance.org/"
        );

        const wallet = new ethers.Wallet(privateKey, provider);

        const tx = await wallet.sendTransaction({
          to: w.to_address,
          value: ethers.parseEther(w.amount.toString())
        });

        await pool.query(
          "UPDATE withdrawals SET status='completed' WHERE id=$1",
          [w.id]
        );

        await pool.query(
          `INSERT INTO transactions (user_id,type,amount,chain,tx_hash)
           VALUES ($1,$2,$3,$4,$5)`,
          [w.user_id, "withdraw", w.amount, w.chain, tx.hash]
        );

      } catch (err) {
        console.error("Withdraw error:", err);
      }
    }
  }, 15000);
}
