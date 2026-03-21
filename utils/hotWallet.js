import { ethers } from "ethers";

/* ===============================
   GET HOT WALLET (MAIN WITHDRAW WALLET)
=============================== */
export function getHotWallet(provider) {
  if (!process.env.HOT_WALLET_PRIVATE_KEY) {
    throw new Error("HOT_WALLET_PRIVATE_KEY missing");
  }

  return new ethers.Wallet(
    process.env.HOT_WALLET_PRIVATE_KEY,
    provider
  );
}

/* ===============================
   GET HOT WALLET BALANCE
=============================== */
export async function getHotWalletBalance(provider) {
  const wallet = getHotWallet(provider);
  const balance = await provider.getBalance(wallet.address);

  return {
    address: wallet.address,
    balance: ethers.formatEther(balance)
  };
}
