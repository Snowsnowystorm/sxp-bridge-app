import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import http from "http";
import { Server } from "socket.io";

/* YOUR FILES */
import { txQueue } from "./queues/txQueue.js";
import { startWorker } from "./workers/txWorker.js";
import { getHotWallet } from "./utils/hotWallet.js";
import { listenETHDeposits, listenBNBDeposits } from "./blockchain.js";

dotenv.config();

const app = express();
const { Pool } = pkg;

/* SERVER + SOCKET */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

/* DB */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* PROVIDER */
const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

/* MIDDLEWARE */
app.use(express.json());

/* AUTH */
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

/* =========================
   SAVE TX + EMIT LIVE
========================= */
async function saveTx(tx) {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, to_address, tx_hash, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      tx.user_id,
      tx.type,
      tx.amount,
      tx.to_address || "",
      tx.hash || "",
      tx.status
    ]
  );

  const saved = result.rows[0];

  /* 🔥 LIVE PUSH */
  io.emit("new_tx", saved);
}

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("Backend LIVE 💎");
});

/* REGISTER */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await pool.query(
    "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING *",
    [email, hashed]
  );

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* LOGIN */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!user.rows.length)
    return res.status(400).json({ error: "User not found" });

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid)
    return res.status(400).json({ error: "Invalid password" });

  const token = jwt.sign(
    { id: user.rows[0].id },
    process.env.JWT_SECRET
  );

  res.json({ token });
});

/* WALLET CREATE */
app.post("/wallet/create", auth, async (req, res) => {
  const wallet = ethers.Wallet.createRandom();

  const saved = await pool.query(
    `INSERT INTO wallets (user_id, chain, address, private_key)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [
      req.user.id,
      "SXP-ETH",
      wallet.address,
      wallet.privateKey
    ]
  );

  res.json({
    wallet: saved.rows[0],
    mnemonic: wallet.mnemonic.phrase
  });
});

/* WITHDRAW */
app.post("/withdraw", auth, async (req, res) => {
  const { amount, to } = req.body;

  const txRecord = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, to_address)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [req.user.id, "withdraw", amount, to]
  );

  await txQueue.add("withdraw", {
    to,
    amount,
    txId: txRecord.rows[0].id
  });

  res.json({ success: true });
});

/* GET TX */
app.get("/transactions", auth, async (req, res) => {
  const txs = await pool.query(
    "SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC",
    [req.user.id]
  );

  res.json(txs.rows);
});

/* =========================
   START SYSTEMS
========================= */

/* WORKER */
startWorker();

/* BLOCKCHAIN LISTENERS */
listenETHDeposits(saveTx);
listenBNBDeposits(saveTx);

/* SOCKET */
io.on("connection", socket => {
  console.log("User connected");
});

/* START */
server.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server LIVE");
});
