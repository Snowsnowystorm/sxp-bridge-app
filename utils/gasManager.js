import { ethers } from "ethers";

export async function sendWithGas({
  provider,
  to,
  amount,
  userPrivateKey
}) {
  try {
    /* ===============================
       GAS WALLET
    =============================== */
    const gasWallet = new ethers.Wallet(
      process.env.GAS_WALLET_PRIVATE_KEY,
      provider
    );

    const userWallet = new ethers.Wallet(
      userPrivateKey,
      provider
    );

    /* ===============================
       ESTIMATE GAS
    =============================== */
    const estimatedGas = await provider.estimateGas({
      to,
      value: ethers.parseEther(amount.toString())
    });

    const gasPrice = await provider.getFeeData();

    const gasCost =
      estimatedGas * gasPrice.gasPrice;

    /* ===============================
       CHECK USER BALANCE
    =============================== */
    const balance = await provider.getBalance(
      userWallet.address
    );

    /* ===============================
       SEND GAS IF NEEDED
    =============================== */
    if (balance < gasCost) {
      console.log("⛽ Sending gas to user wallet...");

      const gasTx = await gasWallet.sendTransaction({
        to: userWallet.address,
        value: gasCost
      });

      await gasTx.wait();
    }

    /* ===============================
       SEND MAIN TRANSACTION
    =============================== */
    const tx = await userWallet.sendTransaction({
      to,
      value: ethers.parseEther(amount.toString())
    });

    return tx;
  } catch (err) {
    console.error("Gas system error:", err);
    throw err;
  }
}
