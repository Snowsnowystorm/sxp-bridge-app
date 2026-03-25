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

console.log("🚀 Booting SXP Bridge Backend...");

/* =========================
   DATABASE
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("✅ DB connected"))
  .catch(err => console.error("❌ DB error:", err));

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
   AUTH MIDDLEWARE
========================= */
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* =========================
   HEALTH CHECK
========================= */
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: "connected",
      time: new Date()
    });
  } catch {
    res.status(500).json({ status: "error", db: "down" });
  }
});

/* =========================
   REGISTER
========================= */
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const wallet = ethers.Wallet.createRandom();

  try {
    const result = await pool.query(
      `INSERT INTO users (email, password, eth_address, private_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, eth_address`,
      [email, hashed, wallet.address, wallet.privateKey]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Register failed" });
  }
});

/* =========================
   LOGIN
========================= */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) return res.status(401).json({ error: "Invalid" });

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) return res.status(401).json({ error: "Invalid" });

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* =========================
   GET WALLET
========================= */
app.get("/api/user/wallets", auth, async (req, res) => {
  const user = await pool.query(
    "SELECT eth_address FROM users WHERE id=$1",
    [req.user.id]
  );

  res.json(user.rows[0]);
});

/* =========================
   GET BALANCE
========================= */
app.get("/api/user/balance", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT COALESCE(SUM(amount),0) as balance FROM transactions WHERE user_id=$1",
    [req.user.id]
  );

  res.json({ balance: result.rows[0].balance });
});

/* =========================
   PROCESS TRANSFER
========================= */
async function processTransfer(to, value, txHash) {
  try {
    const user = await pool.query(
      "SELECT * FROM users WHERE eth_address=$1",
      [to.toLowerCase()]
    );

    if (!user.rows.length) return;

    const amount = Number(ethers.formatUnits(value, 18));

    const exists = await pool.query(
      "SELECT * FROM transactions WHERE tx_hash=$1",
      [txHash]
    );

    if (exists.rows.length) return;

    await pool.query(
      `INSERT INTO transactions (user_id, amount, tx_hash)
       VALUES ($1, $2, $3)`,
      [user.rows[0].id, amount, txHash]
    );

    console.log(`💰 Deposit: ${amount} SXP → User ${user.rows[0].id}`);

  } catch (err) {
    console.error("Transfer error:", err.message);
  }
}

/* =========================
   SAFE POLLING ENGINE (FIXED)
========================= */
async function pollDeposits() {
  try {
    console.log("🔄 Checking SXP deposits...");

    const latest = await provider.getBlockNumber();

    if (!lastCheckedBlock) {
      lastCheckedBlock = latest - 10;
    }

    const fromBlock = Math.max(lastCheckedBlock, latest - 10);

    const logs = await Promise.race([
      provider.getLogs({
        address: process.env.SXP_ETH_CONTRACT,
        fromBlock,
        toBlock: latest
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout")), 5000)
      )
    ]);

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

/* =========================
   START POLLING
========================= */
setInterval(pollDeposits, 180000);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
