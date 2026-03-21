import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg";
import { startListener } from "./blockchain.js";

const { Pool } = pkg;

// ==============================
// INIT
// ==============================
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ==============================
// SOCKET.IO
// ==============================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ==============================
// DATABASE (Neon)
// ==============================
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
  try {
    const result = await pool.query(
      "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ==============================
// SAVE TX (CORE SYSTEM)
// ==============================
const saveTx = async (tx) => {
  try {
    await pool.query(
      `INSERT INTO transactions (type, amount, status)
       VALUES ($1, $2, $3)`,
      [tx.type, tx.amount, tx.status]
    );

    // 💎 REAL-TIME PUSH
    io.emit("tx_update", tx);
  } catch (err) {
    console.error("Save TX error:", err);
  }
};

// ==============================
// WITHDRAW (REAL STRUCTURE)
// ==============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { address, amount } = req.body;

    if (!address || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const tx = {
      type: "withdraw",
      amount,
      status: "processing",
    };

    await saveTx(tx);

    // ⚠️ REAL SEND COMES NEXT PHASE
    // (we'll plug wallet signing next)

    res.json({ success: true });
  } catch (err) {
    console.error(err);
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

    await saveTx(tx);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bridge failed" });
  }
});

// ==============================
// START BLOCKCHAIN LISTENER
// ==============================
startListener(io);

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
