import { useEffect, useState } from "react";
import TradingChart from "./components/TradingChart";

export default function App() {
  const [orderbook, setOrderbook] = useState({ buys: [], sells: [] });
  const [trades, setTrades] = useState([]);

  // =========================
  // LOAD DATA
  // =========================
  useEffect(() => {
    fetch("/api/orderbook")
      .then(res => res.json())
      .then(setOrderbook);

    fetch("/api/trades")
      .then(res => res.json())
      .then(setTrades);
  }, []);

  return (
    <div className="container">

      <h1 className="glow">💎 Snow Doll Exchange</h1>

      <div className="grid">

        {/* LEFT SIDE */}
        <div>

          {/* CHART */}
          <div className="card">
            <TradingChart />
          </div>

          {/* ORDER BOOK */}
          <div className="card">
            <h2 className="glow">Order Book</h2>

            <div className="orderbook">
              {orderbook.buys.map((o, i) => (
                <div key={i} className="buy">
                  BUY {o.amount} @ {o.price}
                </div>
              ))}

              {orderbook.sells.map((o, i) => (
                <div key={i} className="sell">
                  SELL {o.amount} @ {o.price}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT SIDE */}
        <div>

          {/* LIVE TRADES */}
          <div className="card">
            <h2 className="glow">Live Trades</h2>

            {trades.map((t, i) => (
              <div key={i} className="trade">
                <span>{t.amount}</span>
                <span>{t.price || "-"}</span>
              </div>
            ))}
          </div>

          {/* TRADE PANEL */}
          <div className="card">
            <h2 className="glow">Trade</h2>

            <input placeholder="Amount" style={{ width: "100%", marginBottom: 10 }} />
            <input placeholder="Price" style={{ width: "100%", marginBottom: 10 }} />

            <button style={{ width: "100%", marginBottom: 10 }}>
              BUY
            </button>

            <button style={{ width: "100%", background: "#ff4d6d" }}>
              SELL
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
