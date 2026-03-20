import fs from "fs";

const DB_FILE = "./server/src/database.json";

// =============================
// 📖 READ DATABASE
// =============================
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }

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
      password: "", // set later
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
