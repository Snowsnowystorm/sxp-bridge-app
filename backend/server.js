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
// RATE LIMIT (ANTI-HACK)
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
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.send("💎 SXP EXCHANGE PRODUCTION READY");
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
// GET TRADES (NEW)
// ==============================
app.get("/api/trades", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM trades ORDER BY created_at DESC LIMIT 50"
  );

  res.json(result.rows);
});

// ==============================
// WITHDRAW (REAL SYSTEM)
// ==============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;

    if (!user_id || !address || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: "Invalid wallet" });
    }

    const numericAmount = parseFloat(amount);

    const bal = await pool.query(
      "SELECT sxp FROM balances WHERE user_id=$1",
      [user_id]
    );

    if (!bal.rows.length) {
      return res.status(400).json({ error: "No balance" });
    }

    if (parseFloat(bal.rows[0].sxp) < numericAmount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const fee = numericAmount * 0.01;
    const finalAmount = numericAmount - fee;

    // Deduct balance
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id=$2",
      [numericAmount, user_id]
    );

    // Add to queue (worker sends tx)
    addToQueue({
      type: "withdraw",
      address,
      amount: finalAmount,
    });

    const tx = {
      type: "withdraw",
      amount: finalAmount,
      status: "queued",
    };

    await pool.query(
      "INSERT INTO transactions (type, amount, status) VALUES ($1,$2,$3)",
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);

    res.json({ success: true, fee });

  } catch {
    res.status(500).json({ error: "Withdraw failed" });
  }
});

// ==============================
// BRIDGE
// ==============================
app.post("/api/bridge", async (req, res) => {
  try {
    const { amount, chain } = req.body;

    const tx = {
      type: `bridge-${chain}`,
      amount,
      status: "pending",
    };

    await pool.query(
      "INSERT INTO transactions (type, amount, status) VALUES ($1,$2,$3)",
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Bridge failed" });
  }
});

// ==============================
// 💎 PLACE ORDER (LOCKED SYSTEM)
// ==============================
app.post("/api/order", async (req, res) => {
  try {
    const { user_id, type, price, amount } = req.body;

    const numericPrice = parseFloat(price);
    const numericAmount = parseFloat(amount);

    if (!user_id || !type || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid order" });
    }

    // ==========================
    // LOCK FUNDS
    // ==========================
    if (type === "buy") {
      const cost = numericPrice * numericAmount;

      await pool.query(
        "UPDATE balances SET locked = locked + $1 WHERE user_id=$2",
        [cost, user_id]
      );
    }

    if (type === "sell") {
      await pool.query(
        "UPDATE balances SET locked = locked + $1 WHERE user_id=$2",
        [numericAmount, user_id]
      );
    }

    // ==========================
    // CREATE ORDER
    // ==========================
    await pool.query(
      `INSERT INTO orders 
       (user_id, type, price, amount, remaining, status)
       VALUES ($1,$2,$3,$4,$5,'open')`,
      [user_id, type, numericPrice, numericAmount, numericAmount]
    );

    io.emit("order_update");

    res.json({ success: true });

  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ error: "Order failed" });
  }
});

// ==============================
// ORDER BOOK
// ==============================
app.get("/api/orderbook", async (req, res) => {
  const buys = await pool.query(
    "SELECT * FROM orders WHERE type='buy' AND status='open' ORDER BY price DESC"
  );

  const sells = await pool.query(
    "SELECT * FROM orders WHERE type='sell' AND status='open' ORDER BY price ASC"
  );

  res.json({
    buys: buys.rows,
    sells: sells.rows,
  });
});

// ==============================
// START SYSTEMS
// ==============================
startListener(io);       // blockchain deposits
startWorker();           // withdrawal worker
startMatchingEngine(io); // exchange engine

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 SXP EXCHANGE FULLY LIVE:", PORT);
});
