import crypto from "crypto";

const ALGO = "aes-256-cbc";
const SECRET = process.env.WALLET_SECRET || "supersecretkey123";

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGO,
    crypto.createHash("sha256").update(SECRET).digest(),
    iv
  );

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

export const decrypt = (text) => {
  const [ivHex, encryptedHex] = text.split(":");

  const decipher = crypto.createDecipheriv(
    ALGO,
    crypto.createHash("sha256").update(SECRET).digest(),
    Buffer.from(ivHex, "hex")
  );

  let decrypted = decipher.update(Buffer.from(encryptedHex, "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
};
