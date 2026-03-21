import { ethers } from "ethers";

export function getHotWallet(provider) {
  return new ethers.Wallet(
    process.env.HOT_WALLET_PRIVATE_KEY,
    provider
  );
}
