import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import auth from "./middleware/auth.js";
import { startBlockchainListener } from "./blockchain.js";
import { encrypt } from "./utils/encryption.js";

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
  res.send("🚀 SXP BACKEND + DB RUNNING");
});

/* ===============================
   AUTH SYSTEM
=============================== */

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashed]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Register failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email = $1",
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

    res.json({
      success: true,
      token,
      user: { id: user.rows[0].id, email: user.rows[0].email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ===============================
   ADMIN SYSTEM
=============================== */

const isAdmin = (req, res, next) => {
  if (req.user.id !== process.env.ADMIN_ID) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

app.get("/admin/users", auth, isAdmin, async (req, res) => {
  const result = await pool.query("SELECT id, email FROM users");
  res.json({ users: result.rows });
});

app.get("/admin/balances", auth, isAdmin, async (req, res) => {
  const result = await pool.query("SELECT * FROM balances");
  res.json({ balances: result.rows });
});

/* ===============================
   WALLET SYSTEM (SECURE)
=============================== */

app.post("/create-wallet", auth, async (req, res) => {
  try {
    const { user_id, chain } = req.body;

    const wallet = ethers.Wallet.createRandom();

    const encryptedKey = encrypt(wallet.privateKey);

    const result = await pool.query(
      `INSERT INTO wallets (user_id, chain, address, private_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, chain, address`,
      [user_id, chain, wallet.address.toLowerCase(), encryptedKey]
    );

    res.json({
      success: true,
      wallet: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wallet failed" });
  }
});

/* ===============================
   BALANCE
=============================== */

app.get("/balance/:userId", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT token, amount FROM balances WHERE user_id = $1",
    [req.params.userId]
  );

  res.json({ balances: result.rows });
});

/* ===============================
   BRIDGE SYSTEM
=============================== */

app.post("/bridge", auth, async (req, res) => {
  const { user_id, amount, from_chain, to_chain } = req.body;

  const balance = await pool.query(
    "SELECT amount FROM balances WHERE user_id = $1 AND token = $2",
    [user_id, from_chain]
  );

  if (!balance.rows.length || balance.rows[0].amount < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  await pool.query(
    "UPDATE balances SET amount = amount - $1 WHERE user_id = $2 AND token = $3",
    [amount, user_id, from_chain]
  );

  await pool.query(
    `
    INSERT INTO balances (user_id, token, amount)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, token)
    DO UPDATE SET amount = balances.amount + $3
    `,
    [user_id, to_chain, amount]
  );

  res.json({ success: true });
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🔥 Server running on ${PORT}`);
});

/* ===============================
   START BLOCKCHAIN LISTENER
=============================== */

startBlockchainListener();
