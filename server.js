import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

/* ========================= */
/* 🧠 DATABASE */
/* ========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ========================= */
/* 🧪 ROOT */
/* ========================= */
app.get("/", (req, res) => {
  res.send("SXP Bridge API LIVE");
});

/* ========================= */
/* ❤️ HEALTH */
/* ========================= */
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "ok", db: "connected", time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================= */
/* 🔐 AUTH */
/* ========================= */
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const ethWallet = ethers.Wallet.createRandom();
  const bnbWallet = ethers.Wallet.createRandom();

  const result = await pool.query(
    `INSERT INTO users 
    (email, password, eth_address, bnb_address, eth_private_key, bnb_private_key)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, email, eth_address, bnb_address`,
    [
      email,
      hashed,
      ethWallet.address,
      bnbWallet.address,
      ethWallet.privateKey,
      bnbWallet.privateKey
    ]
  );

  res.json(result.rows[0]);
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  const user = result.rows[0];

  if (!user) return res.status(401).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "2h" });

  res.json({ success: true, token });
});

/* ========================= */
/* 🔑 AUTH */
/* ========================= */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* ========================= */
/* 👤 USER */
/* ========================= */
app.get("/api/user/wallets", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT eth_address, bnb_address FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

app.get("/api/user/balance", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT balance FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

/* ========================= */
/* 💰 REAL SXP DEPOSIT ENGINE */
/* ========================= */

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

const SXP_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const sxpContract = new ethers.Contract(
  process.env.SXP_ETH_CONTRACT,
  SXP_ABI,
  provider
);

let lastCheckedBlock = null;

async function processTransfer(to, amount, txHash) {
  const user = await pool.query(
    `SELECT id FROM users WHERE LOWER(eth_address)=LOWER($1)`,
    [to]
  );

  if (!user.rows.length) return;

  const exists = await pool.query(
    "SELECT id FROM transactions WHERE tx_hash=$1",
    [txHash]
  );

  if (exists.rows.length) return;

  const value = Number(ethers.formatUnits(amount, 18));

  await pool.query(
    "UPDATE users SET balance = balance + $1 WHERE id=$2",
    [value, user.rows[0].id]
  );

  await pool.query(
    "INSERT INTO transactions (user_id, tx_hash, amount, network, type, status) VALUES ($1,$2,$3,'ETH','deposit','completed')",
    [user.rows[0].id, txHash, value]
  );

  console.log(`💰 Deposit: ${value} SXP`);
}

async function pollDeposits() {
  try {
    console.log("🔄 Checking SXP deposits...");

    const latest = await provider.getBlockNumber();

    if (!lastCheckedBlock) {
      lastCheckedBlock = latest - 20;
    }

    const logs = await provider.getLogs({
      address: process.env.SXP_ETH_CONTRACT,
      fromBlock: lastCheckedBlock,
      toBlock: latest
    });

    for (const log of logs) {
      try {
        const parsed = sxpContract.interface.parseLog(log);

        await processTransfer(
          parsed.args.to,
          parsed.args.value,
          log.transactionHash
        );
      } catch {}
    }

    lastCheckedBlock = latest;

  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

setInterval(pollDeposits, 120000);

/* ========================= */
/* 🚀 START */
/* ========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
