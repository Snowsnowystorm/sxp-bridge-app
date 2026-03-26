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
    token: "SXP",
    createdAt: new Date()
  });

  console.log("💰 CREDITED:", walletAddress, amount);
}

// ===============================
// 🔥 SXP LISTENER (ANKR STABLE)
// ===============================
function startListener() {
  console.log("🔌 Using ANKR RPC (stable mode)...");

  const provider = new ethers.JsonRpcProvider(
    process.env.ALCHEMY_HTTP // now using ANKR URL
  );

  const abi = [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];

  const contract = new ethers.Contract(
    process.env.SXP_ETH_CONTRACT,
    abi,
    provider
  );

  let lastBlock = 0;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();

      if (lastBlock === 0) {
        lastBlock = currentBlock - 2;
        return;
      }

      console.log(`🔎 Scanning blocks: ${lastBlock} → ${currentBlock}`);

      const events = await contract.queryFilter(
        "Transfer",
        lastBlock,
        currentBlock
      );

      for (const event of events) {
        const { from, to, value } = event.args;
        const txHash = event.transactionHash;

        const toAddress = to.toLowerCase();

        const user = await db.collection("users").findOne({
          walletAddress: toAddress
        });

        if (!user) continue;

        const amount = ethers.formatUnits(value, 18);

        console.log("🔥 SXP DEPOSIT DETECTED:", {
          from,
          to,
          amount,
          txHash
        });

        await creditUser(toAddress, amount, txHash);
      }

      lastBlock = currentBlock;

    } catch (err) {
      console.error("❌ Polling error:", err.message);
    }
  }, 20000); // 🔥 20 seconds (safe)
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
