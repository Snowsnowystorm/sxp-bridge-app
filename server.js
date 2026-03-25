import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || "*"
}));

// ===============================
// 🔥 DATABASE CONNECTION
// ===============================
const client = new MongoClient(process.env.DATABASE_URL);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("sxp_bridge");
    console.log("✅ DB connected");
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
}

// ===============================
// 👤 CREATE USER + WALLET
// ===============================
app.post("/api/users/create", async (req, res) => {
  try {
    const wallet = ethers.Wallet.createRandom();

    const user = {
      walletAddress: wallet.address,
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

    res.json({
      success: true,
      wallet: user.walletAddress,
      mnemonic: user.mnemonic,
      privateKey: user.privateKey
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "User creation failed" });
  }
});

// ===============================
// 📊 GET USER (FOR TESTING)
// ===============================
app.get("/api/users/:wallet", async (req, res) => {
  try {
    const user = await db.collection("users").findOne({
      walletAddress: req.params.wallet
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ===============================
// 💰 CREDIT USER FUNCTION
// ===============================
async function creditUser(walletAddress, amount, txHash) {
  try {
    const existing = await db.collection("transactions").findOne({ txHash });
    if (existing) return;

    const user = await db.collection("users").findOne({ walletAddress });
    if (!user) {
      console.log("⚠️ Unknown wallet:", walletAddress);
      return;
    }

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

  } catch (err) {
    console.error("Credit error:", err);
  }
}

// ===============================
// 🔥 SXP DEPOSIT LISTENER (FIXED)
// ===============================
function startDepositListener() {
  try {
    const provider = new ethers.WebSocketProvider(process.env.ALCHEMY_WS);

    const abi = [
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ];

    const contract = new ethers.Contract(
      process.env.SXP_ETH_CONTRACT,
      abi,
      provider
    );

    console.log("🚀 Listening for SXP deposits...");

    contract.on("Transfer", async (from, to, value, event) => {
      try {
        const amount = ethers.formatUnits(value, 18);

        const user = await db.collection("users").findOne({
          walletAddress: to
        });

        if (!user) return;

        console.log("🔥 DEPOSIT DETECTED", {
          from,
          to,
          amount,
          txHash: event.log.transactionHash
        });

        await creditUser(
          to,
          amount,
          event.log.transactionHash
        );

      } catch (err) {
        console.error("Listener error:", err);
      }
    });

    // ✅ SAFE EVENT HANDLING (NO CRASH)
    provider.on("error", (err) => {
      console.error("⚠️ Provider error:", err);
    });

  } catch (err) {
    console.error("❌ Listener failed to start:", err);
  }
}

// ===============================
// 🌐 HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend Running ✅");
});

// ===============================
// 🚀 START SERVER
// ===============================
async function startServer() {
  await connectDB();

  startDepositListener();

  app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
  });
}

startServer();
