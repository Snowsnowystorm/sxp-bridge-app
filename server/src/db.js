let users = [];

// =============================
// 👤 CREATE USER
// =============================
export function createUser() {
  const id = "user_" + Date.now();

  const user = {
    id,
    wallets: [],
    createdAt: new Date().toISOString()
  };

  users.push(user);

  return user;
}

// =============================
// 🔍 GET USER
// =============================
export function getUser(userId) {
  return users.find(u => u.id === userId);
}

// =============================
// 💾 ADD WALLET TO USER
// =============================
export function addWalletToUser(userId, wallet) {
  const user = getUser(userId);

  if (!user) return null;

  user.wallets.push(wallet);

  return user;
}
