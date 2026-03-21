import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

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
// START LISTENER
// ==============================
export const startListener = (io) => {
  console.log("🔗 Blockchain listener started...");

  provider.on("block", async (blockNumber) => {
    try {
      console.log("⛓️ New block:", blockNumber);

      const block = await provider.getBlock(blockNumber, true);

      for (const tx of block.transactions) {
        if (!tx.to) continue;

        // ==========================
        // CHECK IF MATCHES USER WALLET
        // ==========================
        const wallet = await pool.query(
          "SELECT * FROM wallets WHERE address = $1",
          [tx.to.toLowerCase()]
        );

        if (!wallet.rows.length) continue;

        const userWallet = wallet.rows[0];

        // ==========================
        // WAIT CONFIRMATIONS
        // ==========================
        const currentBlock = await provider.getBlockNumber();

        if (currentBlock - blockNumber < process.env.CONFIRMATIONS_REQUIRED) {
          continue;
        }

        const amount = parseFloat(
          ethers.formatEther(tx.value)
        );

        console.log("💰 DEPOSIT:", amount);

        // ==========================
        // CREDIT USER
        // ==========================
        await pool.query(
          `UPDATE balances 
           SET sxp = sxp + $1 
           WHERE user_id = $2`,
          [amount, userWallet.user_id]
        );

        // ==========================
        // SAVE TX
        // ==========================
        await pool.query(
          `INSERT INTO transactions (type, amount, status)
           VALUES ('deposit', $1, 'completed')`,
          [amount]
        );

        io.emit("tx_update", {
          type: "deposit",
          amount,
          status: "completed",
        });
      }

    } catch (err) {
      console.error("Listener error:", err);
    }
  });
};
