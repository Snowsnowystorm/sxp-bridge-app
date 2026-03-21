import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { ethers } from "ethers";

/* ===============================
   SECURITY IMPORTS
=============================== */
import {
  limiter,
  strictLimiter,
  securityHeaders,
  corsConfig
} from "./middleware/security.js";

import {
  validateEmail,
  validatePassword,
  validateAddress
} from "./middleware/validate.js";

/* ===============================
   CONFIG
=============================== */
dotenv.config();

const app = express();
const { Pool } = pkg;

/* ===============================
   DATABASE (NEON)
=============================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* ===============================
   GLOBAL MIDDLEWARE
=============================== */
app.use(express.json());

app.use(securityHeaders);
app.use(corsConfig);
app.use(limiter);

/* ===============================
   JWT AUTH MIDDLEWARE
=============================== */
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
}

/* ===============================
   HEALTH CHECK
=============================== */
app.get("/", (req, res) => {
  res.send("SXP Backend + DB Running 🚀");
});

/* ===============================
   REGISTER
=============================== */
app.post(
  "/register",
  strictLimiter,
  validateEmail,
  validatePassword,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const hashed = await bcrypt.hash(password, 10);

      const user = await pool.query(
        "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING *",
        [email, hashed]
      );

      const token = jwt.sign(
        { id: user.rows[0].id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({ token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Register failed" });
    }
  }
);

/* ===============================
   LOGIN
=============================== */
app.post(
  "/login",
  strictLimiter,
  validateEmail,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await pool.query(
        "SELECT * FROM users WHERE email=$1",
        [email]
      );

      if (user.rows.length === 0) {
        return res.status(400).json({ error: "User not found" });
      }

      const valid = await bcrypt.compare(
        password,
        user.rows[0].password
      );

      if (!valid) {
        return res.status(400).json({ error: "Invalid password" });
      }

      const token = jwt.sign(
        { id: user.rows[0].id },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({ token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  }
);

/* ===============================
   CREATE WALLET (ETH)
=============================== */
app.post("/wallet/create", auth, async (req, res) => {
  try {
    const wallet = ethers.Wallet.createRandom();

    const saved = await pool.query(
      `INSERT INTO wallets (user_id, chain, address, private_key)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [
        req.user.id,
        "SXP-ETH",
        wallet.address,
        wallet.privateKey
      ]
    );

    res.json({
      wallet: saved.rows[0],
      mnemonic: wallet.mnemonic.phrase
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Wallet creation failed" });
  }
});

/* ===============================
   GET BALANCES
=============================== */
app.get("/balances", auth, async (req, res) => {
  try {
    const balances = await pool.query(
      "SELECT * FROM balances WHERE user_id=$1",
      [req.user.id]
    );

    res.json(balances.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

/* ===============================
   WITHDRAW (SECURED)
=============================== */
app.post(
  "/withdraw",
  auth,
  strictLimiter,
  validateAddress,
  async (req, res) => {
    try {
      const { amount, to } = req.body;

      const wallet = await pool.query(
        "SELECT * FROM wallets WHERE user_id=$1 LIMIT 1",
        [req.user.id]
      );

      if (wallet.rows.length === 0) {
        return res.status(400).json({ error: "No wallet found" });
      }

      const provider = new ethers.JsonRpcProvider(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
      );

      const signer = new ethers.Wallet(
        wallet.rows[0].private_key,
        provider
      );

      const tx = await signer.sendTransaction({
        to,
        value: ethers.parseEther(amount.toString())
      });

      res.json({
        success: true,
        txHash: tx.hash
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Withdraw failed" });
    }
  }
);

/* ===============================
   ADMIN (BASIC)
=============================== */
app.get("/admin/users", auth, strictLimiter, async (req, res) => {
  try {
    const users = await pool.query("SELECT id, email FROM users");
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: "Admin fetch failed" });
  }
});

/* ===============================
   START SERVER
=============================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
