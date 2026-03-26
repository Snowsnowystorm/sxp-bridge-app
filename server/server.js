import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";
import axios from "axios";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= DATABASE ================= */
mongoose.connect(process.env.DATABASE_URL);
console.log("✅ DB connected");

/* ================= ENV DEBUG ================= */
console.log("🔑 RAW PRIVATE KEY:", process.env.PRIVATE_KEY);
console.log("🔑 LENGTH:", process.env.PRIVATE_KEY?.length);

const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();

/* ================= ETH PROVIDERS ================= */
const providerPrimary = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const providerFallback = new ethers.JsonRpcProvider(process.env.ETH_FALLBACK_RPC);

let provider = providerPrimary;

function switchProvider() {
  console.log("🔄 Switching RPC...");
  provider = provider === providerPrimary ? providerFallback : providerPrimary;
}

/* ================= ETH WALLET ================= */
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
    console.log("❌ INVALID PRIVATE KEY FORMAT — withdraw disabled");
  }
} catch (err) {
  console.log("❌ Wallet init failed:", err.message);
}

/* ================= MODELS ================= */
const userSchema = new mongoose.Schema({
  walletAddress: String,
  balances: {
    sxp_eth: { type: Number, default: 0 },
    sxp_solar: { type: Number, default: 0 }
  }
});

const User = mongoose.model("User", userSchema);

const txSchema = new mongoose.Schema({
  walletAddress: String,
  amount: String,
  txHash: String,
  type: String,
  chain: String,
  createdAt: { type: Date, default: Date.now }
});

const Tx = mongoose.model("Tx", txSchema);

/* ================= SCANNER ================= */
let lastBlock = 0;

async function scanDeposits() {
  try {
    if (!contract) return;

    const currentBlock = await provider.getBlockNumber();

    if (!lastBlock) {
      lastBlock = currentBlock - 20;
      console.log("⚡ Starting scanner from:", lastBlock);
    }

    const step = 15;

    for (let i = lastBlock; i < currentBlock; i += step) {
      const toBlock = Math.min(i + step, currentBlock);

      console.log(`📦 Chunk: ${i} → ${toBlock}`);

      const logs = await provider.getLogs({
        address: process.env.SXP_CONTRACT,
        fromBlock: i,
        toBlock: toBlock,
        topics: [ethers.id("Transfer(address,address,uint256)")]
      });

      for (const log of logs) {
        const parsed = contract.interface.parseLog(log);

        const to = parsed.args.to.toLowerCase();
        const amount = Number(ethers.formatUnits(parsed.args.amount, 18));

        const user = await User.findOne({ walletAddress: to });

        if (user) {
          user.balances.sxp_eth += amount;
          await user.save();

          await Tx.create({
            walletAddress: to,
            amount,
            txHash: log.transactionHash,
            type: "deposit",
            chain: "ETH"
          });

          console.log("💰 Deposit:", amount);
        }
      }
    }

    lastBlock = currentBlock;

  } catch (err) {
    console.log("❌ Scanner error:", err.message);
    switchProvider();
  }
}

/* ================= SOLAR (API MODE - SAFE PLACEHOLDER) ================= */
async function sendSolar(toAddress, amount) {
  try {
    console.log("🌞 Solar bridge placeholder triggered");

    // ⚠️ Real signing + broadcast comes next phase
    return {
      id: "SOLAR_PENDING",
      to: toAddress,
      amount
    };

  } catch (err) {
    console.log("❌ Solar send error:", err.message);
    throw err;
  }
}

/* ================= WITHDRAW (ETH) ================= */
app.post("/withdraw", async (req, res) => {
  try {
    if (!wallet) {
      return res.status(500).json({ error: "Wallet not configured" });
    }

    const { walletAddress, toAddress, amount } = req.body;

    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: "Invalid ETH address" });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) return res.status(404).json({ error: "User not found" });

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

/* ================= BRIDGE TO SOLAR ================= */
app.post("/bridge/solar", async (req, res) => {
  try {
    const { walletAddress, solarAddress, amount } = req.body;

    const user = await User.findOne({ walletAddress });
    if (!user) return res.status(404).json({ error: "User not found" });

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

    res.json({
      success: true,
      message: "Solar bridge initiated (pending real transfer)",
      tx
    });

  } catch (err) {
    console.log("❌ Bridge error:", err.message);
    res.status(500).json({ error: "Bridge failed" });
  }
});

/* ================= HEARTBEAT ================= */
setInterval(() => {
  console.log("💓 Heartbeat alive...");
}, 10000);

/* ================= START ================= */
setInterval(scanDeposits, 15000);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
