import { ethers } from "ethers";
import dotenv from "dotenv";
import { creditUser } from "./creditService.js";

dotenv.config();

export function startDepositListener(db) {
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
    const amount = ethers.formatUnits(value, 18);

    // 🔥 CHECK IF ADDRESS BELONGS TO USER
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
      db,
      to,
      amount,
      event.log.transactionHash
    );
  });

  provider._websocket.on("close", () => {
    console.log("⚠️ WebSocket closed. Restarting...");
    process.exit(1);
  });
}
