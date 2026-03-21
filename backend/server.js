import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

dotenv.config();

const app = express();
const { Pool } = pkg;

/* =========================
   SERVER + SOCKET
========================= */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* =========================
   DATABASE
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   AUTH
========================= */
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

/* =========================
   SAVE TX + LIVE EMIT
========================= */
async function saveTxAndEmit(tx) {
  const result = await pool.query(
    `INSERT INTO transactions 
     (user_id, type, amount, to_address, tx_hash, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      tx.user_id,
      tx.type,
      tx.amount,
      tx.to_address || "",
      tx.tx_hash || "",
      tx.status || "pending"
    ]
  );

  const savedTx = result.rows[0];

  /* 🔥 LIVE UPDATE */
  io.emit("new_tx", savedTx);

  return savedTx;
}

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("SXP BACKEND LIVE 💎");
});

/* REGISTER */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await pool.query(
    "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING *",
    [email, hashed]
  );

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* LOGIN */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length)
    return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid)
    return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* WITHDRAW */
app.post("/withdraw", auth, async (req, res) => {
  const { amount, to } = req.body;

  const savedTx = await saveTxAndEmit({
    user_id: req.user.id,
    type: "withdraw",
    amount,
    to_address: to,
    status: "pending"
  });

  res.json({ success: true, tx: savedTx });
});

/* GET TRANSACTIONS */
app.get("/transactions", auth, async (req, res) => {
  const txs = await pool.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
    [req.user.id]
  );

  res.json(txs.rows);
});

/* =========================
   SOCKET CONNECTION
========================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

/* =========================
   START SERVER
========================= */
server.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server + Socket LIVE");
});
