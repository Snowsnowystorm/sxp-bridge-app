import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* =========================
   🔥 ENV
========================= */

const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MONGO_URI = process.env.MONGO_URI;

/* =========================
   🔥 DATABASE (SAFE)
========================= */

if (!MONGO_URI) {
  console.log("⚠️ No DB connected (MONGO_URI missing)");
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ DB connected"))
    .catch(err => console.log("❌ DB error:", err));
}

const userSchema = new mongoose.Schema({
  walletAddress: String,
  balances: {
    ETH: { type: Number, default: 0 }
  }
});

const User = mongoose.model("User", userSchema);

/* =========================
   🔥 RPC (STABLE)
========================= */

let provider;

try {
  provider = new ethers.JsonRpcProvider("https://ethereum.publicnode.com");
  console.log("✅ Provider initialized");
} catch (err) {
  console.log("❌ Provider failed:", err.message);
}

/* =========================
   🔥 WALLET (SAFE INIT)
========================= */

let wallet;

try {
  if (!PRIVATE_KEY) {
    console.log("❌ PRIVATE_KEY missing");
  } else {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("🔥 Hot Wallet:", wallet.address);
  }
} catch (err) {
  console.log("❌ Wallet init failed:", err.message);
}

/* =========================
   🚀 SERVER START
========================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* =========================
   🧪 DEBUG BALANCE (SAFE)
========================= */

app.get("/debug-balance", async (req, res) => {
  try {
    console.log("🧪 DEBUG BALANCE HIT");

    if (!PRIVATE_KEY) {
      return res.json({ error: "PRIVATE_KEY missing" });
    }

    if (!wallet) {
      return res.json({ error: "wallet not initialized" });
    }

    if (!provider) {
      return res.json({ error: "provider not initialized" });
    }

    console.log("👉 Wallet:", wallet.address);

    const balance = await provider.getBalance(wallet.address);

    console.log("👉 RAW BALANCE:", balance.toString());

    const eth = ethers.formatEther(balance);

    res.json({
      success: true,
      address: wallet.address,
      balanceETH: eth
    });

  } catch (err) {
    console.error("❌ DEBUG ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   👤 CREATE USER
========================= */

app.post("/create-user", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    let user = await User.findOne({ walletAddress });

    if (!user) {
      user = await User.create({ walletAddress });
    }

    res.json({ success: true, user });

  } catch (err) {
    res.status(500).json({ error: "create user failed" });
  }
});

/* =========================
   💰 GET USER
========================= */

app.get("/user/:wallet", async (req, res) => {
  try {
    const user = await User.findOne({ walletAddress: req.params.wallet });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: "fetch failed" });
  }
});

/* =========================
   💸 WITHDRAW (SAFE DEBUG)
========================= */

app.post("/withdraw", async (req, res) => {
  try {
    console.log("🔥 POST /withdraw HIT");
    console.log("📦 BODY:", req.body);

    const { amount, toAddress, walletAddress } = req.body;

    if (!amount || !toAddress || !walletAddress) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (!wallet) {
      return res.json({ success: false, error: "Wallet not initialized" });
    }

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.json({
        success: false,
        error: "User not found"
      });
    }

    const balance = await provider.getBalance(wallet.address);
    const balanceETH = parseFloat(ethers.formatEther(balance));

    console.log("💰 REAL WALLET BALANCE:", balanceETH);

    if (balanceETH < amount) {
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

    await tx.wait();

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.error("❌ WITHDRAW ERROR:", err);

    res.json({
      success: false,
      error: err.message
    });
  }
});
