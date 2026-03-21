import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 🔗 PROVIDER (Alchemy / Infura / Public RPC)
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

// 💎 YOUR TOKEN CONTRACT (PUT REAL SXP TOKEN ADDRESS)
const SXP_CONTRACT = process.env.SXP_CONTRACT;

// ERC20 ABI (TRANSFER ONLY)
const ABI = [
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

const contract = new ethers.Contract(SXP_CONTRACT, ABI, provider);

// ==============================
// LISTENER
// ==============================
export const startListener = (io) => {
  console.log("🔗 Listening for ERC20 deposits...");

  contract.on("Transfer", async (from, to, amount) => {
    try {
      const wallets = await pool.query(
        "SELECT * FROM wallets WHERE address = $1",
        [to.toLowerCase()]
      );

      if (wallets.rows.length === 0) return;

      const value = ethers.formatUnits(amount, 18);

      const tx = {
        type: "deposit",
        amount: value,
        status: "confirmed",
      };

      await pool.query(
        `INSERT INTO transactions (type, amount, status)
         VALUES ($1, $2, $3)`,
        [tx.type, tx.amount, tx.status]
      );

      io.emit("tx_update", tx);

      console.log("💎 Deposit detected:", value);

    } catch (err) {
      console.error("Listener error:", err);
    }
  });
};
