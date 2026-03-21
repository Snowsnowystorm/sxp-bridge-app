import express from "express";
import pkg from "pg";
import { Wallet } from "ethers";

const { Pool } = pkg;

const app = express();
app.use(express.json());

/* =========================
   DATABASE CONNECTION
========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.send("SXP BACKEND LIVE 💎");
});

/* =========================
   DB TEST
========================= */
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ connected: true, time: result.rows[0] });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

/* =========================
   REGISTER USER
========================= */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query(
      "INSERT INTO users(email, password) VALUES($1, $2) RETURNING *",
      [email, password]
    );

    res.json({ success: true, user: user.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* =========================
   CREATE REAL WALLET
========================= */
app.post("/create-wallet", async (req, res) => {
  const { user_id, chain } = req.body;

  try {
    const wallet = Wallet.createRandom();

    const result = await pool.query(
      "INSERT INTO wallets(user_id, chain, address, private_key) VALUES($1,$2,$3,$4) RETURNING *",
      [user_id, chain, wallet.address, wallet.privateKey]
    );

    res.json({
      success: true,
      wallet: result.rows[0],
      mnemonic: wallet.mnemonic.phrase // show once only later
    });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* =========================
   ADD BALANCE
========================= */
app.post("/add-balance", async (req, res) => {
  const { user_id, token, amount } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO balances(user_id, token, amount) VALUES($1,$2,$3) RETURNING *",
      [user_id, token, amount]
    );

    res.json({ success: true, balance: result.rows[0] });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

/* =========================
   GET BALANCE
========================= */
app.get("/balance/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM balances WHERE user_id=$1",
      [user_id]
    );

    res.json({ balances: result.rows });
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
