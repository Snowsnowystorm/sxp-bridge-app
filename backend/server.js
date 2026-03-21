import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import validator from "validator";

import { startListener } from "./blockchain.js";
import { addToQueue } from "./queue.js";
import { startWorker } from "./worker.js";
import { startMatchingEngine } from "./matchingEngine.js";

const { Pool } = pkg;

// ==============================
// INIT
// ==============================
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// ==============================
// RATE LIMIT
// ==============================
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
});
app.use(limiter);

// ==============================
// SERVER + SOCKET
// ==============================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// HEALTH
// ==============================
app.get("/", (req, res) => {
  res.send("💎 SXP EXCHANGE + CUSTODY SYSTEM LIVE");
});

// ==============================
// HELPERS
// ==============================
const isValidAddress = (addr) => validator.isEthereumAddress(addr);

// ==============================
// GET BALANCE
// ==============================
app.get("/api/balance/:user_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT sxp, locked FROM balances WHERE user_id=$1",
      [req.params.user_id]
    );

    res.json(result.rows[0] || { sxp: 0, locked: 0 });

  } catch {
    res.status(500).json({ error: "Balance error" });
  }
});

// ==============================
// GET TRANSACTIONS
// ==============================
app.get("/api/transactions", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50"
  );

  res.json(result.rows);
});

// ==============================
// GET WITHDRAWALS (ADMIN)
// ==============================
app.get("/api/admin/withdrawals", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM withdrawals ORDER BY created_at DESC"
  );

  res.json(result.rows);
});

// ==============================
// 💎 SECURE WITHDRAW REQUEST
// ==============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;
    const numericAmount = parseFloat(amount);

    if (!user_id || !address || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: "Invalid wallet" });
    }

    const bal = await pool.query(
      "SELECT sxp FROM balances WHERE user_id=$1",
      [user_id]
    );

    if (!bal.rows.length || bal.rows[0].sxp < numericAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct immediately (prevents double spend)
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id=$2",
      [numericAmount, user_id]
    );

    // Save withdrawal
    const result = await pool.query(
      `INSERT INTO withdrawals (user_id, address, amount)
       VALUES ($1,$2,$3) RETURNING *`,
      [user_id, address, numericAmount]
    );

    const withdrawal = result.rows[0];

    res.json({
      success: true,
      status: withdrawal.status,
      id: withdrawal.id,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Withdraw error" });
  }
});

// ==============================
// 💎 ADMIN APPROVE WITHDRAW
// ==============================
app.post("/api/admin/approve-withdraw", async (req, res) => {
  try {
    const { withdrawal_id } = req.body;

    const w = await pool.query(
      "SELECT * FROM withdrawals WHERE id=$1",
      [withdrawal_id]
    );

    if (!w.rows.length) {
      return res.status(404).json({ error: "Not found" });
    }

    const withdrawal = w.rows[0];

    // Update status
    await pool.query(
      "UPDATE withdrawals SET status='approved' WHERE id=$1",
      [withdrawal_id]
    );

    // Send to worker
    addToQueue({
      type: "withdraw",
      address: withdrawal.address,
      amount: withdrawal.amount,
      withdrawal_id,
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Approval failed" });
  }
});

// ==============================
// START SYSTEMS
// ==============================
startListener(io);
startWorker();
startMatchingEngine(io);

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 SXP EXCHANGE + SECURITY SYSTEM LIVE:", PORT);
});
