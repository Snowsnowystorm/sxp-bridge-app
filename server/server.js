import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(express.json());

console.log("🔥 FINAL PRODUCTION SERVER START");

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

/* ================= PROVIDER (FOR SENDING TX ONLY) ================= */
const provider = new ethers.JsonRpcProvider(
  "https://rpc.ankr.com/eth",
  1
);

console.log("🌐 TX PROVIDER READY");

/* ================= WALLET ================= */
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

/* ================= ETHERSCAN BALANCE ================= */
async function getRealBalance(address) {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${process.env.ETHERSCAN_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  return ethers.formatEther(data.result);
}

/* ================= DEBUG ================= */
app.get("/debug-balance", async (req, res) => {
  try {
    if (!wallet) {
      return res.json({ error: "Wallet not initialized" });
    }

    const balance = await getRealBalance(wallet.address);

    res.json({
      address: wallet.address,
      balanceETH: balance
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
  console.log("🔥 WITHDRAW HIT", req.body);

  try {
    const { walletAddress, toAddress, amount } = req.body;

    if (!walletAddress || !toAddress || !amount) {
      return res.json({ success: false, error: "Missing fields" });
    }

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    const balance = await getRealBalance(wallet.address);

    console.log("💰 REAL BALANCE:", balance);

    if (parseFloat(balance) < parseFloat(amount)) {
      return res.json({
        success: false,
        error: "Insufficient REAL wallet balance"
      });
    }

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString())
    });

    console.log("🚀 TX SENT:", tx.hash);

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.log("❌ WITHDRAW ERROR:", err);

    res.json({
      success: false,
      error: err.message
    });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running on port", process.env.PORT);
});
