console.log("🔥 DATABASE_URL VALUE:", process.env.DATABASE_URL);
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

console.log("🚀 Booting SXP Bridge Backend...");

/* =========================
   DATABASE
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log("✅ DB pool ready");

/* =========================
   BLOCKCHAIN
========================= */
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

const sxpContract = new ethers.Contract(
  process.env.SXP_ETH_CONTRACT,
  [
    "event Transfer(address indexed from, address indexed to, uint value)"
  ],
  provider
);

let lastCheckedBlock = null;

/* =========================
   HEALTH
========================= */
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(500).json({ status: "error" });
  }
});

/* =========================
   SAFE POLLING
========================= */
async function pollDeposits() {
  try {
    console.log("🔄 Checking SXP deposits...");

    const latest = await provider.getBlockNumber();

    if (!lastCheckedBlock) lastCheckedBlock = latest - 5;
    if (lastCheckedBlock > latest) lastCheckedBlock = latest - 5;

    const logs = await provider.getLogs({
      address: process.env.SXP_ETH_CONTRACT,
      fromBlock: lastCheckedBlock,
      toBlock: latest
    });

    lastCheckedBlock = latest;

  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

setInterval(pollDeposits, 180000);

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
