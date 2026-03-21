const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.send("SXP Backend + DB Running 🚀");
  } catch (err) {
    res.send("Server running but DB failed");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
