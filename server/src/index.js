import express from "express";
import cors from "cors";
import { createWallet } from "./wallet.js";

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
// ❤️ HEALTH
// =============================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime()
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

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: "Wallet creation failed"
    });
  }
});

// =============================
// 🔁 BRIDGE
// =============================
app.post("/api/bridge", (req, res) => {
  try {
    const { fromChain, toChain, amount, address } = req.body;

    if (!fromChain || !toChain || !amount || !address) {
      return res.status(400).json({
        error: "Missing fields"
      });
    }

    const tx = {
      id: "tx_" + Date.now(),
      fromChain,
      toChain,
      amount,
      address,
      status: "processing"
    };

    res.json({
      success: true,
      tx
    });

  } catch (err) {
    res.status(500).json({
      error: "Bridge failed"
    });
  }
});

// =============================
// 🚀 START SERVER
// =============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
