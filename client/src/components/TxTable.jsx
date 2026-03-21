import { useEffect, useState } from "react";

export default function TxTable() {
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    fetch("/api/transactions")
      .then(res => res.json())
      .then(setTxs);
  }, []);

  return (
    <div className="card">
      <h2 className="glow">Transactions 💎</h2>

      {txs.map((tx, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <b>{tx.type}</b> — {tx.amount} — {tx.status}
        </div>
      ))}
    </div>
  );
}
