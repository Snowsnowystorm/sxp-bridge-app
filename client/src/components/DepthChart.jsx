import { useEffect, useState } from "react";

export default function DepthChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/orderbook")
      .then(res => res.json())
      .then((d) => {
        const depth = [
          ...d.buys.map(b => ({ price: b.price, amount: b.amount })),
          ...d.sells.map(s => ({ price: s.price, amount: s.amount }))
        ];
        setData(depth);
      });
  }, []);

  return (
    <div className="card">
      <h2>Depth Chart</h2>
      {data.map((d, i) => (
        <div key={i}>
          {d.price} → {d.amount}
        </div>
      ))}
    </div>
  );
}
