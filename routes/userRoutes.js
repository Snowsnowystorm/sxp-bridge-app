import express from "express";
import { generateWallet } from "../services/walletService.js";
import { createUser } from "../models/User.js";

const router = express.Router();

export default function (db) {
  router.post("/create", async (req, res) => {
    const wallet = generateWallet();

    const user = await createUser(db, wallet.address);

    res.json({
      user,
      wallet
    });
  });

  return router;
}
