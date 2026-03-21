import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import auth from "./middleware/auth.js";
import { encrypt, decrypt } from "./utils/encryption.js";
import { deriveWallet } from "./wallet.js";

import { startBlockchainListener } from "./blockchain.js";
import { startWithdrawWorker } from "./withdrawWorker.js";
import { startConfirmationWorker } from "./confirmations.js";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(express.json());

/* ===============================
   DATABASE
=============================== */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   HEALTH CHECK
=============================== */

app.get("/", (req, res) => {
  res.send("🚀 SXP PRODUCTION BACKEND LIVE");
});

/* ===============================
   AUTH
=============================== */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const result = await pool.query(
    "INSERT INTO users (email,password) VALUES ($1,$2) RETURNING id,email",
    [email, hashed]
  );

  res.json({ user: result.rows[0] });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) {
    return res.status(400).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: user.rows[0] });
});

/* ===============================
   ADMIN
=============================== */

const isAdmin = (req, res, next) => {
  if (req.user.id !== process.env.ADMIN_ID) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

app.get("/admin/users", auth, isAdmin, async (req, res) => {
  const result = await pool.query("SELECT id,email FROM users");
  res.json({ users: result.rows });
});

app.get("/admin/balances", auth, isAdmin, async (req, res) => {
  const result = await pool.query("SELECT * FROM balances");
  res.json({ balances: result.rows });
});

/* ===============================
   CREATE WALLET (HD)
=============================== */

app.post("/create-wallet", auth, async (req, res) => {
  const { user_id, chain } = req.body;

  const user = await pool.query(
    "SELECT wallet_index FROM users WHERE id=$1",
    [user_id]
  );

  const index = user.rows[0].wallet_index || 0;

  const wallet = deriveWallet(index);

  await pool.query(
    "UPDATE users SET wallet_index = wallet_index + 1 WHERE id=$1",
    [user_id]
  );

  const encryptedKey = encrypt(wallet.privateKey);

  const result = await pool.query(
    `INSERT INTO wallets (user_id,chain,address,private_key)
     VALUES ($1,$2,$3,$4)
     RETURNING id,address`,
    [user_id, chain, wallet.address.toLowerCase(), encryptedKey]
  );

  res.json({ wallet: result.rows[0] });
});

/* ===============================
   BALANCE
=============================== */

app.get("/balance/:userId", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT token,amount FROM balances WHERE user_id=$1",
    [req.params.userId]
  );

  res.json({ balances: result.rows });
});

/* ===============================
   WITHDRAW (QUEUE)
=============================== */

app.post("/withdraw", auth, async (req, res) => {
  const { user_id, amount, to, chain } = req.body;

  await pool.query(
    `INSERT INTO withdrawals (user_id,amount,chain,to_address)
     VALUES ($1,$2,$3,$4)`,
    [user_id, amount, chain, to]
  );

  res.json({ success: true, message: "Withdrawal queued" });
});

/* ===============================
   TRANSACTIONS
=============================== */

app.get("/transactions/:userId", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
    [req.params.userId]
  );

  res.json({ transactions: result.rows });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});

/* ===============================
   START WORKERS
=============================== */

startBlockchainListener();
startWithdrawWorker();
startConfirmationWorker();
