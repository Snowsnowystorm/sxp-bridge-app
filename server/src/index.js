import express from "express";
import cors from "cors";
import { createWallet } from "./wallet.js";
import { getBalance } from "./balance.js";

const app = express();

// =============================
// 🔧 MIDDLEWARE
// =============================
app.use(cors());
app.use(express.json());

// =============================
// 🏠 ROOT
// =============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Running ✅");
});

// =============================
// ❤️ HEALTH CHECK
// =============================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// =============================
// 👤 CREATE WALLET
// =============================
app.post("/api/wallet/create", (req, res) => {
  try {
    const wallet = createWallet();

    res.json({
      success: true,
      wallet
    });

  } catch (error) {
    console.error("Wallet error:", error);

    res.status(500).json({
      success: false,
      error: "Wallet creation failed"
    });
  }
});

// =============================
// 💰 GET BALANCE (MULTI-CHAIN)
// =============================
app.get("/api/balance/:chain/:address", async (req, res) => {
  try {
    const { chain, address } = req.params;

    const result = await getBalance(address, chain);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Balance error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch balance"
    });
  }
});

// =============================
// 🔁 BRIDGE SYSTEM
// =============================
app.post("/api/bridge", (req, res) => {
  try {
    const { fromChain, toChain, amount, address } = req.body;

    // ✅ VALIDATION
    if (!fromChain || !toChain || !amount || !address) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields"
      });
    }

    // 🔮 SIMULATED TX (SAFE)
    const tx = {
      id: "tx_" + Date.now(),
      fromChain,
      toChain,
      amount,
      address,
      status: "processing",
      createdAt: new Date().toISOString()
    };

    console.log("Bridge TX:", tx);

    res.json({
      success: true,
      message: "Bridge initiated",
      transaction: tx
    });

  } catch (error) {
    console.error("Bridge error:", error);

    res.status(500).json({
      success: false,
      error: "Bridge failed"
    });
  }
});

// =============================
// 🚀 START SERVER
// =============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
