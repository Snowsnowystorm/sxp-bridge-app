import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ========================= */
/* 🔍 STARTUP LOGGING */
/* ========================= */
console.log("🚀 Booting SXP Bridge Backend...");
console.log("ENV CHECK:");
console.log("PORT:", PORT);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);

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
  console.error("❌ DB INIT ERROR:", err.message);
}

/* ========================= */
/* ❤️ HEALTH */
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
    res.status(500).json({
      status: "error",
      db: "failed",
      message: err.message
    });
  }
});

/* ========================= */
/* 🧪 ROOT */
/* ========================= */
app.get("/", (req, res) => {
  res.send("SXP Bridge API is running (SAFE MODE)");
});

/* ========================= */
/* 🚀 START SERVER */
/* ========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});

/* ========================= */
/* ❗ GLOBAL ERROR HANDLER */
/* ========================= */
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 UNHANDLED PROMISE:", err);
});
