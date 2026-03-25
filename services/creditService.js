export async function creditUser(db, walletAddress, amount, txHash) {
  const user = await db.collection("users").findOne({ walletAddress });

  if (!user) {
    console.log("⚠️ Unknown user wallet:", walletAddress);
    return;
  }

  // prevent duplicate credit
  const existingTx = await db.collection("transactions").findOne({ txHash });
  if (existingTx) return;

  await db.collection("users").updateOne(
    { walletAddress },
    { $inc: { "balances.sxp_eth": parseFloat(amount) } }
  );

  await db.collection("transactions").insertOne({
    walletAddress,
    amount,
    txHash,
    type: "deposit",
    createdAt: new Date()
  });

  console.log("💰 CREDITED:", walletAddress, amount);
}
