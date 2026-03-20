import fs from "fs";

const DB_FILE = "./server/src/database.json";

// =============================
// 📖 READ DATABASE
// =============================
function readDB() {
  const data = fs.readFileSync(DB_FILE);
  return JSON.parse(data);
}

// =============================
// 💾 WRITE DATABASE
// =============================
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// =============================
// 👤 CREATE USER
// =============================
export function createUser() {
  const db = readDB();

  const user = {
    id: "user_" + Date.now(),
    wallets: [],
    createdAt: new Date().toISOString()
  };

  db.users.push(user);

  writeDB(db);

  return user;
}

// =============================
// 🔍 GET USER
// =============================
export function getUser(userId) {
  const db = readDB();
  return db.users.find(u => u.id === userId);
}

// =============================
// 💼 ADD WALLET
// =============================
export function addWalletToUser(userId, wallet) {
  const db = readDB();

  const user = db.users.find(u => u.id === userId);

  if (!user) return null;

  user.wallets.push(wallet);

  writeDB(db);

  return user;
}
