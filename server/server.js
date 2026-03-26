import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ===============================
// CONFIG
// ===============================
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET;

const SXP_CONTRACT = "0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9";

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

// ===============================
// RATE LIMIT (BASIC)
// ===============================
const withdrawCooldown = new Map();

function checkRateLimit(wallet) {
  const now = Date.now();
  const last = withdrawCooldown.get(wallet);

  if (last && now - last < 30000) {
    return false;
  }

  withdrawCooldown.set(wallet, now);
  return true;
}

// ===============================
// RPC
// ===============================
const provider = new ethers.JsonRpcProvider(
  "https://rpc.flashbots.net"
);

// ===============================
// DB
// ===============================
const client = new MongoClient(process.env.DATABASE_URL);
let db;

async function connectDB() {
  await client.connect();
  db = client.db("sxp_bridge");
  console.log("✅ DB connected");
}

// ===============================
// AUTH MIDDLEWARE
// ===============================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// ===============================
// REGISTER USER
// ===============================
app.post("/api/register", async (req, res) => {
  const { password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const wallet = ethers.Wallet.createRandom();

  const user = {
    walletAddress: wallet.address.toLowerCase(),
    privateKey: wallet.privateKey,
    password: hash,
    balances: {
      sxp_eth: 0
    },
    createdAt: new Date()
  };

  await db.collection("users").insertOne(user);

  res.json({
    walletAddress: user.walletAddress
  });
});

// ===============================
// LOGIN
// ===============================
app.post("/api/login", async (req, res) => {
  const { walletAddress, password } = req.body;

  const user = await db.collection("users").findOne({
    walletAddress: walletAddress.toLowerCase()
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(403).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    { walletAddress: user.walletAddress },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// ===============================
// SECURE WITHDRAW
// ===============================
app.post("/api/withdraw", auth, async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const walletAddress = req.user.walletAddress;

    // 🔒 Rate limit
    if (!checkRateLimit(walletAddress)) {
      return res.status(429).json({
        error: "Too many requests"
      });
    }

    const user = await db.collection("users").findOne({
      walletAddress
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({
        error: "Insufficient balance"
      });
    }

    // 🔒 Wallet validation
    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json({
        error: "Invalid address"
      });
    }

    // 🔥 SEND TX
    const wallet = new ethers.Wallet(user.privateKey, provider);

    const contract = new ethers.Contract(
      SXP_CONTRACT,
      ERC20_ABI,
      wallet
    );

    const tx = await contract.transfer(
      toAddress,
      ethers.parseUnits(amount.toString(), 18)
    );

    console.log("🚀 Withdraw:", tx.hash);

    await tx.wait();

    // 🔒 Deduct balance
    await db.collection("users").updateOne(
      { walletAddress },
      { $inc: { "balances.sxp_eth": -amount } }
    );

    // Save TX
    await db.collection("transactions").insertOne({
      walletAddress,
      toAddress,
      amount,
      txHash: tx.hash,
      type: "withdraw",
      createdAt: new Date()
    });

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Withdraw failed"
    });
  }
});

// ===============================
// HEALTH
// ===============================
app.get("/", (req, res) => {
  res.send("Secure SXP Backend Running 🔐");
});

// ===============================
// START
// ===============================
async function start() {
  await connectDB();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
}

start();
