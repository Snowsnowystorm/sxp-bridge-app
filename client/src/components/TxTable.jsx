import React, { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_API_URL || "");

export default function TxTable() {
  const [txs, setTxs] = useState([]);

  useEffect(() => {
    const load = async () => {
      const res = await axios.get("/api/transactions");
      setTxs(res.data);
    };

    load();

    socket.on("tx_update", (tx) => {
      setTxs((prev) => [tx, ...prev]);
    });

    return () => socket.off("tx_update");
  }, []);

  return (
    <div className="card glow">
      <h3>📊 Transactions</h3>

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {txs.map((tx, i) => (
            <tr key={i}>
              <td>{tx.type}</td>
              <td>{tx.amount}</td>
              <td>{tx.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
