import React, { useEffect, useState } from "react";
import axios from "axios";

export default function OrderBook() {
  const [book, setBook] = useState({ buys: [], sells: [] });

  useEffect(() => {
    const load = async () => {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/orderbook`
      );
      setBook(res.data);
    };

    load();
  }, []);

  return (
    <div className="card glow">
      <h3>📊 Order Book</h3>

      <h4>Buy Orders</h4>
      {book.buys.map((o, i) => (
        <p key={i}>{o.price} / {o.amount}</p>
      ))}

      <h4>Sell Orders</h4>
      {book.sells.map((o, i) => (
        <p key={i}>{o.price} / {o.amount}</p>
      ))}
    </div>
  );
}
