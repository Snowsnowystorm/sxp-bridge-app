import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import { ethers } from "ethers";
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
  res.send("🚀 SXP BACKEND RUNNING");
});

/* ===============================
   DB TEST
=============================== */

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ connected: true, time: result.rows[0] });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

/* ===============================
   REGISTER
=============================== */

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
      [email, password]
    );

    res.json({ success: true, user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Register failed" });
  }
});

/* ===============================
   CREATE WALLET (SECURED)
=============================== */

app.post("/create-wallet", async (req, res) => {
  try {
    const { user_id, chain } = req.body;

    const wallet = ethers.Wallet.createRandom();

    const encryptedKey = encrypt(wallet.privateKey);

    const result = await pool.query(
      `INSERT INTO wallets (user_id, chain, address, private_key)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, chain, address, created_at`,
      [user_id, chain, wallet.address, encryptedKey]
    );

    res.json({
      success: true,
      wallet: result.rows[0]
      // ❌ no private key returned
      // ❌ no mnemonic returned
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wallet creation failed" });
  }
});

/* ===============================
   GET BALANCE
=============================== */

app.get("/balance/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      "SELECT token, amount FROM balances WHERE user_id = $1",
      [userId]
    );

    res.json({ success: true, balances: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

/* ===============================
   BRIDGE SYSTEM
=============================== */

app.post("/bridge", async (req, res) => {
  try {
    const { user_id, amount, from_chain, to_chain } = req.body;

    // CHECK BALANCE
    const balance = await pool.query(
      "SELECT amount FROM balances WHERE user_id = $1 AND token = $2",
      [user_id, from_chain]
    );

    if (!balance.rows.length || balance.rows[0].amount < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // DEDUCT
    await pool.query(
      "UPDATE balances SET amount = amount - $1 WHERE user_id = $2 AND token = $3",
      [amount, user_id, from_chain]
    );

    // CREDIT
    await pool.query(
      `
      INSERT INTO balances (user_id, token, amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, token)
      DO UPDATE SET amount = balances.amount + $3
      `,
      [user_id, to_chain, amount]
    );

    res.json({
      success: true,
      message: "Bridge completed",
      from_chain,
      to_chain,
      amount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bridge failed" });
  }
});

/* ===============================
   ADMIN PANEL (BACKEND)
=============================== */

// USERS
app.get("/admin/users", async (req, res) => {
  const users = await pool.query("SELECT * FROM users");
  res.json(users.rows);
});

// WALLETS
app.get("/admin/wallets", async (req, res) => {
  const wallets = await pool.query("SELECT id, user_id, chain, address, created_at FROM wallets");
  res.json(wallets.rows);
});

// BALANCES
app.get("/admin/balances", async (req, res) => {
  const balances = await pool.query("SELECT * FROM balances");
  res.json(balances.rows);
});

/* ===============================
   START SERVER
=============================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});

/* ===============================
   START BLOCKCHAIN LISTENER
=============================== */

startBlockchainListener();
