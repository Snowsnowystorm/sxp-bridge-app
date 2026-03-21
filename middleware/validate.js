import validator from "validator";

/* ===============================
   EMAIL VALIDATION
=============================== */

export function validateEmail(req, res, next) {
  const { email } = req.body;

  if (!validator.isEmail(email || "")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  next();
}

/* ===============================
   PASSWORD VALIDATION
=============================== */

export function validatePassword(req, res, next) {
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Weak password" });
  }

  next();
}

/* ===============================
   ADDRESS VALIDATION
=============================== */

export function validateAddress(req, res, next) {
  const { to } = req.body;

  if (!to || !validator.isEthereumAddress(to)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  next();
}
