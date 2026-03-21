import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import TradingChart from "./components/TradingChart";

const socket = io("https://sxp-bridge-app-production.up.railway.app");

export default function App() {
  const [orderbook, setOrderbook] = useState({ buys: [], sells: [] });
  const [trades, setTrades] = useState([]);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  // =========================
  // LOAD + SOCKET
  // =========================
  useEffect(() => {
    // initial load
    fetch("/api/orderbook")
      .then(res => res.json())
      .then(setOrderbook);

    fetch("/api/trades")
      .then(res => res.json())
      .then(setTrades);

    // live updates
    socket.on("orderbook_update", async () => {
      const res = await fetch("/api/orderbook");
      const data = await res.json();
      setOrderbook(data);
    });

    socket.on("trade_update", (trade) => {
      setTrades(prev => [trade, ...prev.slice(0, 50)]);
    });

    socket.on("tx_update", () => {
      console.log("TX update received");
    });

    return () => {
      socket.off("orderbook_update");
      socket.off("trade_update");
      socket.off("tx_update");
    };
  }, []);

  // =========================
  // PLACE ORDER
  // =========================
  const placeOrder = async (type) => {
    await fetch("/api/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: "YOUR_USER_ID",
        type,
        price,
        amount,
      }),
    });
  };

  return (
    <div className="container">

      <h1 className="glow">💎 Snow Doll Exchange</h1>

      <div className="grid">

        {/* LEFT */}
        <div>

          <div className="card">
            <TradingChart />
          </div>

          <div className="card">
            <h2>Order Book</h2>

            <div className="orderbook">

              <h4 className="buy">BUY</h4>
              {orderbook.buys.map((o, i) => (
                <div key={i} className="buy">
                  {o.amount} @ {o.price}
                </div>
              ))}

              <h4 className="sell">SELL</h4>
              {orderbook.sells.map((o, i) => (
                <div key={i} className="sell">
                  {o.amount} @ {o.price}
                </div>
              ))}

            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div>

          <div className="card">
            <h2>Live Trades</h2>

            {trades.map((t, i) => (
              <div key={i} className="trade">
                <span>{t.amount}</span>
                <span>{t.price || "-"}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Trade</h2>

            <input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <input
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <button onClick={() => placeOrder("buy")}>
              BUY
            </button>

            <button
              onClick={() => placeOrder("sell")}
              style={{ background: "#ff4d6d" }}
            >
              SELL
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
