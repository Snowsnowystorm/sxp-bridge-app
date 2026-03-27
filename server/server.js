import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= SAFETY ================= */
process.on("uncaughtException", (err) => console.log("💥 UNCAUGHT:", err));
process.on("unhandledRejection", (err) => console.log("💥 PROMISE ERROR:", err));

console.log("🔥 FINAL STABLE SERVER STARTING");

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

/* ================= MULTI RPC (FORCED MAINNET) ================= */
const RPCS = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com"
];

let provider;

async function getWorkingProvider() {
  for (let url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url, {
        name: "mainnet",
        chainId: 1
      });

      const block = await p.getBlockNumber();

      console.log("✅ USING RPC:", url, "| Block:", block);
      return p;

    } catch (err) {
      console.log("❌ FAILED RPC:", url);
    }
  }

  throw new Error("❌ No working RPC");
}

provider = await getWorkingProvider();

/* ================= WALLET ================= */
let wallet;

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
      balanceETH: ethers.formatEther(balance)
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

    const balance = await provider.getBalance(wallet.address);

    console.log("💰 REAL BALANCE:", ethers.formatEther(balance));

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
