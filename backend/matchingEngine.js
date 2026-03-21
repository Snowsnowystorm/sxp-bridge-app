import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const FEE_RATE = 0.002; // 0.2%

export const startMatchingEngine = (io) => {
  console.log("💎 PRO MATCHING ENGINE STARTED");

  setInterval(async () => {
    try {
      // ==========================
      // GET BEST ORDERS
      // ==========================
      const buyRes = await pool.query(`
        SELECT * FROM orders 
        WHERE type='buy' AND status='open'
        ORDER BY price DESC, created_at ASC LIMIT 1
      `);

      const sellRes = await pool.query(`
        SELECT * FROM orders 
        WHERE type='sell' AND status='open'
        ORDER BY price ASC, created_at ASC LIMIT 1
      `);

      if (!buyRes.rows.length || !sellRes.rows.length) return;

      const buy = buyRes.rows[0];
      const sell = sellRes.rows[0];

      if (parseFloat(buy.price) < parseFloat(sell.price)) return;

      // ==========================
      // PARTIAL FILL LOGIC
      // ==========================
      const tradeAmount = Math.min(
        parseFloat(buy.remaining),
        parseFloat(sell.remaining)
      );

      const tradePrice = sell.price; // market execution
      const fee = tradeAmount * FEE_RATE;

      console.log("⚡ TRADE:", tradeAmount, "@", tradePrice);

      // ==========================
      // UPDATE REMAINING
      // ==========================
      const newBuyRemaining = buy.remaining - tradeAmount;
      const newSellRemaining = sell.remaining - tradeAmount;

      await pool.query(
        `UPDATE orders SET remaining=$1, status=$2 WHERE id=$3`,
        [
          newBuyRemaining,
          newBuyRemaining <= 0 ? "filled" : "partial",
          buy.id,
        ]
      );

      await pool.query(
        `UPDATE orders SET remaining=$1, status=$2 WHERE id=$3`,
        [
          newSellRemaining,
          newSellRemaining <= 0 ? "filled" : "partial",
          sell.id,
        ]
      );

      // ==========================
      // BALANCE TRANSFERS
      // ==========================

      // BUYER RECEIVES SXP
      await pool.query(
        `UPDATE balances 
         SET sxp = sxp + $1, locked = locked - $1 
         WHERE user_id = $2`,
        [tradeAmount - fee, buy.user_id]
      );

      // SELLER RECEIVES VALUE (simulate quote asset for now)
      await pool.query(
        `UPDATE balances 
         SET sxp = sxp - $1 
         WHERE user_id = $2`,
        [tradeAmount, sell.user_id]
      );

      // ==========================
      // SAVE TRADE
      // ==========================
      await pool.query(
        `INSERT INTO trades 
         (buy_order_id, sell_order_id, price, amount, fee)
         VALUES ($1, $2, $3, $4, $5)`,
        [buy.id, sell.id, tradePrice, tradeAmount, fee]
      );

      // ==========================
      // SOCKET EVENTS
      // ==========================
      io.emit("trade", {
        price: tradePrice,
        amount: tradeAmount,
      });

      io.emit("order_update");

    } catch (err) {
      console.error("ENGINE ERROR:", err);
    }
  }, 1000);
};
