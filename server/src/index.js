const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 8080;
const SECRET = "sxp-secret-key";

app.use(cors({ origin: "*" }));
app.use(express.json());

// 🧠 MOCK DATABASE
let users = [
  {
    email: "admin@sxp.com",
    password: bcrypt.hashSync("admin123", 8),
    role: "admin"
  }
];

// ROOT
app.get("/", (req, res) => {
  res.send("SXP Backend LIVE 💎");
});

// REGISTER
app.post("/register", (req, res) => {
  const { email, password } = req.body;
  const hashed = bcrypt.hashSync(password, 8);

  users.push({ email, password: hashed, role: "user" });

  res.json({ message: "User registered" });
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign(
    { email: user.email, role: user.role },
    SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token, role: user.role });
});

// AUTH MIDDLEWARE
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ error: "No token" });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = decoded;
    next();
  });
}

// USER DASHBOARD
app.get("/dashboard", verifyToken, (req, res) => {
  res.json({ message: "User dashboard", user: req.user });
});

// ADMIN PANEL
app.get("/admin", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Not admin" });
  }

  res.json({
    message: "Admin panel",
    users
  });
});

// START SERVER
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port " + PORT);
});
