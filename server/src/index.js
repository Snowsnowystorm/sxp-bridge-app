import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";

// 🔐 AUTH
import { generateToken, verifyToken, requireAdmin } from "./auth.js";

// 💾 DB
import {
  createUser,
  getUserByEmail,
  getUser,
  ensureAdmin
} from "./db.js";

const app = express();

// =============================
// ⚙️ MIDDLEWARE
// =============================
app.use(cors());
app.use(express.json());

// =============================
// 👑 INIT ADMIN
// =============================
ensureAdmin();

// =============================
// ❤️ HEALTH CHECK (VERY IMPORTANT)
// =============================
app.get("/api/health", (req, res) => {
  res.send("SXP Bridge Running ✅");
});

// =============================
// 🔐 AUTH ROUTES
// =============================

// SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = createUser(email, hash);

    const token = generateToken(user);

    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.password) {
      return res.status(403).json({
        error: "Admin must set password manually"
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = generateToken(user);

    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// =============================
// 🔒 PROTECTED ROUTE
// =============================
app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    message: "Authenticated ✅",
    user: req.user
  });
});

// =============================
// 👑 ADMIN ROUTE
// =============================
app.get("/api/admin", verifyToken, requireAdmin, (req, res) => {
  res.json({
    message: "Admin access granted 👑",
    user: req.user
  });
});

// =============================
// 💼 USER PROFILE
// =============================
app.get("/api/user/:id", verifyToken, (req, res) => {
  const user = getUser(req.params.id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// =============================
// 💰 MONETISATION CHECK
// =============================
function hasAccess(user) {
  return user.role === "admin" || user.plan === "lifetime";
}

// Example premium route
app.get("/api/premium", verifyToken, (req, res) => {
  if (!hasAccess(req.user)) {
    return res.status(403).json({
      error: "Upgrade required 💎"
    });
  }

  res.json({
    message: "Premium feature unlocked 🚀"
  });
});

// =============================
// 🚀 SERVER START
// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
