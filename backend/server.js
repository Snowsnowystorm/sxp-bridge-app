// ==============================
// IMPORTS
// ==============================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ==============================
// MIDDLEWARE
// ==============================
app.use(cors());
app.use(express.json());

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// SOCKET.IO LIVE SYSTEM
// ==============================
io.on("connection", (socket) => {
  console.log("User connected");

  setInterval(async () => {
    try {
      const txs = await pool.query(
        "SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 10"
      );

      socket.emit("tx_update", txs.rows);
    } catch (err) {
      console.log(err);
    }
  }, 5000);
});

// ==============================
// FRAUD ENGINE
// ==============================
const withdrawCooldown = {};

const calculateRisk = ({ amount, ipChange }) => {
  let risk = 0;

  if (amount > 1) risk += 2;
  if (amount > 5) risk += 5;
  if (ipChange) risk += 3;

  return risk;
};

// ==============================
// ROUTES
// ==============================

// GET BALANCE
app.get("/api/balance/:user_id", async (req, res) => {
  const { user_id } = req.params;

  const result = await pool.query(
    "SELECT sxp FROM balances WHERE user_id=$1",
    [user_id]
  );

  res.json(result.rows[0] || { sxp: 0 });
});

// GET TRANSACTIONS
app.get("/api/transactions", async (req, res) => {
  const txs = await pool.query(
    "SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 20"
  );

  res.json(txs.rows);
});

// WITHDRAW (SECURE)
app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;

    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const numericAmount = parseFloat(amount);

    if (!user_id || !address || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // cooldown
    if (withdrawCooldown[user_id]) {
      return res.status(429).json({
        error: "Wait before next withdrawal",
      });
    }

    withdrawCooldown[user_id] = true;
    setTimeout(() => delete withdrawCooldown[user_id], 60000);

    // user
    const user = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [user_id]
    );

    if (user.rows[0]?.is_frozen) {
      return res.status(403).json({
        error: "Account frozen",
      });
    }

    // balance
    const bal = await pool.query(
      "SELECT sxp FROM balances WHERE user_id=$1",
      [user_id]
    );

    if (!bal.rows.length || bal.rows[0].sxp < numericAmount) {
      return res.status(400).json({
        error: "Insufficient funds",
      });
    }

    // risk check
    const ipChange =
      user.rows[0].last_login_ip !== ip;

    const risk = calculateRisk({
      amount: numericAmount,
      ipChange,
    });

    if (risk >= 5) {
      await pool.query(
        "UPDATE users SET is_frozen=true WHERE id=$1",
        [user_id]
      );

      return res.status(403).json({
        error: "Suspicious activity. Frozen.",
      });
    }

    // deduct
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id=$2",
      [numericAmount, user_id]
    );

    // save tx
    const result = await pool.query(
      `INSERT INTO withdrawals
       (user_id, address, amount, ip_address, risk_score)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [user_id, address, numericAmount, ip, risk]
    );

    res.json({
      success: true,
      tx: result.rows[0],
      risk,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Withdraw error" });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
