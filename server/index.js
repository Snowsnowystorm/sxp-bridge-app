import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from "pg";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================= DATABASE =================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ================= BLOCKCHAIN =================
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC);

// ================= INIT DATABASE =================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database ready");
  } catch (err) {
    console.error("❌ DB Error:", err);
  }
}

// ================= AUTH MIDDLEWARE =================
function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ================= ROUTES =================

// HEALTH CHECK
app.get("/", (req, res) => {
  res.send("SXP Backend + DB Running 🚀");
});

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, hashed]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "User already exists" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign(
      {
        email: user.email,
        isAdmin: user.is_admin
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// MAKE ADMIN (SECURE)
app.post("/api/make-admin", async (req, res) => {
  try {
    const { email } = req.body;

    if (email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await pool.query(
      "UPDATE users SET is_admin = true WHERE email = $1",
      [email]
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// ADMIN PANEL
app.get("/api/admin", verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Not admin" });
    }

    const users = await pool.query(
      "SELECT id, email, created_at FROM users ORDER BY id DESC"
    );

    res.json(users.rows);
  } catch {
    res.status(500).json({ error: "Admin failed" });
  }
});

// WALLET BALANCE (REAL BLOCKCHAIN)
app.get("/api/balance/:address", async (req, res) => {
  try {
    const address = req.params.address;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const balance = await provider.getBalance(address);

    res.json({
      balance: ethers.formatEther(balance)
    });
  } catch (err) {
    res.status(500).json({ error: "Balance failed" });
  }
});

// ================= START SERVER =================
async function startServer() {
  await initDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();
