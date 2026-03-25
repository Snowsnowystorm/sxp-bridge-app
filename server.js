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

/* ========================= */
/* 🔐 ENV */
/* ========================= */
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/* ========================= */
/* 🧠 DATABASE */
/* ========================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ========================= */
/* 🌐 BLOCKCHAIN PROVIDERS */
/* ========================= */
const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
const bscProvider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

/* ========================= */
/* 📜 ABI */
/* ========================= */
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint amount) returns (bool)"
];

/* ========================= */
/* 🪙 CONTRACTS */
/* ========================= */
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

/* ========================= */
/* 🔒 ENCRYPTION */
/* ========================= */
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

function decrypt(text) {
  const parts = text.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const encryptedText = Buffer.from(parts.join(":"), "hex");

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

/* ========================= */
/* ❤️ HEALTH */
/* ========================= */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API running" });
});

/* ========================= */
/* 🔐 AUTH */
/* ========================= */
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
    res.status(500).json({ error: "Login failed" });
  }
});

/* ========================= */
/* 🔑 AUTH MIDDLEWARE */
/* ========================= */
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

/* ========================= */
/* 👤 USER */
/* ========================= */
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
/* 💰 DEPOSIT ENGINE */
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

    const exists = await pool.query(
      "SELECT id FROM transactions WHERE tx_hash=$1",
      [txHash]
    );

    if (exists.rows.length) return;

    const value = Number(ethers.formatUnits(amount, 18));

    await pool.query(
      "UPDATE users SET balance = balance + $1 WHERE id=$2",
      [value, userId]
    );

    await pool.query(
      "INSERT INTO transactions (user_id, tx_hash, amount, network, type, status) VALUES ($1,$2,$3,$4,'deposit','completed')",
      [userId, txHash, value, network]
    );

    console.log(`💰 Deposit: ${value} SXP → user ${userId}`);
  } catch (err) {
    console.error("Deposit error:", err);
  }
}

/* LISTENERS */
function startListeners() {
  console.log("🚀 Listening for SXP deposits...");

  sxpEthContract.on("Transfer", (from, to, value, event) => {
    processTransfer("ETH", to, value, event.log.transactionHash);
  });

  sxpBnbContract.on("Transfer", (from, to, value, event) => {
    processTransfer("BNB", to, value, event.log.transactionHash);
  });
}

/* ========================= */
/* 💸 WITHDRAW */
/* ========================= */
app.post("/api/user/withdraw", verifyToken, async (req, res) => {
  try {
    const { amount, toAddress, network } = req.body;

    const userRes = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [req.user.id]
    );

    const user = userRes.rows[0];

    if (Number(user.balance) < Number(amount)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    let provider, contractAddress, privateKey;

    if (network === "ETH") {
      provider = ethProvider;
      contractAddress = process.env.SXP_ETH_CONTRACT;
      privateKey = decrypt(user.eth_private_key);
    } else {
      provider = bscProvider;
      contractAddress = process.env.SXP_BNB_CONTRACT;
      privateKey = decrypt(user.bnb_private_key);
    }

    const wallet = new ethers.Wallet(privateKey, provider);

    const contract = new ethers.Contract(
      contractAddress,
      ERC20_TRANSFER_ABI,
      wallet
    );

    const tx = await contract.transfer(
      toAddress,
      ethers.parseUnits(amount.toString(), 18)
    );

    await tx.wait();

    await pool.query(
      "UPDATE users SET balance = balance - $1 WHERE id=$2",
      [amount, user.id]
    );

    await pool.query(
      "INSERT INTO transactions (user_id, tx_hash, amount, network, type, status) VALUES ($1,$2,$3,$4,'withdrawal','completed')",
      [user.id, tx.hash, amount, network]
    );

    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Withdrawal failed" });
  }
});

/* ========================= */
/* 🚀 START */
/* ========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startListeners();
});
