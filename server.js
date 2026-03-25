import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pkg from "pg";
import bcrypt from "bcrypt";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

/* ENV */
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

/* DB */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API running" });
});

/* ROOT */
app.get("/", (req, res) => {
  res.send("SXP Bridge API is running");
});

/* REGISTER */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* LOGIN */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      success: true,
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* AUTH MIDDLEWARE */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(403).json({ error: "No token" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/* ADMIN ONLY */
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

/* GET USERS */
app.get("/api/admin/users", verifyToken, requireAdmin, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, balance, status FROM users"
  );
  res.json(result.rows);
});

/* FREEZE USER */
app.post("/api/admin/freeze", verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.body;

  await pool.query(
    "UPDATE users SET status = 'frozen' WHERE id = $1",
    [userId]
  );

  res.json({ success: true });
});

/* UNFREEZE USER */
app.post("/api/admin/unfreeze", verifyToken, requireAdmin, async (req, res) => {
  const { userId } = req.body;

  await pool.query(
    "UPDATE users SET status = 'active' WHERE id = $1",
    [userId]
  );

  res.json({ success: true });
});

/* USER PROFILE */
app.get("/api/user/profile", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT id, email, balance, status FROM users WHERE id = $1",
    [req.user.id]
  );

  res.json(result.rows[0]);
});

/* START */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
