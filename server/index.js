import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from "pg";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ================= BLOCKCHAIN =================
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC);

// ================= INIT DATABASE (FIXED) =================
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        is_admin BOOLEAN DEFAULT false
      );
    `);
    console.log("DB ready");
  } catch (err) {
    console.error("DB error:", err);
  }
}

// ================= START SERVER AFTER DB =================
async function startServer() {
  await initDB();

  // ================= ROUTES =================

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      const hashed = await bcrypt.hash(password, 10);

      await pool.query(
        "INSERT INTO users (email, password) VALUES ($1, $2)",
        [email, hashed]
      );

      res.json({ message: "User registered" });
    } catch {
      res.status(400).json({ error: "User exists" });
    }
  });

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
        { email: user.email, isAdmin: user.is_admin },
        process.env.JWT_SECRET
      );

      res.json({ token });
    } catch {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/make-admin", async (req, res) => {
    const { email } = req.body;

    if (email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await pool.query(
      "UPDATE users SET is_admin=true WHERE email=$1",
      [email]
    );

    res.json({ message: "Admin granted" });
  });

  app.get("/api/admin", async (req, res) => {
    try {
      const token = req.headers.authorization;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded.isAdmin) {
        return res.status(403).json({ error: "Not admin" });
      }

      const users = await pool.query("SELECT email FROM users");

      res.json({ users: users.rows });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.get("/api/balance/:address", async (req, res) => {
    try {
      const balance = await provider.getBalance(req.params.address);
      res.json({ balance: ethers.formatEther(balance) });
    } catch {
      res.status(500).json({ error: "Balance failed" });
    }
  });

  app.get("/", (req, res) => {
    res.send("SXP Backend + DB Running 🚀");
  });

  // ================= START =================
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
}

// 🚀 START EVERYTHING
startServer();
