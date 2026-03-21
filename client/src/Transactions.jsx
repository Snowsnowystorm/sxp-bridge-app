import { useEffect, useState } from "react";
import "./snow.css";

export default function Transactions() {
  const [txs, setTxs] = useState([]);

  async function load() {
    const res = await fetch("/transactions", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    const data = await res.json();
    setTxs(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="snow-container">
      <h1 className="title">💎 Snow Doll Transactions</h1>

      {txs.map(tx => (
        <div key={tx.id} className="card">
          <div>Type: {tx.type}</div>
          <div>Amount: {tx.amount}</div>
          <div>Status: 
            <span className={`status ${tx.status}`}>
              {tx.status}
            </span>
          </div>
          <div>To: {tx.to_address}</div>
          {tx.tx_hash && (
            <div className="hash">{tx.tx_hash}</div>
          )}
        </div>
      ))}
    </div>
  );
}
