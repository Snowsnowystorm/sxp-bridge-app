import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg";
import { startListener } from "./blockchain.js";
import { sendToken } from "./wallet.js";

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
// DATABASE
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
    console.error("Fetch TX error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ==============================
// GET BALANCE (NEW)
// ==============================
app.get("/api/balance/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      "SELECT sxp FROM balances WHERE user_id = $1",
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({ balance: 0 });
    }

    res.json({ balance: result.rows[0].sxp });

  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// ==============================
// SAVE TX
// ==============================
const saveTx = async (tx) => {
  try {
    await pool.query(
      `INSERT INTO transactions (type, amount, status)
       VALUES ($1, $2, $3)`,
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);
  } catch (err) {
    console.error("Save TX error:", err);
  }
};

// ==============================
// WITHDRAW (SECURE)
// ==============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { user_id, address, amount } = req.body;

    if (!user_id || !address || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const numericAmount = parseFloat(amount);

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
    // GAS / PLATFORM FEE
    // ==============================
    const gasFee = numericAmount * 0.01; // 1%
    const finalAmount = numericAmount - gasFee;

    if (finalAmount <= 0) {
      return res.status(400).json({ error: "Amount too small after fees" });
    }

    console.log("💸 Withdraw approved:", finalAmount);

    // ==============================
    // SEND REAL TOKEN
    // ==============================
    const txHash = await sendToken(address, finalAmount);

    // ==============================
    // UPDATE BALANCE
    // ==============================
    await pool.query(
      "UPDATE balances SET sxp = sxp - $1 WHERE user_id = $2",
      [numericAmount, user_id]
    );

    // ==============================
    // SAVE TRANSACTION
    // ==============================
    const tx = {
      type: "withdraw",
      amount: finalAmount,
      status: "sent",
      hash: txHash,
    };

    await pool.query(
      `INSERT INTO transactions (type, amount, status)
       VALUES ($1, $2, $3)`,
      [tx.type, tx.amount, tx.status]
    );

    io.emit("tx_update", tx);

    res.json({
      success: true,
      txHash,
      fee: gasFee,
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

    await saveTx(tx);

    res.json({ success: true });

  } catch (err) {
    console.error("Bridge error:", err);
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
