import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/* 🔥 YOUR REAL BACKEND URL */
const API_BASE = "https://sxp-bridge-app-production.up.railway.app";

const socket = io(API_BASE);

export default function TxTable() {
  const [txs, setTxs] = useState([]);

  async function loadTransactions() {
    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token")
        }
      });

      const data = await res.json();
      setTxs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  useEffect(() => {
    loadTransactions();

    /* 🔥 REAL-TIME LISTENER */
    socket.on("new_tx", (tx) => {
      setTxs((prev) => [tx, ...prev]);
    });

    return () => {
      socket.off("new_tx");
    };
  }, []);

  return (
    <div className="card">
      <h3>📊 Live Transactions</h3>

      {txs.length === 0 && <p>No transactions yet</p>}

      {txs.map((tx) => (
        <div key={tx.id} className="row">
          <span>{tx.type}</span>
          <span>{tx.amount}</span>
          <span>{tx.status}</span>
        </div>
      ))}
    </div>
  );
}
