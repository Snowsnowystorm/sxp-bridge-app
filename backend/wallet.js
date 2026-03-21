import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

// 🔐 HOT WALLET (PRIVATE KEY IN ENV)
const wallet = new ethers.Wallet(
  process.env.HOT_WALLET_PRIVATE_KEY,
  provider
);

// ERC20 ABI
const ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

// TOKEN CONTRACT
const contract = new ethers.Contract(
  process.env.SXP_CONTRACT,
  ABI,
  wallet
);

// ==============================
// SEND TOKEN
// ==============================
export const sendToken = async (to, amount) => {
  try {
    const tx = await contract.transfer(
      to,
      ethers.parseUnits(amount.toString(), 18)
    );

    console.log("🚀 TX SENT:", tx.hash);

    return tx.hash;
  } catch (err) {
    console.error("Send error:", err);
    throw err;
  }
};
