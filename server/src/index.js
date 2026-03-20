import express from "express";
import bridge from "./routes/bridge.js";

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.use("/api/bridge", bridge);

app.listen(5000, () => console.log("Server running"));
