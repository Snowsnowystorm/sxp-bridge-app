import { ethers } from "ethers";
import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function sweepToCold(provider) {
  try {
    const wallets = await pool.query("SELECT * FROM wallets");

    for (const w of wallets.rows) {
      const balance = await provider.getBalance(w.address);

      if (balance > ethers.parseEther("0.001")) {
        const wallet = new ethers.Wallet(
          w.private_key,
          provider
        );

        console.log(`Sweeping ${w.address}`);

        const tx = await wallet.sendTransaction({
          to: process.env.COLD_WALLET_ADDRESS,
          value: balance - ethers.parseEther("0.0005")
        });

        await tx.wait();
      }
    }
  } catch (err) {
    console.error("Sweep error:", err);
  }
}
