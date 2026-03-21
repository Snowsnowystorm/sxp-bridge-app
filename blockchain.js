import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export function startBlockchainListener() {
  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );

  console.log("🔗 Listening for deposits...");

  provider.on("block", async (blockNumber) => {
    const block = await provider.getBlockWithTransactions(blockNumber);

    for (const tx of block.transactions) {
      if (tx.to) {
        const wallet = await pool.query(
          "SELECT * FROM wallets WHERE address = $1",
          [tx.to.toLowerCase()]
        );

        if (wallet.rows.length > 0) {
          const userId = wallet.rows[0].user_id;
          const amount = Number(ethers.formatEther(tx.value));

          console.log("💰 Deposit detected:", amount);

          await pool.query(
            `
            INSERT INTO balances (user_id, token, amount)
            VALUES ($1, 'SXP-ETH', $2)
            ON CONFLICT (user_id, token)
            DO UPDATE SET amount = balances.amount + $2
            `,
            [userId, amount]
          );
        }
      }
    }
  });
}
