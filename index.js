const express = require("express");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health route
app.get("/", (req, res) => {
  res.send("SXP BACKEND LIVE 💎");
});

// Debug route
app.get("/ping", (req, res) => {
  res.json({ pong: true });
});

// 🚨 REQUIRED FOR RAILWAY
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port:", PORT);
});
