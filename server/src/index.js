import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 🔗 PROVIDERS (REAL BLOCKCHAIN)
const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_RPC);

// 🪙 ERC20 ABI (MINIMAL)
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

// HEALTH
app.get("/", (req, res) => {
  res.send("SXP Bridge Backend LIVE 💎");
});

// ✅ GET WALLET BALANCE (REAL)
app.post("/balance", async (req, res) => {
  try {
    const { address, chain, tokenAddress } = req.body;

    const provider = chain === "ETH" ? ethProvider : bscProvider;

    const contract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      provider
    );

    const balance = await contract.balanceOf(address);

    res.json({
      balance: ethers.formatUnits(balance, 18)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔄 BRIDGE REQUEST (REAL STRUCTURE)
app.post("/bridge", async (req, res) => {
  try {
    const { fromChain, toChain, amount, address } = req.body;

    // 🚧 Placeholder for smart contract interaction
    // This is where you'd trigger actual bridge contract

    res.json({
      status: "pending",
      message: "Bridge request submitted",
      details: { fromChain, toChain, amount, address }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Production server running on port " + PORT);
});
