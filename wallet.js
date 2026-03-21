import { ethers } from "ethers";

const mnemonic = process.env.MASTER_SEED;

/* ===============================
   DERIVE WALLET
=============================== */

export function deriveWallet(index) {
  const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);

  return hdNode.derivePath(`m/44'/60'/0'/0/${index}`);
}
