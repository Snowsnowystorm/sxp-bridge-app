import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ethers } from "ethers";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔐 In-memory DB (replace with real DB later)
const users = [];

// 🔗 Alchemy Provider
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC);

// =========================
// AUTH SYSTEM
// =========================

// REGISTER
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  users.push({
    email,
    password: hashed
  });

  res.json({ message: "User registered" });
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);

  if (!user) return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign({ email }, process.env.JWT_SECRET);

  res.json({ token });
});

// =========================
// WALLET / BLOCKCHAIN
// =========================

// GET BALANCE (REAL)
app.get("/api/balance/:address", async (req, res) => {
  try {
    const balance = await provider.getBalance(req.params.address);
    res.json({
      balance: ethers.formatEther(balance)
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// =========================
// HEALTH CHECK
// =========================

app.get("/", (req, res) => {
  res.send("SXP Backend Running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
