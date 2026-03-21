const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ROOT TEST
app.get("/", (req, res) => {
  res.json({ message: "SXP Bridge Backend Running 💎" });
});

// USERS (TEST DATA)
let users = [
  { email: "admin@sxp.com" }
];

app.get("/users", (req, res) => {
  res.json(users);
});

// START SERVER
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
