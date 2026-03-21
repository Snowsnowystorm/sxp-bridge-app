import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";

/* SECURITY */
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

/* SYSTEM */
import { txQueue } from "./queues/txQueue.js";
import { startWorker } from "./workers/txWorker.js";
import { getHotWallet, getHotWalletBalance } from "./utils/hotWallet.js";
import { sweepToCold } from "./utils/sweeper.js";

dotenv.config();

const app = express();
const { Pool } = pkg;

/* DB */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* PROVIDER */
const provider = new ethers.JsonRpcProvider(
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
);

/* MIDDLEWARE */
app.use(express.json());
app.use(securityHeaders);
app.use(corsConfig);
app.use(limiter);

/* AUTH */
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

/* HEALTH */
app.get("/", (req, res) => {
  res.send("SXP Backend FULL SYSTEM RUNNING 💎🚀");
});

/* REGISTER */
app.post(
  "/register",
  strictLimiter,
  validateEmail,
  validatePassword,
  async (req, res) => {
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
  }
);

/* LOGIN */
app.post(
  "/login",
  strictLimiter,
  validateEmail,
  async (req, res) => {
    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!user.rows.length)
      return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!valid)
      return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token });
  }
);

/* CREATE WALLET */
app.post("/wallet/create", auth, async (req, res) => {
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
});

/* WITHDRAW + SAVE TX */
app.post(
  "/withdraw",
  auth,
  strictLimiter,
  validateAddress,
  async (req, res) => {
    const { amount, to } = req.body;

    const txRecord = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, to_address)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [req.user.id, "withdraw", amount, to]
    );

    const txId = txRecord.rows[0].id;

    await txQueue.add("withdraw", {
      type: "withdraw",
      to,
      amount,
      txId
    });

    res.json({
      success: true,
      txId,
      message: "Queued ⚡"
    });
  }
);

/* GET TRANSACTIONS */
app.get("/transactions", auth, async (req, res) => {
  const txs = await pool.query(
    `SELECT * FROM transactions
     WHERE user_id=$1
     ORDER BY created_at DESC`,
    [req.user.id]
  );

  res.json(txs.rows);
});

/* ADMIN HOT WALLET */
app.get("/admin/hot-wallet", auth, async (req, res) => {
  const data = await getHotWalletBalance(provider);
  res.json(data);
});

/* START WORKER */
startWorker();

/* SWEEP */
setInterval(() => {
  sweepToCold(provider);
}, 60000);

/* START SERVER */
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
