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

/* ========================= */
/* 🔐 ENV */
/* ========================= */
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
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
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

  const token = jwt.sign(
    { id: user.id },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({ success: true, token });
});

/* ========================= */
/* 🔑 AUTH MIDDLEWARE */
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
/* 💰 DEPOSIT POLLING (SAFE) */
/* ========================= */
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

async function pollDeposits() {
  try {
    console.log("🔄 Checking deposits...");
    const latest = await provider.getBlockNumber();
    console.log("Latest block:", latest);
  } catch (err) {
    console.error("Polling error:", err.message);
  }
}

setInterval(pollDeposits, 180000);

/* ========================= */
/* 💸 WITHDRAW (BASIC) */
/* ========================= */
app.post("/api/user/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;

    const userRes = await pool.query(
      "SELECT balance FROM users WHERE id=$1",
      [req.user.id]
    );

    const user = userRes.rows[0];

    if (Number(user.balance) < Number(amount)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await pool.query(
      "UPDATE users SET balance = balance - $1 WHERE id=$2",
      [amount, req.user.id]
    );

    res.json({ success: true, message: "Withdrawal simulated" });

  } catch (err) {
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

/* ========================= */
/* 🚀 START */
/* ========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
