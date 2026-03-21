// ==============================
// 💎 MATCHING ENGINE (REAL)
// ==============================

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// fee (you make money here 💰)
const FEE_RATE = 0.002; // 0.2%

// ==============================
// MATCH ORDERS
// ==============================
async function matchOrders(io) {
  try {
    // highest buy first
    const buyOrders = await pool.query(
      `SELECT * FROM orders 
       WHERE type='buy' AND status='open' 
       ORDER BY price DESC`
    );

    // lowest sell first
    const sellOrders = await pool.query(
      `SELECT * FROM orders 
       WHERE type='sell' AND status='open' 
       ORDER BY price ASC`
    );

    for (let buy of buyOrders.rows) {
      for (let sell of sellOrders.rows) {

        if (buy.price >= sell.price && buy.remaining > 0 && sell.remaining > 0) {

          const tradeAmount = Math.min(buy.remaining, sell.remaining);
          const tradePrice = sell.price;

          // 💰 FEES
          const fee = tradeAmount * FEE_RATE;

          // ==============================
          // UPDATE BALANCES
          // ==============================

          // buyer receives SXP
          await pool.query(
            `UPDATE balances 
             SET sxp = sxp + $1 
             WHERE user_id=$2`,
            [tradeAmount - fee, buy.user_id]
          );

          // seller receives quote (simulate for now or extend)
          await pool.query(
            `UPDATE balances 
             SET sxp = sxp - $1 
             WHERE user_id=$2`,
            [tradeAmount, sell.user_id]
          );

          // ==============================
          // UPDATE ORDER REMAINING
          // ==============================
          await pool.query(
            `UPDATE orders 
             SET remaining = remaining - $1 
             WHERE id=$2`,
            [tradeAmount, buy.id]
          );

          await pool.query(
            `UPDATE orders 
             SET remaining = remaining - $1 
             WHERE id=$2`,
            [tradeAmount, sell.id]
          );

          // close orders if done
          await pool.query(
            `UPDATE orders SET status='filled' 
             WHERE id=$1 AND remaining <= 0`,
            [buy.id]
          );

          await pool.query(
            `UPDATE orders SET status='filled' 
             WHERE id=$1 AND remaining <= 0`,
            [sell.id]
          );

          // ==============================
          // SAVE TRADE
          // ==============================
          const trade = await pool.query(
            `INSERT INTO trades 
            (buyer_id, seller_id, price, amount, fee)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *`,
            [
              buy.user_id,
              sell.user_id,
              tradePrice,
              tradeAmount,
              fee,
            ]
          );

          // ==============================
          // 🔥 REAL-TIME EMIT
          // ==============================
          io.emit("trade_update", trade.rows[0]);
          io.emit("orderbook_update");
        }
      }
    }

  } catch (err) {
    console.log("MATCH ERROR:", err);
  }
}

// ==============================
// RUN LOOP
// ==============================
function startMatchingEngine(io) {
  setInterval(() => {
    matchOrders(io);
  }, 2000); // every 2 sec
}

module.exports = { startMatchingEngine };
