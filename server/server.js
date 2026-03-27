import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* =========================
   🔥 ENV VARIABLES
========================= */

const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MONGO_URI = process.env.MONGO_URI;

/* =========================
   🔥 DATABASE
========================= */

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ DB connected"))
  .catch(err => console.log("❌ DB error:", err));

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

const RPC_URLS = [
  "https://eth.llamarpc.com",
  "https://ethereum.publicnode.com",
  "https://rpc.flashbots.net"
];

let provider;

async function initProvider() {
  for (const url of RPC_URLS) {
    try {
      const testProvider = new ethers.JsonRpcProvider(url);
      const block = await testProvider.getBlockNumber();
      console.log(`✅ RPC WORKING: ${url} | Block: ${block}`);
      provider = testProvider;
      return;
    } catch (err) {
      console.log(`❌ FAILED RPC: ${url}`);
    }
  }

  throw new Error("❌ NO WORKING RPC");
}

/* =========================
   🔥 WALLET
========================= */

let wallet;

async function initWallet() {
  if (!provider) throw new Error("Provider not ready");
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log("🔥 Hot Wallet:", wallet.address);
}

/* =========================
   🚀 START SERVER
========================= */

async function startServer() {
  try {
    console.log("🔥 HARD-STABLE SERVER START");

    await initProvider();
    await initWallet();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ SERVER FAILED:", err);
    process.exit(1);
  }
}

startServer();

/* =========================
   🧪 DEBUG BALANCE (REAL)
========================= */

app.get("/debug-balance", async (req, res) => {
  try {
    const balance = await provider.getBalance(wallet.address);
    const eth = ethers.formatEther(balance);

    console.log("💰 REAL BALANCE:", eth);

    res.json({
      success: true,
      address: wallet.address,
      balanceETH: eth
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "balance failed" });
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
   💸 WITHDRAW (REAL)
========================= */

app.post("/withdraw", async (req, res) => {
  try {
    console.log("🔥 POST /withdraw HIT");
    console.log("📦 BODY:", req.body);

    const { amount, toAddress, walletAddress } = req.body;

    if (!amount || !toAddress || !walletAddress) {
      return res.status(400).json({ error: "Missing fields" });
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
    console.error(err);

    res.json({
      success: false,
      error: err.message
    });
  }
});
