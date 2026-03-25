export const createUser = async (db, walletAddress) => {
  const user = {
    walletAddress,
    createdAt: new Date(),
    balances: {
      sxp_eth: 0,
      sxp_bnb: 0,
      sxp_solar: 0
    }
  };

  await db.collection("users").insertOne(user);
  return user;
};

export const findUserByWallet = async (db, walletAddress) => {
  return await db.collection("users").findOne({ walletAddress });
};
