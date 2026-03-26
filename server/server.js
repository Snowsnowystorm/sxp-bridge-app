import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= DATABASE ================= */
mongoose.connect(process.env.DATABASE_URL);
console.log("✅ DB connected");

/* ================= ENV VALIDATION ================= */
if (!process.env.PRIVATE_KEY || !process.env.PRIVATE_KEY.startsWith("0x") || process.env.PRIVATE_KEY.length !== 66) {
  throw new Error("❌ INVALID PRIVATE KEY IN .env (must be 0x + 64 hex chars)");
}

if (!process.env.SXP_CONTRACT) {
  throw new Error("❌ Missing SXP_CONTRACT in .env");
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

/* ================= PROVIDERS ================= */
const providerPrimary = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const providerFallback = new ethers.JsonRpcProvider(process.env.ETH_FALLBACK_RPC);

let provider = providerPrimary;

function switchProvider() {
  console.log("🔄 Switching RPC...");
  provider = provider === providerPrimary ? providerFallback : providerPrimary;
}

/* ================= HOT WALLET ================= */
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
console.log("🔥 Hot Wallet:", wallet.address);

/* ================= CONTRACT ================= */
const contract = new ethers.Contract(
  process.env.SXP_CONTRACT,
  [
    "event Transfer(address indexed from, address indexed to, uint amount)",
    "function transfer(address to, uint amount) returns (bool)"
  ],
  wallet
);

/* ================= SCANNER ================= */
let lastBlock = 0;

async function scanDeposits() {
  try {
    const currentBlock = await provider.getBlockNumber();

    if (!lastBlock) {
      lastBlock = currentBlock - 50;
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

          console.log("💰 Deposit detected:", amount);
        }
      }
    }

    lastBlock = currentBlock;

  } catch (err) {
    console.log("❌ Scanner error:", err.message);
    switchProvider();
  }
}

/* ================= WITHDRAW ================= */
app.post("/withdraw", async (req, res) => {
  try {
    const { walletAddress, toAddress, amount } = req.body;

    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: "Invalid ETH address" });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // 🔒 deduct first
    user.balances.sxp_eth -= amount;
    await user.save();

    console.log("🚀 Sending withdraw →", toAddress);

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

/* ================= BRIDGE ================= */
app.post("/bridge/solar", async (req, res) => {
  try {
    const { walletAddress, solarAddress, amount } = req.body;

    if (!solarAddress || !solarAddress.startsWith("S")) {
      return res.status(400).json({ error: "Invalid Solar address" });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    user.balances.sxp_eth -= amount;
    user.balances.sxp_solar += amount;

    await user.save();

    await Tx.create({
      walletAddress,
      amount,
      txHash: "PENDING_SOLAR_" + Date.now(),
      type: "bridge",
      chain: "SOLAR"
    });

    console.log("🌉 Bridge queued →", solarAddress, amount);

    res.json({
      success: true,
      message: "Bridge queued (awaiting Solar payout)"
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
