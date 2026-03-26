import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// 🔥 SXP CONTRACT
const SXP_CONTRACT = "0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9";

// ERC20 ABI (minimal)
const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

// 🔥 MAIN PROVIDER
const provider = new ethers.JsonRpcProvider(
  "https://rpc.flashbots.net"
);

// 🔥 GAS WALLET (VERY IMPORTANT)
const GAS_WALLET = new ethers.Wallet(
  process.env.GAS_PRIVATE_KEY,
  provider
);

// ===============================
// 💸 SEND SXP
// ===============================
export async function sendSXP(privateKey, to, amount) {
  try {
    // user wallet
    const wallet = new ethers.Wallet(privateKey, provider);

    const contract = new ethers.Contract(
      SXP_CONTRACT,
      ERC20_ABI,
      wallet
    );

    const tx = await contract.transfer(
      to,
      ethers.parseUnits(amount.toString(), 18)
    );

    console.log("🚀 TX SENT:", tx.hash);

    await tx.wait();

    console.log("✅ TX CONFIRMED");

    return tx.hash;

  } catch (err) {
    console.error("❌ Withdraw error:", err.message);
    throw err;
  }
}
