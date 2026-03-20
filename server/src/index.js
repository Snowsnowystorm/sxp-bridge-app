import express from "express";

const app = express();

app.use(express.json());

// SIMPLE TEST ROUTE
app.get("/", (req, res) => {
  res.send("SXP Bridge Running ✅");
});

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
