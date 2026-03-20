import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret_key";

// 🔐 Generate token
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      plan: user.plan
    },
    SECRET,
    { expiresIn: "7d" }
  );
}

// 🔍 Verify token
export function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// 👑 Admin middleware
export function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}
