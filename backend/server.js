require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { startMatchingEngine } = require("./matchingEngine");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ==============================
// CONFIG
// ==============================
const JWT_SECRET = process.env.JWT_SECRET;

// ==============================
// DATABASE
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// AUTH MIDDLEWARE
// ==============================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// ==============================
// SOCKET
// ==============================
io.on("connection", () => {
  console.log("⚡ Connected");
});

// ==============================
// HEALTH
// ==============================
app.get("/", (req, res) => {
  res.send("💎 SXP EXCHANGE LIVE");
});

// ==============================
// REGISTER
// ==============================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await pool.query(
    `INSERT INTO users (email, password, role)
     VALUES ($1,$2,'user') RETURNING *`,
    [email, hashed]
  );

  res.json(user.rows[0]);
});

// ==============================
// LOGIN
// ==============================
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length) {
    return res.status(400).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(
    password,
    user.rows[0].password
  );

  if (!valid) {
    return res.status(400).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    {
      id: user.rows[0].id,
      role: user.rows[0].role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: user.rows[0],
  });
});

// ==============================
// PORTFOLIO
// ==============================
app.get("/api/portfolio", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM balances WHERE user_id=$1",
    [req.user.id]
  );

  res.json(result.rows);
});

// ==============================
// ORDER
// ==============================
app.post("/api/order", auth, async (req, res) => {
  const { type, price, amount } = req.body;

  await pool.query(
    `INSERT INTO orders 
     (user_id, type, price, amount, remaining, status)
     VALUES ($1,$2,$3,$4,$5,'open')`,
    [req.user.id, type, price, amount, amount]
  );

  io.emit("orderbook_update");

  res.json({ success: true });
});

// ==============================
// ADMIN ROUTES
// ==============================
app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const users = await pool.query(
    "SELECT id, email, role, is_frozen FROM users"
  );
  res.json(users.rows);
});

app.post("/api/admin/freeze", auth, adminOnly, async (req, res) => {
  const { user_id } = req.body;

  await pool.query(
    "UPDATE users SET is_frozen=true WHERE id=$1",
    [user_id]
  );

  res.json({ success: true });
});

app.post("/api/admin/unfreeze", auth, adminOnly, async (req, res) => {
  const { user_id } = req.body;

  await pool.query(
    "UPDATE users SET is_frozen=false WHERE id=$1",
    [user_id]
  );

  res.json({ success: true });
});

app.get("/api/admin/withdrawals", auth, adminOnly, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM withdrawals ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

app.get("/api/admin/trades", auth, adminOnly, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM trades ORDER BY created_at DESC"
  );
  res.json(result.rows);
});

// ==============================
// START
// ==============================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("🚀 EXCHANGE LIVE");

  startMatchingEngine(io);
});
