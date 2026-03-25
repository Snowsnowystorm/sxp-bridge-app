import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pkg from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

/* ENV */
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/* DB */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* BLOCKCHAIN PROVIDERS */
const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

/* ENCRYPTION */
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/* REGISTER */
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
      encrypt(ethWallet.privateKey),
      encrypt(bnbWallet.privateKey)
    ]
  );

  res.json(result.rows[0]);
});

/* LOGIN */
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
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({ success: true, token });
});

/* AUTH */
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

/* GET WALLETS */
app.get("/api/user/wallets", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT eth_address, bnb_address FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

/* GET BALANCE */
app.get("/api/user/balance", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT balance FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

/* ===== DEPOSIT SYSTEM (CORE) ===== */

async function checkDeposits() {
  try {
    const users = await pool.query("SELECT id, eth_address, bnb_address FROM users");

    for (const user of users.rows) {
      /* ETH BALANCE */
      const ethBalance = await ethProvider.getBalance(user.eth_address);

      /* BNB BALANCE */
      const bnbBalance = await bscProvider.getBalance(user.bnb_address);

      const total = Number(ethers.formatEther(ethBalance)) +
                    Number(ethers.formatEther(bnbBalance));

      if (total > 0) {
        await pool.query(
          "UPDATE users SET balance = balance + $1 WHERE id=$2",
          [total, user.id]
        );
      }
    }
  } catch (err) {
    console.error("Deposit check error:", err);
  }
}

/* RUN EVERY 30 SECONDS */
setInterval(checkDeposits, 30000);

/* START */
app.listen(PORT, () => {
  console.log("Server running");
});
