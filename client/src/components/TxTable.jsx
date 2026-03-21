import { useEffect, useState } from "react";
import io from "socket.io-client";

/* ⚠️ CHANGE THIS AFTER DEPLOY */
const socket = io("http://localhost:3000");

export default function TxTable() {
  const [txs, setTxs] = useState([]);

  /* LOAD EXISTING TXS */
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

    /* 🔥 LISTEN FOR LIVE TX */
    socket.on("new_tx", (tx) => {
      setTxs(prev => [tx, ...prev]);
    });

    return () => {
      socket.off("new_tx"); // cleanup
    };
  }, []);

  return (
    <div className="card">
      <h3>📊 Live Transactions</h3>

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
