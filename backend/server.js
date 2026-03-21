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
  max: 30,
});
app.use(limiter);

const server = http.createServer(app);

// ==============================
// SOCKET.IO
// ==============================
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
  res.send("💎 SXP EXCHANGE LIVE + SECURE + SCALING");
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
    const { user_id } = req.params;

    const result = await pool.query(
      "SELECT sxp FROM balances WHERE user_id = $1",
      [user_id]
    );

    res.json({
      balance: result.rows[0]?.sxp || 0,
    });
  } catch (err) {
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
// WITHDRAW (QUEUE SYSTEM)
// ==============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;

    // VALIDATION
    if (!user_id || !address || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!validator.isNumeric(amount.toString())) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const numericAmount = parseFloat(amount);

    if (numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount value" });
    }

    // ==============================
    // CHECK BALANCE
    // ==============================
    const balanceRes = await pool.query(
      "SELECT sxp FROM balances WHERE user_id = $1",
      [user_id]
    );

    if (balanceRes.rows.length === 0) {
      return res.status(400).json({ error: "No balance account" });
    }

    const currentBalance = parseFloat(balanceRes.rows[0].sxp);

    if (currentBalance < numericAmount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // ==============================
    // FRAUD CHECK
    // ==============================
    if (numericAmount > 10000) {
      return res.status(400).json({ error: "Amount flagged" });
    }

    // ==============================
    // FEE
    // ==============================
    const fee = numericAmount * 0.01;
    const finalAmount = numericAmount - fee;

    // ==============================
    // DEDUCT BALANCE
    // ==============================
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id = $2",
      [numericAmount, user_id]
    );

    // ==============================
    // ADD TO QUEUE (ASYNC SEND)
    // ==============================
    addToQueue({
      type: "withdraw",
      address,
      amount: finalAmount,
    });

    // ==============================
    // SAVE TX (PENDING)
    // ==============================
    const tx = {
      type: "withdraw",
      amount: finalAmount,
      status: "queued",
    };

    await pool.query(
      `INSERT INTO transactions (type, amount, status)
       VALUES ($1, $2, $3)`,
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);

    res.json({
      success: true,
      status: "queued",
      fee,
    });

  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ error: "Withdraw failed" });
  }
});

// ==============================
// BRIDGE
// ==============================
app.post("/api/bridge", async (req, res) => {
  try {
    const { amount, chain } = req.body;

    if (!amount || !chain) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const tx = {
      type: `bridge-${chain}`,
      amount,
      status: "pending",
    };

    await pool.query(
      `INSERT INTO transactions (type, amount, status)
       VALUES ($1, $2, $3)`,
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: "Bridge failed" });
  }
});

// ==============================
// START SYSTEMS
// ==============================
startListener(io);
startWorker();

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 FULL EXCHANGE BACKEND RUNNING:", PORT);
});
