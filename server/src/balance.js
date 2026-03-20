import { JsonRpcProvider } from "ethers";
import { CHAINS } from "./chains.js";

// =============================
// 💰 GET WALLET BALANCE
// =============================
export async function getBalance(address, chain) {
  try {
    const chainData = CHAINS[chain];

    if (!chainData) {
      throw new Error("Invalid chain");
    }

    const provider = new JsonRpcProvider(chainData.rpc);

    const balance = await provider.getBalance(address);

    return {
      chain,
      balance: balance.toString()
    };

  } catch (error) {
    throw error;
  }
}
