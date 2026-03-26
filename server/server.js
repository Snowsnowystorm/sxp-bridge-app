import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// ===============================
// 🔥 CONFIG
// ===============================
const PORT = process.env.PORT || 8000;

const SXP_CONTRACT = "0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9";

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

// ===============================
// 🔥 RPC FAILOVER
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
// 🗄 DATABASE
// ===============================
const client = new MongoClient(process.env.DATABASE_URL);
let db;

async function connectDB() {
  await client.connect();
  db = client.db("sxp_bridge");
  console.log("✅ DB connected");
}

// ===============================
// 👤 CREATE USER
// ===============================
app.post("/api/users/create", async (req, res) => {
  try {
    const wallet = ethers.Wallet.createRandom();

    const user = {
      walletAddress: wallet.address.toLowerCase(),
      mnemonic: wallet.mnemonic.phrase,
      privateKey: wallet.privateKey,
      balances: {
        sxp_eth: 0,
        sxp_bnb: 0,
        sxp_solar: 0
      },
      createdAt: new Date()
    };

    await db.collection("users").insertOne(user);

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: "User creation failed" });
  }
});

// ===============================
// 💰 CREDIT USER
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
// 🔥 ERC20 SCANNER (FINAL)
// ===============================
function startScanner() {
  console.log("🔌 Starting ERC20 scanner (SXP mode)...");

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
// 💸 WITHDRAW SYSTEM
// ===============================
app.post("/api/withdraw", async (req, res) => {
  try {
    const { walletAddress, toAddress, amount } = req.body;

    const user = await db.collection("users").findOne({
      walletAddress: walletAddress.toLowerCase()
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.balances.sxp_eth < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
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

    console.log("🚀 Withdraw TX:", tx.hash);

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
// 💓 HEARTBEAT
// ===============================
setInterval(() => {
  console.log("💓 Heartbeat alive...");
}, 15000);

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend Running ✅");
});

// ===============================
// START SERVER
// ===============================
async function start() {
  await connectDB();

  console.log("🚀 Starting system...");
  startScanner();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
}

start();
