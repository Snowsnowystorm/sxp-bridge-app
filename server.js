import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(express.json());

/* ===============================
   DATABASE (NEON)
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
   REGISTER USER
=============================== */

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
      [email, password]
    );

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Register failed" });
  }
});

/* ===============================
   CREATE WALLET (ETH / EVM)
=============================== */

app.post("/create-wallet", async (req, res) => {
  try {
    const { user_id, chain } = req.body;

    const wallet = ethers.Wallet.createRandom();

    const result = await pool.query(
      `INSERT INTO wallets (user_id, chain, address, private_key)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, chain, wallet.address, wallet.privateKey]
    );

    res.json({
      success: true,
      wallet: result.rows[0],
      mnemonic: wallet.mnemonic.phrase
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wallet creation failed" });
  }
});

/* ===============================
   GET BALANCE (DB ONLY)
=============================== */

app.get("/balance/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      "SELECT token, amount FROM balances WHERE user_id = $1",
      [userId]
    );

    res.json({
      success: true,
      balances: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

/* ===============================
   SERVER START
=============================== */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
