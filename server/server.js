import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";
import axios from "axios";
import bip39 from "bip39";
import nacl from "tweetnacl";

dotenv.config();

const app = express();

/* ================= SAFE GLOBAL ERROR HANDLING ================= */
process.on("uncaughtException", (err) => {
  console.log("💥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("💥 UNHANDLED PROMISE:", err);
});

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= DEBUG ================= */
console.log("🔥 CORRECT SERVER FILE RUNNING");

/* ================= ROUTES ================= */
app.get("/", (req, res) => {
  res.send("API LIVE ✅");
});

app.get("/withdraw", (req, res) => {
  res.send("Withdraw route exists ✅");
});

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("✅ DB connected"))
  .catch((err) => console.log("❌ DB error:", err.message));

/* ================= ETH SETUP ================= */
const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);

let wallet = null;
let contract = null;

try {
  if (PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("🔥 Hot Wallet:", wallet.address);

    contract = new ethers.Contract(
      process.env.SXP_CONTRACT,
      [
        "event Transfer(address indexed from, address indexed to, uint amount)",
        "function transfer(address to, uint amount) returns (bool)"
      ],
      wallet
    );
  } else {
    console.log("⚠️ Invalid ETH private key — running in safe mode");
  }
} catch (err) {
  console.log("❌ Wallet init failed:", err.message);
}

/* ================= SOLAR ================= */
function getSolarKeys() {
  try {
    const mnemonic = process.env.SOLAR_PASSPHRASE?.trim();
    if (!mnemonic) throw new Error("Missing SOLAR_PASSPHRASE");

    const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);

    return {
      publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
      privateKey: Buffer.from(keyPair.secretKey).toString("hex")
    };
  } catch (err) {
    console.log("⚠️ Solar keys error:", err.message);
    return null;
  }
}

async function sendSolar(toAddress, amount) {
  try {
    const keys = getSolarKeys();
    if (!keys) throw new Error("Solar keys not available");

    const tx = {
      type: 0,
      amount: Math.floor(amount * 1e8),
      fee: 10000000,
      recipientId: toAddress,
      senderPublicKey: keys.publicKey,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const message = JSON.stringify(tx);

    const signature = nacl.sign.detached(
      Buffer.from(message),
      Buffer.from(keys.privateKey, "hex")
    );

    tx.signature = Buffer.from(signature).toString("hex");

    const res = await axios.post(`${process.env.SOLAR_API}/transactions`, {
      transactions: [tx]
    });

    return {
      id: res.data?.data?.accept?.[0] || "UNKNOWN"
    };
  } catch (err) {
    console.log("❌ Solar TX error:", err.message);
    return { id: "FAILED" };
  }
}

/* ================= MODELS ================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    walletAddress: String,
    balances: {
      sxp_eth: { type: Number, default: 0 },
      sxp_solar: { type: Number, default: 0 }
    }
  })
);

const Tx = mongoose.model(
  "Tx",
  new mongoose.Schema({
    walletAddress: String,
    amount: Number,
    txHash: String,
    type: String,
    chain: String,
    createdAt: { type: Date, default: Date.now }
  })
);

/* ================= 💸 WITHDRAW ================= */
app.post("/withdraw", async (req, res) => {
  console.log("🔥 POST /withdraw HIT");
  console.log("📦 BODY:", req.body);

  try {
    const { walletAddress, toAddress, amount } = req.body;

    if (!walletAddress || !toAddress || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 🔒 SAFE MODE (no DB crash)
    let user = null;

    try {
      user = await User.findOne({ walletAddress });
    } catch (err) {
      console.log("⚠️ DB lookup failed:", err.message);
    }

    // 🧪 If no user → test mode
    if (!user) {
      console.log("⚠️ No user found → TEST MODE");

      return res.json({
        success: true,
        message: "TEST MODE (no user)",
        txHash: "0xTEST"
      });
    }

    // 🧪 If contract missing → test mode
    if (!contract) {
      console.log("⚠️ Contract not ready → TEST MODE");

      return res.json({
        success: true,
        message: "TEST MODE (no contract)",
        txHash: "0xTEST"
      });
    }

    // 🚫 Balance check
    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    user.balances.sxp_eth -= amount;
    await user.save();

    const tx = await contract.transfer(
      toAddress,
      ethers.parseUnits(amount.toString(), 18)
    );

    await tx.wait();

    await Tx.create({
      walletAddress,
      amount,
      txHash: tx.hash,
      type: "withdraw",
      chain: "ETH"
    });

    return res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.log("❌ WITHDRAW ERROR:", err.message);

    return res.status(500).json({
      error: "Withdraw failed",
      details: err.message
    });
  }
});

/* ================= 🌉 BRIDGE ================= */
app.post("/bridge/solar", async (req, res) => {
  console.log("🌞 POST /bridge/solar HIT");

  try {
    const { walletAddress, solarAddress, amount } = req.body;

    let user = null;

    try {
      user = await User.findOne({ walletAddress });
    } catch {}

    if (!user) {
      return res.json({
        success: true,
        message: "TEST MODE BRIDGE",
        solarTxId: "TEST_SOLAR"
      });
    }

    user.balances.sxp_eth -= amount;
    user.balances.sxp_solar += amount;
    await user.save();

    const tx = await sendSolar(solarAddress, amount);

    await Tx.create({
      walletAddress,
      amount,
      txHash: tx.id,
      type: "bridge",
      chain: "SOLAR"
    });

    res.json({
      success: true,
      solarTxId: tx.id
    });

  } catch (err) {
    console.log("❌ BRIDGE ERROR:", err.message);

    res.status(500).json({
      error: "Bridge failed",
      details: err.message
    });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
