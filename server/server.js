import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";
import axios from "axios";
import bip39 from "bip39";
import nacl from "tweetnacl";

dotenv.config();

const app = express();

/* ================= CRITICAL MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= DEBUG ROUTES ================= */
app.get("/", (req, res) => {
  res.send("API LIVE ✅");
});

app.get("/withdraw", (req, res) => {
  res.send("Withdraw route exists ✅");
});

/* ================= DATABASE ================= */
mongoose.connect(process.env.DATABASE_URL);
console.log("✅ DB connected");

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
    console.log("❌ Invalid ETH private key");
  }
} catch (err) {
  console.log("❌ Wallet init failed:", err.message);
}

/* ================= SOLAR KEYS ================= */
function getSolarKeys() {
  const mnemonic = process.env.SOLAR_PASSPHRASE.trim();
  const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  return {
    publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
    privateKey: Buffer.from(keyPair.secretKey).toString("hex")
  };
}

/* ================= SOLAR SEND ================= */
async function sendSolar(toAddress, amount) {
  try {
    console.log("🌞 Building Solar TX...");

    const keys = getSolarKeys();

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

    console.log("📡 Solar broadcast:", res.data);

    return {
      id: res.data?.data?.accept?.[0] || "UNKNOWN"
    };

  } catch (err) {
    console.log("❌ Solar error:", err.response?.data || err.message);
    throw err;
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

/* ================= 🔥 POST WITHDRAW (FIXED) ================= */
app.post("/withdraw", async (req, res) => {
  console.log("🔥 POST /withdraw HIT");
  console.log("📦 BODY:", req.body);

  try {
    const { walletAddress, toAddress, amount } = req.body;

    if (!wallet) {
      return res.status(500).json({ error: "Wallet not configured" });
    }

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

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

    res.json({ success: true, txHash: tx.hash });

  } catch (err) {
    console.log("❌ Withdraw error:", err.message);
    res.status(500).json({ error: "Withdraw failed" });
  }
});

/* ================= SOLAR BRIDGE ================= */
app.post("/bridge/solar", async (req, res) => {
  console.log("🌞 POST /bridge/solar HIT");

  try {
    const { walletAddress, solarAddress, amount } = req.body;

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
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

    res.json({ success: true, solarTxId: tx.id });

  } catch (err) {
    console.log("❌ Bridge error:", err.message);
    res.status(500).json({ error: "Bridge failed" });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
