import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import auth from "./middleware/auth.js";
import { startBlockchainListener } from "./blockchain.js";
import { encrypt, decrypt } from "./utils/encryption.js";

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
   HEALTH
=============================== */

app.get("/", (req, res) => {
  res.send("🚀 SXP BACKEND LIVE");
});

/* ===============================
   AUTH
=============================== */

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const result = await pool.query(
    "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING id,email",
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
   WALLET
=============================== */

app.post("/create-wallet", auth, async (req, res) => {
  const { user_id, chain } = req.body;

  const wallet = ethers.Wallet.createRandom();

  const encryptedKey = encrypt(wallet.privateKey);

  const result = await pool.query(
    `INSERT INTO wallets (user_id,chain,address,private_key)
     VALUES ($1,$2,$3,$4)
     RETURNING id,user_id,chain,address`,
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
   BRIDGE
=============================== */

app.post("/bridge", auth, async (req, res) => {
  const { user_id, amount, from_chain, to_chain } = req.body;

  const balance = await pool.query(
    "SELECT amount FROM balances WHERE user_id=$1 AND token=$2",
    [user_id, from_chain]
  );

  if (!balance.rows.length || balance.rows[0].amount < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  await pool.query(
    "UPDATE balances SET amount=amount-$1 WHERE user_id=$2 AND token=$3",
    [amount, user_id, from_chain]
  );

  await pool.query(
    `
    INSERT INTO balances (user_id,token,amount)
    VALUES ($1,$2,$3)
    ON CONFLICT (user_id,token)
    DO UPDATE SET amount = balances.amount + $3
    `,
    [user_id, to_chain, amount]
  );

  res.json({ success: true });
});

/* ===============================
   WITHDRAW (REAL CRYPTO)
=============================== */

app.post("/withdraw", auth, async (req, res) => {
  const { user_id, amount, to, chain } = req.body;

  const walletRes = await pool.query(
    "SELECT * FROM wallets WHERE user_id=$1 AND chain=$2",
    [user_id, chain]
  );

  const privateKey = decrypt(walletRes.rows[0].private_key);

  const provider = new ethers.JsonRpcProvider(
    chain === "SXP-ETH"
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
      : "https://bsc-dataseed.binance.org/"
  );

  const wallet = new ethers.Wallet(privateKey, provider);

  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amount.toString())
  });

  /* ✅ SAVE TX HERE */
  await pool.query(
    `INSERT INTO transactions (user_id,type,amount,chain,tx_hash)
     VALUES ($1,$2,$3,$4,$5)`,
    [user_id, "withdraw", amount, chain, tx.hash]
  );

  res.json({ tx });
});

/* ===============================
   TRANSACTION HISTORY
=============================== */

app.get("/transactions/:userId", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
    [req.params.userId]
  );

  res.json({ transactions: result.rows });
});

/* ===============================
   START
=============================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🔥 Server running");
});

startBlockchainListener();
