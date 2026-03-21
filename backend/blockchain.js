import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// PROVIDER
// ==============================
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

// ==============================
// TOKEN CONFIG
// ==============================
const SXP_CONTRACT = process.env.SXP_CONTRACT;

const ABI = [
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

const contract = new ethers.Contract(SXP_CONTRACT, ABI, provider);

// ==============================
// TRACK PENDING TXs
// ==============================
let pendingDeposits = [];

// ==============================
// START LISTENER
// ==============================
export const startListener = (io) => {
  console.log("🔗 Listening for ERC20 deposits...");

  // ==========================
  // TRANSFER EVENT
  // ==========================
  contract.on("Transfer", async (from, to, amount, event) => {
    try {
      const wallets = await pool.query(
        "SELECT * FROM wallets WHERE LOWER(address) = $1",
        [to.toLowerCase()]
      );

      if (wallets.rows.length === 0) return;

      const user = wallets.rows[0];
      const value = ethers.formatUnits(amount, 18);

      console.log("💎 Deposit detected (pending):", value);

      // ==========================
      // SAVE AS PENDING
      // ==========================
      await pool.query(
        `INSERT INTO transactions (type, amount, status)
         VALUES ($1, $2, $3)`,
        ["deposit", value, "pending"]
      );

      // Track for confirmations
      pendingDeposits.push({
        txHash: event.log.transactionHash,
        user_id: user.user_id,
        amount: value,
        blockNumber: event.log.blockNumber,
      });

    } catch (err) {
      console.error("Listener error:", err);
    }
  });

  // ==========================
  // BLOCK LISTENER (CONFIRMATIONS)
  // ==========================
  provider.on("block", async (currentBlock) => {
    try {
      for (let i = 0; i < pendingDeposits.length; i++) {
        const tx = pendingDeposits[i];

        const confirmations = currentBlock - tx.blockNumber;

        if (confirmations >= 6) {
          console.log("✅ Deposit confirmed:", tx.amount);

          // ==========================
          // CREDIT BALANCE
          // ==========================
          await pool.query(
            `INSERT INTO balances (user_id, sxp)
             VALUES ($1, $2)
             ON CONFLICT (user_id)
             DO UPDATE SET sxp = balances.sxp + $2`,
            [tx.user_id, tx.amount]
          );

          // ==========================
          // UPDATE TX STATUS
          // ==========================
          await pool.query(
            `UPDATE transactions
             SET status = 'confirmed'
             WHERE type = 'deposit'
             AND amount = $1
             AND status = 'pending'`,
            [tx.amount]
          );

          // ==========================
          // EMIT REAL-TIME UPDATE
          // ==========================
          io.emit("tx_update", {
            type: "deposit",
            amount: tx.amount,
            status: "confirmed",
          });

          // Remove from pending
          pendingDeposits.splice(i, 1);
          i--;
        }
      }

    } catch (err) {
      console.error("Block listener error:", err);
    }
  });
};
