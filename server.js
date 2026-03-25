import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API running" });
});

/* ROOT */
app.get("/", (req, res) => {
  res.send("SXP Bridge API is running");
});

/* LOGIN */
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@test.com" && password === "123456") {
    const token = jwt.sign(
      { email, role: "admin" },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      success: true,
      token
    });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

/* MIDDLEWARE */
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

/* ADMIN ROUTE */
app.get("/api/admin", verifyToken, (req, res) => {
  res.json({
    message: "Welcome Admin 🔐",
    user: req.user
  });
});

/* START */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
