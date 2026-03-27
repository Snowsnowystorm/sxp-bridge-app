import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= SAFETY ================= */
process.on("uncaughtException", (err) => {
  console.log("💥 UNCAUGHT:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("💥 PROMISE ERROR:", err);
});

/* ================= DEBUG ================= */
console.log("🔥 DEBUG SERVER RUNNING");

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("✅ DB connected"))
  .catch((err) => console.log("❌ DB error:", err.message));

/* ================= USER MODEL ================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    walletAddress: String
  })
);

/* ================= ETH SETUP ================= */
const RPC_URL = process.env.ETH_RPC_URL;
console.log("🌐 RPC URL:", RPC_URL);

const provider = new ethers.JsonRpcProvider(RPC_URL);

let wallet = null;

try {
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();

  if (PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("🔥 Hot Wallet:", wallet.address);
  } else {
    console.log("⚠️ Invalid PRIVATE_KEY");
  }
} catch (err) {
  console.log("❌ Wallet error:", err.message);
}

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.send("API LIVE ✅");
});

/* ================= DEBUG BALANCE ================= */
app.get("/debug-balance", async (req, res) => {
  try {
    if (!wallet) {
      return res.json({ error: "Wallet not initialized" });
    }

    const balance = await provider.getBalance(wallet.address);

    res.json({
      address: wallet.address,
      balanceRaw: balance.toString(),
      balanceETH: ethers.formatEther(balance),
      rpc: RPC_URL
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= CREATE USER ================= */
app.post("/create-user", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    let user = await User.findOne({ walletAddress });

    if (!user) {
      user = await User.create({ walletAddress });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= WITHDRAW ================= */
app.post("/withdraw", async (req, res) => {
  console.log("🔥 POST /withdraw HIT");
  console.log("📦 BODY:", req.body);

  try {
    const { walletAddress, toAddress, amount } = req.body;

    if (!walletAddress || !toAddress || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!wallet) {
      return res.json({
        success: false,
        error: "Wallet not initialized"
      });
    }

    const balance = await provider.getBalance(wallet.address);

    console.log("💰 REAL WALLET BALANCE:", ethers.formatEther(balance));

    if (balance < ethers.parseEther(amount.toString())) {
      return res.json({
        success: false,
        error: "Insufficient REAL wallet balance"
      });
    }

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000
    });

    console.log("⏳ TX SENT:", tx.hash);

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.log("❌ WITHDRAW ERROR:", err);

    res.status(200).json({
      success: false,
      error: err.message
    });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
