import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import WebSocket from "ws";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || "*"
}));

// ===============================
// 🔥 DATABASE CONNECTION
// ===============================
const client = new MongoClient(process.env.DATABASE_URL);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("sxp_bridge");
    console.log("✅ DB connected");
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
}

// ===============================
// 👤 CREATE USER + WALLET
// ===============================
app.post("/api/users/create", async (req, res) => {
  try {
    const wallet = ethers.Wallet.createRandom();

    const user = {
      walletAddress: wallet.address.toLowerCase(),
      mnemonic: wallet.mnemonic.phrase,
      privateKey: wallet.privateKey,
      balances: {
        sxp_eth: 0,
        sxp_bnb: 0,
        sxp_solar: 0
      },
      createdAt: new Date()
    };

    await db.collection("users").insertOne(user);

    res.json({
      success: true,
      wallet: user.walletAddress,
      mnemonic: user.mnemonic,
      privateKey: user.privateKey
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// ===============================
// 📊 GET USER
// ===============================
app.get("/api/users/:wallet", async (req, res) => {
  try {
    const user = await db.collection("users").findOne({
      walletAddress: req.params.wallet.toLowerCase()
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ===============================
// 💰 CREDIT USER
// ===============================
async function creditUser(walletAddress, amount, txHash) {
  try {
    const existing = await db.collection("transactions").findOne({ txHash });
    if (existing) return;

    const user = await db.collection("users").findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    if (!user) return;

    await db.collection("users").updateOne(
      { walletAddress: walletAddress.toLowerCase() },
      { $inc: { "balances.sxp_eth": parseFloat(amount) } }
    );

    await db.collection("transactions").insertOne({
      walletAddress,
      amount,
      txHash,
      type: "deposit",
      createdAt: new Date()
    });

    console.log("💰 CREDITED:", walletAddress, amount);

  } catch (err) {
    console.error("Credit error:", err);
  }
}

// ===============================
// 🔥 STABLE WEBSOCKET LISTENER
// ===============================
let ws = null;
let reconnectDelay = 5000;

function startDepositListener() {
  if (ws) {
    console.log("⚠️ WebSocket already running");
    return;
  }

  console.log("🔌 Connecting to Alchemy...");

  ws = new WebSocket(process.env.ALCHEMY_WS);

  ws.on("open", () => {
    console.log("🚀 Connected to Alchemy WebSocket");

    reconnectDelay = 5000;

    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_subscribe",
      params: [
        "alchemy_minedTransactions",
        {
          addresses: [{ to: null }],
          hashesOnly: false
        }
      ]
    }));
  });

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data);
      if (!msg.params) return;

      const tx = msg.params.result.transaction;
      const to = tx.to?.toLowerCase();
      if (!to) return;

      const user = await db.collection("users").findOne({
        walletAddress: to
      });

      if (!user) return;

      console.log("🔥 DEPOSIT DETECTED");

      await creditUser(
        to,
        ethers.formatEther(tx.value),
        tx.hash
      );

    } catch (err) {
      console.error("WS parse error:", err);
    }
  });

  ws.on("error", (err) => {
    console.error("❌ WS error:", err.message);
  });

  ws.on("close", () => {
    console.log(`⚠️ WS closed. Reconnecting in ${reconnectDelay / 1000}s...`);

    ws = null;

    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 60000);
      startDepositListener();
    }, reconnectDelay);
  });
}

// ===============================
// 🌐 HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend Running ✅");
});

// ===============================
// 🚀 START SERVER
// ===============================
async function startServer() {
  await connectDB();

  startDepositListener();

  app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
  });
}

startServer();
