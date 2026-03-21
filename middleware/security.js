import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";

/* ===============================
   RATE LIMIT
=============================== */

export const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many requests. Please slow down."
});

/* ===============================
   STRICT LIMIT (LOGIN / WITHDRAW)
=============================== */

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many sensitive requests."
});

/* ===============================
   HELMET
=============================== */

export const securityHeaders = helmet();

/* ===============================
   CORS (LOCK TO YOUR FRONTEND)
=============================== */

export const corsConfig = cors({
  origin: [
    "https://sxp-bridge-app.vercel.app"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
});
