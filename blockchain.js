import { ethers } from "ethers";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

/* ===============================
   DATABASE
=============================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   HANDLE DEPOSIT
=============================== */

async function handleDeposit(tx, chainName) {
  try {
    if (!tx.to || tx.value === 0n) return;

    const toAddress = tx.to.toLowerCase();

    const wallet = await pool.query(
      "SELECT * FROM wallets WHERE address = $1",
      [toAddress]
    );

    if (!wallet.rows.length) return;

    const userId = wallet.rows[0].user_id;
    const amount = Number(ethers.formatEther(tx.value));

    console.log(`💰 ${chainName} deposit detected:`, amount);

    /* ✅ UPDATE BALANCE */
    await pool.query(
      `
      INSERT INTO balances (user_id, token, amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, token)
      DO UPDATE SET amount = balances.amount + $3
      `,
      [userId, chainName, amount]
    );

    /* ✅ SAVE TRANSACTION */
    await pool.query(
      `
      INSERT INTO transactions (user_id, type, amount, chain, tx_hash)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, "deposit", amount, chainName, tx.hash]
    );

  } catch (err) {
    console.error("Deposit error:", err);
  }
}

/* ===============================
   EVM LISTENER (ETH + BNB)
=============================== */

async function startEvmListener(rpcUrl, chainName) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log(`🔗 Listening for ${chainName}...`);

  provider.on("block", async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);

      for (const tx of block.transactions) {
        await handleDeposit(tx, chainName);
      }

    } catch (err) {
      console.error(`${chainName} block error:`, err);
    }
  });
}

/* ===============================
   START ALL LISTENERS
=============================== */

export function startBlockchainListener() {

  /* 🔷 ETH MAINNET */
  startEvmListener(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    "SXP-ETH"
  );

  /* 🟡 BNB CHAIN */
  startEvmListener(
    "https://bsc-dataseed.binance.org/",
    "SXP-BNB"
  );

  /* ☀️ SOL PLACEHOLDER */
  console.log("☀️ SOL listener not yet active (next upgrade)");

  console.log("🚀 Blockchain listeners started");
}
