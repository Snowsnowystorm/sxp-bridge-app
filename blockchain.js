import { ethers } from "ethers";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   HANDLE DEPOSIT (NO INSTANT CREDIT)
=============================== */

async function handleDeposit(tx, chainName) {
  try {
    if (!tx.to || tx.value === 0n) return;

    const address = tx.to.toLowerCase();

    const wallet = await pool.query(
      "SELECT * FROM wallets WHERE address=$1",
      [address]
    );

    if (!wallet.rows.length) return;

    const userId = wallet.rows[0].user_id;
    const amount = Number(ethers.formatEther(tx.value));

    console.log(`💰 ${chainName} deposit detected:`, amount);

    /* SAVE AS PENDING */
    await pool.query(
      `
      INSERT INTO transactions (user_id,type,amount,chain,tx_hash,status)
      VALUES ($1,$2,$3,$4,$5,'pending')
      `,
      [userId, "deposit", amount, chainName, tx.hash]
    );

  } catch (err) {
    console.error("Deposit error:", err);
  }
}

/* ===============================
   LISTENER
=============================== */

async function startEvmListener(rpcUrl, chainName) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log(`🔗 Listening on ${chainName}`);

  provider.on("block", async (blockNumber) => {
    try {
      const block = await provider.getBlock(blockNumber, true);

      for (const tx of block.transactions) {
        await handleDeposit(tx, chainName);
      }

    } catch (err) {
      console.error(`${chainName} error:`, err);
    }
  });
}

/* ===============================
   START ALL CHAINS
=============================== */

export function startBlockchainListener() {
  startEvmListener(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    "SXP-ETH"
  );

  startEvmListener(
    "https://bsc-dataseed.binance.org/",
    "SXP-BNB"
  );

  console.log("🚀 Blockchain system running");
}
