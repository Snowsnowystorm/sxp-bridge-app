import { Router } from "express";

const router = Router();

router.post("/", (req, res) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(422).json({
      error: "Amount required"
    });
  }

  // future: blockchain logic here

  res.json({
    status: "success",
    message: "Bridge request received",
    amount
  });
});

export default router;
