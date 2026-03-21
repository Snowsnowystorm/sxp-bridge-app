import { useEffect, useState } from "react";

export default function TxTable() {
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/transactions", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token")
        }
      });

      setTxs(await res.json());
    }

    load();
  }, []);

  return (
    <div className="card">
      <h3>📊 Transactions</h3>

      {txs.map(tx => (
        <div key={tx.id} className="row">
          <span>{tx.type}</span>
          <span>{tx.amount}</span>
          <span className={tx.status}>{tx.status}</span>
        </div>
      ))}
    </div>
  );
}
