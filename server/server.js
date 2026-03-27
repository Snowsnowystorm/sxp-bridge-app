import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(express.json());

console.log("🔥 HARD-STABLE SERVER START");

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("✅ DB connected"))
  .catch((err) => console.log("❌ DB error:", err.message));

/* ================= USER MODEL ================= */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    walletAddress: String
  })
);

/* ================= STATIC PROVIDER (NO DETECTION) ================= */

/*
⚠️ CRITICAL:
We bypass ALL network detection here
*/

const provider = new ethers.StaticJsonRpcProvider(
  "https://eth.llamarpc.com",
  {
    name: "mainnet",
    chainId: 1
  }
);

console.log("🌐 STATIC RPC SET");

/* ================= WALLET ================= */
let wallet = null;

try {
  const PRIVATE_KEY = (process.env.PRIVATE_KEY || "").trim();

  if (PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66) {
    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log("🔥 Hot Wallet:", wallet.address);
  } else {
    console.log("⚠️ Invalid PRIVATE_KEY");
  }
} catch (err) {
  console.log("❌ Wallet error:", err.message);
}

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.send("API LIVE ✅");
});

/* ================= DEBUG BALANCE ================= */
app.get("/debug-balance", async (req, res) => {
  try {
    const balance = await provider.getBalance(wallet.address);

    res.json({
      address: wallet.address,
      balanceETH: ethers.formatEther(balance)
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= CREATE USER ================= */
app.post("/create-user", async (req, res) => {
  const { walletAddress } = req.body;

  let user = await User.findOne({ walletAddress });

  if (!user) {
    user = await User.create({ walletAddress });
  }

  res.json({ success: true, user });
});

/* ================= WITHDRAW ================= */
app.post("/withdraw", async (req, res) => {
  console.log("🔥 WITHDRAW HIT", req.body);

  try {
    const { walletAddress, toAddress, amount } = req.body;

    const user = await User.findOne({ walletAddress });

    if (!user) {
      return res.json({ success: false, error: "User not found" });
    }

    const balance = await provider.getBalance(wallet.address);

    console.log("💰 BALANCE:", ethers.formatEther(balance));

    if (balance < ethers.parseEther(amount.toString())) {
      return res.json({
        success: false,
        error: "Insufficient REAL wallet balance"
      });
    }

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000
    });

    console.log("🚀 TX:", tx.hash);

    res.json({
      success: true,
      txHash: tx.hash
    });

  } catch (err) {
    console.log("❌ ERROR:", err);

    res.json({
      success: false,
      error: err.message
    });
  }
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
