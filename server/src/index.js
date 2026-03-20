import express from "express";
import cors from "cors";

const app = express();

// =============================
// 🔧 MIDDLEWARE
// =============================
app.use(cors());
app.use(express.json());

// =============================
// 🏠 ROOT ROUTE
// =============================
app.get("/", (req, res) => {
  res.send("SXP Bridge Running ✅");
});

// =============================
// ❤️ HEALTH CHECK
// =============================
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// =============================
// 🔁 BRIDGE ENDPOINT
// =============================
app.post("/api/bridge", async (req, res) => {
  try {
    const { fromChain, toChain, amount, address } = req.body;

    // ✅ VALIDATION
    if (!fromChain || !toChain || !amount || !address) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        required: ["fromChain", "toChain", "amount", "address"]
      });
    }

    // 🔮 SIMULATED TRANSACTION (SAFE FOR NOW)
    const tx = {
      id: "tx_" + Date.now(),
      fromChain,
      toChain,
      amount,
      address,
      status: "processing",
      createdAt: new Date().toISOString()
    };

    console.log("🚀 Bridge Request:", tx);

    // ✅ RESPONSE
    res.json({
      success: true,
      message: "Bridge initiated successfully",
      transaction: tx
    });

  } catch (error) {
    console.error("❌ Bridge Error:", error);

    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// =============================
// 🚀 START SERVER
// =============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
