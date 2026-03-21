import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   ETH RPC (YOU CAN UPGRADE TO ALCHEMY LATER)
=============================== */

const provider = new ethers.JsonRpcProvider(
  "https://eth.llamarpc.com"
);

/* ===============================
   START LISTENER
=============================== */

export const startBlockchainListener = () => {
  console.log("🔍 Blockchain listener started...");

  provider.on("block", async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);

      for (const tx of block.transactions) {
        if (!tx.to) continue;

        // 🔍 check if wallet exists in DB
        const result = await pool.query(
          "SELECT * FROM wallets WHERE LOWER(address) = LOWER($1)",
          [tx.to]
        );

        if (result.rows.length > 0) {
          const wallet = result.rows[0];

          console.log("💰 Deposit detected:", tx.hash);

          const amount = ethers.formatEther(tx.value);

          // ✅ CREDIT USER
          await pool.query(
            `
            INSERT INTO balances (user_id, token, amount)
            VALUES ($1, 'ETH', $2)
            ON CONFLICT (user_id, token)
            DO UPDATE SET amount = balances.amount + $2
            `,
            [wallet.user_id, amount]
          );
        }
      }
    } catch (err) {
      console.error("Listener error:", err.message);
    }
  });
};
