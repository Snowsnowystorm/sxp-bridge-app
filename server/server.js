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
// 🔥 DATABASE
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
    console.error(err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// ===============================
// 💰 CREDIT USER
// ===============================
async function creditUser(walletAddress, amount, txHash, tokenAddress) {
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
    tokenAddress,
    type: "deposit",
    createdAt: new Date()
  });

  console.log("💰 CREDITED:", walletAddress, amount);
}

// ===============================
// 🔥 GLOBAL ERC20 LISTENER (CHUNKED)
// ===============================
function startListener() {
  console.log("🔌 Using GLOBAL ERC20 scanner (chunked)...");

  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL,
    {
      name: "mainnet",
      chainId: 1
    }
  );

  let lastBlock = 0;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock === 0) {
        lastBlock = currentBlock - 500; // 🔥 safe startup window
        return;
      }

      console.log(`🔎 Scanning blocks: ${lastBlock} → ${currentBlock}`);

      const STEP = 100; // 🔥 chunk size

      let from = lastBlock;

      while (from < currentBlock) {
        const to = Math.min(from + STEP, currentBlock);

        console.log(`📦 Chunk scan: ${from} → ${to}`);

        const logs = await provider.getLogs({
          fromBlock: from,
          toBlock: to,
          topics: [
            ethers.id("Transfer(address,address,uint256)")
          ]
        });

        for (const log of logs) {
          try {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ["address", "address", "uint256"],
              log.data
            );

            const toAddress = decoded[1].toLowerCase();

            const user = await db.collection("users").findOne({
              walletAddress: toAddress
            });

            if (!user) continue;

            const amount = ethers.formatUnits(decoded[2], 18);

            console.log("🔥 TOKEN DEPOSIT DETECTED:", {
              token: log.address,
              to: toAddress,
              amount,
              txHash: log.transactionHash
            });

            await creditUser(
              toAddress,
              amount,
              log.transactionHash,
              log.address
            );

          } catch {
            continue;
          }
        }

        from = to + 1;
      }

      lastBlock = currentBlock;

    } catch (err) {
      console.error("❌ Polling error:", err.message);
    }
  }, 20000);
}

// ===============================
// 🌐 ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend Running ✅");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===============================
// 🚀 START SERVER
// ===============================
async function startServer() {
  await connectDB();

  const userCount = await db.collection("users").countDocuments();

  if (userCount === 0) {
    console.log("⚠️ No wallets yet — skipping listener");
  } else {
    startListener();
  }

  const PORT = process.env.PORT || 8000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
