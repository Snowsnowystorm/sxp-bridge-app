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
// 🔥 MULTI RPC PROVIDER
// ===============================
function createProvider() {
  const urls = [
    "https://rpc.flashbots.net",
    "https://ethereum.publicnode.com",
    "https://cloudflare-eth.com"
  ];

  let current = 0;

  function getProvider() {
    return new ethers.JsonRpcProvider(urls[current]);
  }

  function switchProvider() {
    current = (current + 1) % urls.length;
    console.log("🔄 Switching RPC →", urls[current]);
  }

  return { getProvider, switchProvider };
}

// ===============================
// 🔥 ERC20 LISTENER (SXP ONLY)
// ===============================
function startListener() {
  console.log("🔌 Starting ERC20 scanner (SXP mode)...");

  const rpcManager = createProvider();
  let provider = rpcManager.getProvider();

  let lastBlock = 0;

  const SXP_CONTRACT = "0x8ce9137d39326ad0cd22f6e7b27f55f6c7c72b45";

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock === 0) {
        lastBlock = currentBlock - 200;
        console.log("⚡ Initializing scanner from block:", lastBlock);
      }

      console.log(`🔎 Scanning blocks: ${lastBlock} → ${currentBlock}`);

      const STEP = 20;
      let from = lastBlock;

      while (from < currentBlock) {

        await new Promise(r => setTimeout(r, 200)); // prevent overload

        const to = Math.min(from + STEP, currentBlock);

        console.log(`📦 Chunk: ${from} → ${to}`);

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
            try {
              // ✅ Correct ERC20 parsing
              const fromAddr = "0x" + log.topics[1].slice(26);
              const toAddr = "0x" + log.topics[2].slice(26);

              const toAddress = toAddr.toLowerCase();

              const user = await db.collection("users").findOne({
                walletAddress: toAddress
              });

              if (!user) continue;

              const amount = ethers.formatUnits(log.data, 18);

              console.log("🔥 SXP DEPOSIT DETECTED:", {
                from: fromAddr,
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

        } catch (err) {
          if (err.message.includes("429")) {
            console.log("🚫 Rate limited → switching RPC");
          } else {
            console.log("⚠️ RPC chunk failed → switching provider");
          }

          rpcManager.switchProvider();
          provider = rpcManager.getProvider();
          break;
        }

        from = to + 1;
      }

      lastBlock = currentBlock;

    } catch (err) {
      if (err.message.includes("429")) {
        console.log("🚫 Polling rate limited → switching RPC");
        rpcManager.switchProvider();
        provider = rpcManager.getProvider();
      } else {
        console.error("❌ Polling error:", err.message);
      }
    }
  }, 20000);
}

// ===============================
// 💓 KEEP ALIVE (RAILWAY SAFE)
// ===============================
setInterval(() => {
  console.log("💓 Heartbeat alive...");
}, 15000);

// ===============================
// 🌐 ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend Running ✅");
});

app.get("/health", (req, res) => {
  res.json({ status: "alive" });
});

// ===============================
// 🚀 START SERVER
// ===============================
async function startServer() {
  await connectDB();

  console.log("🚀 Starting listener...");
  startListener();

  const PORT = process.env.PORT || 8000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
