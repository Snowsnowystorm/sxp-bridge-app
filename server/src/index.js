import express from "express";
import cors from "cors";

// import routes
import bridgeRoute from "./routes/bridge.js";

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SXP Bridge API running"
  });
});

// bridge route
app.use("/api/bridge", bridgeRoute);

// start server (Railway needs this)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
