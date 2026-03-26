import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= SAFETY ================= */
process.on("uncaughtException", (err) => {
  console.log("💥 UNCAUGHT:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.log("💥 PROMISE ERROR:", err);
});

/* ================= DEBUG ================= */
console.log("🔥 SERVER RUNNING CORRECT FILE");

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.send("API LIVE ✅");
});

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("✅ DB connected"))
  .catch((err) => console.log("❌ DB error:", err.message));

/* ================= MODELS ================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    walletAddress: String,
    balances: {
      sxp_eth: { type: Number, default: 0 }
    }
  })
);

/* ================= ETH ================= */
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

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

/* ================= CREATE USER ================= */
app.post("/create-user", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    let user = await User.findOne({ walletAddress });

    if (!user) {
      user = await User.create({
        walletAddress,
        balances: {
          sxp_eth: 10 // test balance
        }
      });
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

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // deduct balance
    user.balances.sxp_eth -= amount;
    await user.save();

    // if no wallet → safe test fallback
    if (!wallet) {
      return res.json({
        success: true,
        message: "TEST MODE (no wallet)",
        txHash: "0xTEST"
      });
    }

    // 🚀 REAL ETH TRANSFER
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString())
    });

    await tx.wait();

    console.log("✅ TX SENT:", tx.hash);

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.log("❌ WITHDRAW ERROR:", err.message);

    res.status(500).json({
      error: "Withdraw failed",
      details: err.message
    });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
