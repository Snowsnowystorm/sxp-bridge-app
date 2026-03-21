const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   SAFE DATABASE CONNECTION
========================= */

let pool;

try {
  const { Pool } = require("pg");

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log("✅ Database connected");

} catch (err) {
  console.log("❌ Database error:", err.message);
}

/* =========================
   ROUTES
========================= */

// Health check
app.get("/", (req, res) => {
  res.send("SXP BACKEND LIVE 💎");
});

// DB test
app.get("/db-test", async (req, res) => {
  try {
    if (!pool) {
      return res.json({ connected: false, error: "DB not initialized" });
    }

    const result = await pool.query("SELECT NOW()");
    res.json({ connected: true, time: result.rows[0] });

  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

/* =========================
   WALLET CREATION
========================= */

let ethers;

try {
  ethers = require("ethers");
} catch (err) {
  console.log("⚠️ Ethers not installed yet");
}

app.post("/create-wallet", async (req, res) => {
  try {
    if (!ethers) {
      return res.json({ error: "Ethers not installed" });
    }

    const { email } = req.body;

    const wallet = ethers.Wallet.createRandom();

    if (pool) {
      await pool.query(
        "INSERT INTO users (email, wallet_address, private_key) VALUES ($1, $2, $3)",
        [email, wallet.address, wallet.privateKey]
      );
    }

    res.json({
      success: true,
      address: wallet.address
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port:", PORT);
});
