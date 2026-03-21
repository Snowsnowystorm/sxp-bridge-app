import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   ETH + BNB LISTENER (EVM)
=============================== */

async function startEvmListener(rpc, chainName) {
  const provider = new ethers.JsonRpcProvider(rpc);

  console.log(`🔗 Listening on ${chainName}...`);

  provider.on("block", async (blockNumber) => {
    const block = await provider.getBlockWithTransactions(blockNumber);

    for (const tx of block.transactions) {
      if (!tx.to) continue;

      const wallet = await pool.query(
        "SELECT * FROM wallets WHERE address = $1",
        [tx.to.toLowerCase()]
      );

      if (wallet.rows.length > 0) {
        const userId = wallet.rows[0].user_id;
        const amount = Number(ethers.formatEther(tx.value));

        console.log(`💰 ${chainName} deposit:`, amount);

        await pool.query(
          `
          INSERT INTO balances (user_id, token, amount)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, token)
          DO UPDATE SET amount = balances.amount + $3
          `,
          [userId, chainName, amount]
        );
      }
    }
  });
}

/* ===============================
   START ALL LISTENERS
=============================== */

export function startBlockchainListener() {
  // ETH
  startEvmListener(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
    "SXP-ETH"
  );

  // BNB
  startEvmListener(
    "https://bsc-dataseed.binance.org/",
    "SXP-BNB"
  );

  // SOL (placeholder - RPC polling)
  console.log("☀️ SOL listener (add later with web3.js)");
}
