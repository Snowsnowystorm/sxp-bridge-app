import { Wallet } from "ethers";

// =============================
// 🔐 CREATE WALLET
// =============================
export function createWallet() {
  const wallet = Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase
  };
}
