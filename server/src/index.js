import express from "express";
import cors from "cors";

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Root test
app.get("/", (req, res) => {
  res.send("SXP Bridge Running ✅");
});

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// ✅ BRIDGE ROUTE (NEW)
app.post("/api/bridge", async (req, res) => {
  try {
    const { fromChain, toChain, amount, address } = req.body;

    if (!fromChain || !toChain || !amount || !address) {
      return res.status(400).json({
        error: "Missing required fields"
      });
    }

    // 🔮 Simulated bridge logic (safe for now)
    const tx = {
      id: Date.now(),
      fromChain,
      toChain,
      amount,
      address,
      status: "processing"
    };

    console.log("Bridge request:", tx);

    res.json({
      success: true,
      message: "Bridge initiated",
      tx
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bridge failed" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
