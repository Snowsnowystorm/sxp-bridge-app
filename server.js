import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();

/* ========================= */
/* 🔧 CORE MIDDLEWARE */
/* ========================= */
app.use(cors());
app.use(express.json());

/* ✅ CRITICAL: PREVENT HANGING REQUESTS */
app.use((req, res, next) => {
  res.setTimeout(8000, () => {
    console.log("⏰ Request timed out");
    res.status(408).send("Request Timeout");
  });
  next();
});

/* ========================= */
/* 🔐 ENV */
/* ========================= */
const PORT = process.env.PORT || 3000;

/* ========================= */
/* 🧠 DATABASE */
/* ========================= */
let pool;

try {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("✅ DB pool created");

} catch (err) {
  console.error("❌ DB ERROR:", err.message);
}

/* ========================= */
/* 🧪 ROOT ROUTE (IMPORTANT) */
/* ========================= */
app.get("/", (req, res) => {
  res.status(200).send("SXP Bridge API LIVE");
});

/* ========================= */
/* ❤️ HEALTH ROUTE */
/* ========================= */
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      db: "connected",
      time: result.rows[0]
    });
  } catch (err) {
    console.error("DB ERROR:", err.message);

    res.status(500).json({
      status: "error",
      db: "failed",
      message: err.message
    });
  }
});

/* ========================= */
/* 🚀 START SERVER */
/* ========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

/* ========================= */
/* ❗ GLOBAL ERROR HANDLERS */
/* ========================= */
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED PROMISE:", err);
});
