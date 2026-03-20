import fs from "fs";

// ✅ SAFE FILE PATH (Railway compatible)
const DB_FILE = new URL("./database.json", import.meta.url);

// =============================
// 📖 READ DATABASE
// =============================
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    const initial = { users: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
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
export function createUser(email, passwordHash) {
  const db = readDB();

  const user = {
    id: "user_" + Date.now(),
    email,
    password: passwordHash,
    role: "user",
    plan: "free",
    wallets: [],
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  writeDB(db);

  return user;
}

// =============================
// 🔍 GET USER BY EMAIL
// =============================
export function getUserByEmail(email) {
  const db = readDB();
  return db.users.find(u => u.email === email);
}

// =============================
// 🔍 GET USER BY ID
// =============================
export function getUser(id) {
  const db = readDB();
  return db.users.find(u => u.id === id);
}

// =============================
// 👑 ENSURE ADMIN EXISTS
// =============================
export function ensureAdmin() {
  const db = readDB();

  let admin = db.users.find(u => u.role === "admin");

  if (!admin) {
    admin = {
      id: "admin_1",
      email: "admin@sxp.com",
      password: "",
      role: "admin",
      plan: "lifetime",
      wallets: [],
      createdAt: new Date().toISOString()
    };

    db.users.push(admin);
    writeDB(db);
  }

  return admin;
}
