import pkg from "pg";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==============================
// MATCH ENGINE LOOP
// ==============================
export const startMatchingEngine = (io) => {
  console.log("⚡ Matching engine started...");

  setInterval(async () => {
    try {
      // ==========================
      // GET TOP BUY
      // ==========================
      const buyRes = await pool.query(
        "SELECT * FROM orders WHERE type='buy' AND status='open' ORDER BY price DESC LIMIT 1"
      );

      const sellRes = await pool.query(
        "SELECT * FROM orders WHERE type='sell' AND status='open' ORDER BY price ASC LIMIT 1"
      );

      if (buyRes.rows.length === 0 || sellRes.rows.length === 0) return;

      const buy = buyRes.rows[0];
      const sell = sellRes.rows[0];

      // ==========================
      // CHECK MATCH
      // ==========================
      if (parseFloat(buy.price) < parseFloat(sell.price)) return;

      const tradeAmount = Math.min(
        parseFloat(buy.amount),
        parseFloat(sell.amount)
      );

      console.log("💎 MATCH FOUND:", tradeAmount);

      // ==========================
      // UPDATE BALANCES
      // ==========================
      await pool.query(
        `UPDATE balances SET sxp = sxp + $1 WHERE user_id = $2`,
        [tradeAmount, buy.user_id]
      );

      await pool.query(
        `UPDATE balances SET sxp = sxp - $1 WHERE user_id = $2`,
        [tradeAmount, sell.user_id]
      );

      // ==========================
      // UPDATE ORDERS
      // ==========================
      await pool.query(
        "UPDATE orders SET status='filled' WHERE id=$1",
        [buy.id]
      );

      await pool.query(
        "UPDATE orders SET status='filled' WHERE id=$1",
        [sell.id]
      );

      // ==========================
      // SAVE TRADE
      // ==========================
      await pool.query(
        `INSERT INTO transactions (type, amount, status)
         VALUES ('trade', $1, 'completed')`,
        [tradeAmount]
      );

      io.emit("order_update");
      io.emit("tx_update", {
        type: "trade",
        amount: tradeAmount,
        status: "completed",
      });

    } catch (err) {
      console.error("Match engine error:", err);
    }
  }, 2000);
};
