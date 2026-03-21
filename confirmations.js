import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function startConfirmationWorker() {
  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );

  setInterval(async () => {
    const pending = await pool.query(
      "SELECT * FROM transactions WHERE status='pending'"
    );

    for (const tx of pending.rows) {
      const receipt = await provider.getTransactionReceipt(tx.tx_hash);

      if (!receipt) continue;

      const confirmations = receipt.confirmations;

      if (confirmations >= 6) {
        await pool.query(
          "UPDATE transactions SET status='confirmed' WHERE id=$1",
          [tx.id]
        );

        await pool.query(
          `
          INSERT INTO balances (user_id,token,amount)
          VALUES ($1,$2,$3)
          ON CONFLICT (user_id,token)
          DO UPDATE SET amount = balances.amount + $3
          `,
          [tx.user_id, tx.chain, tx.amount]
        );
      }
    }
  }, 10000);
}
