require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

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
// SOCKET CONNECTION
// ==============================
io.on("connection", (socket) => {
  console.log("⚡ User connected");

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

// ==============================
// HEALTH
// ==============================
app.get("/", (req, res) => {
  res.send("💎 SXP EXCHANGE REAL-TIME LIVE");
});

// ==============================
// ORDERBOOK
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
// TRADES
// ==============================
app.get("/api/trades", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM trades ORDER BY created_at DESC LIMIT 50"
  );

  res.json(result.rows);
});

// ==============================
// PLACE ORDER
// ==============================
app.post("/api/order", async (req, res) => {
  try {
    const { user_id, type, price, amount } = req.body;

    const numericPrice = parseFloat(price);
    const numericAmount = parseFloat(amount);

    if (!user_id || !type || numericAmount <= 0) {
      return res.status(400).json({ error: "Invalid order" });
    }

    await pool.query(
      `INSERT INTO orders (user_id, type, price, amount, remaining, status)
       VALUES ($1,$2,$3,$4,$5,'open')`,
      [user_id, type, numericPrice, numericAmount, numericAmount]
    );

    // 🔥 REAL-TIME UPDATE
    io.emit("orderbook_update");

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Order failed" });
  }
});

// ==============================
// WITHDRAW (SECURE)
// ==============================
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

    // risk
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
        error: "Suspicious activity detected",
      });
    }

    // deduct
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id=$2",
      [numericAmount, user_id]
    );

    const result = await pool.query(
      `INSERT INTO withdrawals
       (user_id, address, amount, ip_address, risk_score)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [user_id, address, numericAmount, ip, risk]
    );

    // 🔥 REAL-TIME TX UPDATE
    io.emit("tx_update", result.rows[0]);

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
  console.log("🚀 EXCHANGE LIVE:", PORT);
});
