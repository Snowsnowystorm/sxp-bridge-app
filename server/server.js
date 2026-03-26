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
// RPC FAILOVER
// ===============================
const RPCS = [
  "https://rpc.flashbots.net",
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com"
];

let rpcIndex = 0;

function getProvider() {
  return new ethers.JsonRpcProvider(RPCS[rpcIndex]);
}

function switchRPC() {
  rpcIndex = (rpcIndex + 1) % RPCS.length;
  console.log("🔄 Switching RPC →", RPCS[rpcIndex]);
}

let provider = getProvider();

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
// AUTH
// ===============================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

// ===============================
// RATE LIMIT
// ===============================
const withdrawCooldown = new Map();

function checkRateLimit(wallet) {
  const now = Date.now();
  const last = withdrawCooldown.get(wallet);

  if (last && now - last < 30000) return false;

  withdrawCooldown.set(wallet, now);
  return true;
}

// ===============================
// REGISTER
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

  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) return res.status(403).json({ error: "Wrong password" });

  const token = jwt.sign(
    { walletAddress: user.walletAddress },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// ===============================
// CREDIT USER (DEPOSIT)
// ===============================
async function creditUser(walletAddress, amount, txHash) {
  const exists = await db.collection("transactions").findOne({ txHash });
  if (exists) return;

  await db.collection("users").updateOne(
    { walletAddress },
    { $inc: { "balances.sxp_eth": parseFloat(amount) } }
  );

  await db.collection("transactions").insertOne({
    walletAddress,
    amount,
    txHash,
    type: "deposit",
    createdAt: new Date()
  });

  console.log("💰 CREDITED:", walletAddress, amount);
}

// ===============================
// ERC20 SCANNER
// ===============================
function startScanner() {
  console.log("🔌 Starting ERC20 scanner...");

  let lastBlock = 0;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock === 0) {
        lastBlock = currentBlock - 200;
      }

      console.log(`🔎 Scanning: ${lastBlock} → ${currentBlock}`);

      const STEP = 20;
      let from = lastBlock;

      while (from < currentBlock) {
        const to = Math.min(from + STEP, currentBlock);

        try {
          const logs = await provider.getLogs({
            address: SXP_CONTRACT,
            fromBlock: from,
            toBlock: to,
            topics: [
              ethers.id("Transfer(address,address,uint256)")
            ]
          });

          for (const log of logs) {
            const toAddr = "0x" + log.topics[2].slice(26);
            const toAddress = toAddr.toLowerCase();

            const user = await db.collection("users").findOne({
              walletAddress: toAddress
            });

            if (!user) continue;

            const amount = ethers.formatUnits(log.data, 18);

            console.log("🔥 DEPOSIT:", amount);

            await creditUser(
              toAddress,
              amount,
              log.transactionHash
            );
          }

        } catch (err) {
          console.log("⚠️ RPC fail → switching");
          switchRPC();
          provider = getProvider();
          break;
        }

        from = to + 1;
      }

      lastBlock = currentBlock;

    } catch (err) {
      console.log("❌ Poll error → switching RPC");
      switchRPC();
      provider = getProvider();
    }
  }, 15000);
}

// ===============================
// WITHDRAW (SECURE)
// ===============================
app.post("/api/withdraw", auth, async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    const walletAddress = req.user.walletAddress;

    if (!checkRateLimit(walletAddress)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const user = await db.collection("users").findOne({ walletAddress });

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json({ error: "Invalid address" });
    }

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

    await db.collection("users").updateOne(
      { walletAddress },
      { $inc: { "balances.sxp_eth": -amount } }
    );

    await db.collection("transactions").insertOne({
      walletAddress,
      toAddress,
      amount,
      txHash: tx.hash,
      type: "withdraw",
      createdAt: new Date()
    });

    res.json({ success: true, txHash: tx.hash });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Withdraw failed" });
  }
});

// ===============================
// HEARTBEAT
// ===============================
setInterval(() => {
  console.log("💓 Heartbeat alive...");
}, 15000);

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Secure Backend Running 🔥");
});

// ===============================
// START SERVER
// ===============================
async function start() {
  await connectDB();

  console.log("🚀 Starting full system...");
  startScanner();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
}

start();
