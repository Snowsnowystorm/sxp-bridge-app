import { Router } from "express";

const router = Router();

// POST /api/bridge
router.post("/", (req, res) => {
  const { amount, fromChain, toChain } = req.body;

  // validation (fixes 422 issue)
  if (!amount || !fromChain || !toChain) {
    return res.status(422).json({
      error: "Missing required fields",
      required: ["amount", "fromChain", "toChain"]
    });
  }

  // placeholder logic (your real bridge goes here later)
  res.json({
    status: "success",
    message: "Bridge request received",
    data: {
      amount,
      fromChain,
      toChain
    }
  });
});

export default router;
