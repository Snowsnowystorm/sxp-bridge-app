import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* ✅ HEALTH CHECK */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API running" });
});

/* ✅ TEST ROUTE */
app.get("/", (req, res) => {
  res.send("SXP Bridge API is running");
});

/* ✅ LOGIN (TEMP TEST) */
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@test.com" && password === "123456") {
    return res.json({
      success: true,
      token: "test-jwt-token"
    });
  }

  res.status(401).json({ error: "Invalid credentials" });
});

/* START SERVER */
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
