import { useState } from "react";

export default function BridgePanel() {
  const [amount, setAmount] = useState("");

  async function bridge() {
    await fetch("/bridge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ amount })
    });

    alert("Bridge started 🌉");
  }

  return (
    <div className="card">
      <h3>🌉 Bridge SXP</h3>

      <input
        placeholder="Amount"
        onChange={e => setAmount(e.target.value)}
      />

      <button onClick={bridge} className="glow-btn">
        Bridge
      </button>
    </div>
  );
}
