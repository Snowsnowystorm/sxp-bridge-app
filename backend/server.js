import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// 💎 SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 💎 DATABASE (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.send("SXP BACKEND LIVE 💎");
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
// SAVE TRANSACTION (CORE)
// ==============================
const saveTx = async (tx) => {
  await pool.query(
    `INSERT INTO transactions (type, amount, status)
     VALUES ($1, $2, $3)`,
    [tx.type, tx.amount, tx.status]
  );

  io.emit("tx_update", tx); // 💎 REAL-TIME PUSH
};

// ==============================
// WITHDRAW
// ==============================
app.post("/api/withdraw", async (req, res) => {
  const { address, amount } = req.body;

  const tx = {
    type: "withdraw",
    amount,
    status: "processing",
  };

  await saveTx(tx);

  res.json({ success: true });
});

// ==============================
// BRIDGE
// ==============================
app.post("/api/bridge", async (req, res) => {
  const { amount, chain } = req.body;

  const tx = {
    type: `bridge-${chain}`,
    amount,
    status: "pending",
  };

  await saveTx(tx);

  res.json({ success: true });
});

// ==============================
// SIMULATED DEPOSIT (REPLACE WITH LISTENER)
// ==============================
setInterval(async () => {
  const tx = {
    type: "deposit",
    amount: Math.floor(Math.random() * 100),
    status: "confirmed",
  };

  await saveTx(tx);
}, 20000);

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
