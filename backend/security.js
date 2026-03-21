import CryptoJS from "crypto-js";

const SECRET = process.env.WALLET_SECRET;

// 🔐 ENCRYPT
export const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, SECRET).toString();
};

// 🔐 DECRYPT
export const decrypt = (cipher) => {
  const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
};
