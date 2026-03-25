import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pkg from "pg";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ethers } from "ethers";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

/* ENV */
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/* DB */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* PROVIDERS */
const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

/* ERC20 ABI */
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

/* CONTRACTS */
const sxpEthContract = new ethers.Contract(
  process.env.SXP_ETH_CONTRACT,
  ERC20_ABI,
  ethProvider
);

const sxpBnbContract = new ethers.Contract(
  process.env.SXP_BNB_CONTRACT,
  ERC20_ABI,
  bscProvider
);

/* ENCRYPTION */
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/* HEALTH */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API running" });
});

/* REGISTER */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const ethWallet = ethers.Wallet.createRandom();
    const bnbWallet = ethers.Wallet.createRandom();

    const result = await pool.query(
      `INSERT INTO users 
      (email, password, eth_address, bnb_address, eth_private_key, bnb_private_key)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id, email, eth_address, bnb_address`,
      [
        email,
        hashed,
        ethWallet.address,
        bnbWallet.address,
        encrypt(ethWallet.privateKey),
        encrypt(bnbWallet.privateKey)
      ]
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
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

/* AUTH */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

/* USER DATA */
app.get("/api/user/wallets", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT eth_address, bnb_address FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

app.get("/api/user/balance", verifyToken, async (req, res) => {
  const result = await pool.query(
    "SELECT balance FROM users WHERE id=$1",
    [req.user.id]
  );
  res.json(result.rows[0]);
});

/* ========================= */
/* 💰 SXP DEPOSIT ENGINE */
/* ========================= */

async function processTransfer(network, to, amount, txHash) {
  try {
    const user = await pool.query(
      `SELECT id FROM users 
       WHERE LOWER(eth_address)=LOWER($1) 
       OR LOWER(bnb_address)=LOWER($1)`,
      [to]
    );

    if (!user.rows.length) return;

    const userId = user.rows[0].id;

    /* PREVENT DOUBLE CREDIT */
    const exists = await pool.query(
      "SELECT id FROM transactions WHERE tx_hash=$1",
      [txHash]
    );

    if (exists.rows.length) return;

    const value = Number(ethers.formatUnits(amount, 18));

    /* CREDIT */
    await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id=$2",
      [value, userId]
    );

    /* SAVE TX */
    await pool.query(
      "INSERT INTO transactions (user_id, tx_hash, amount, network) VALUES ($1,$2,$3,$4)",
      [userId, txHash, value, network]
    );

    console.log(`💰 ${network} deposit: ${value} SXP → user ${userId}`);
  } catch (err) {
    console.error("Deposit error:", err);
  }
}

/* REAL-TIME LISTENERS */
function startListeners() {
  console.log("🚀 Listening for SXP deposits...");

  sxpEthContract.on("Transfer", (from, to, value, event) => {
    processTransfer("ETH", to, value, event.log.transactionHash);
  });

  sxpBnbContract.on("Transfer", (from, to, value, event) => {
    processTransfer("BNB", to, value, event.log.transactionHash);
  });
}

/* POLLING FALLBACK */
async function pollDeposits() {
  try {
    const latest = await ethProvider.getBlockNumber();

    const logs = await ethProvider.getLogs({
      address: process.env.SXP_ETH_CONTRACT,
      fromBlock: latest - 20,
      toBlock: latest
    });

    for (const log of logs) {
      const parsed = sxpEthContract.interface.parseLog(log);

      await processTransfer(
        "ETH",
        parsed.args.to,
        parsed.args.value,
        log.transactionHash
      );
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

setInterval(pollDeposits, 60000);

/* START */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startListeners();
});
