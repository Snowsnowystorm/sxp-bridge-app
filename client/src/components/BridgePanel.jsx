import React, { useState } from "react";
import axios from "axios";

export default function BridgePanel() {
  const [amount, setAmount] = useState("");
  const [chain, setChain] = useState("SXP-ETH");

  const handleBridge = async () => {
    try {
      await axios.post("/api/bridge", { amount, chain });
      alert("Bridge initiated 🌉");
    } catch (err) {
      alert("Bridge failed ❌");
    }
  };

  return (
    <div className="card glow">
      <h3>🌉 Bridge SXP</h3>

      <select onChange={(e) => setChain(e.target.value)}>
        <option>SXP-ETH</option>
        <option>SXP-BNB</option>
        <option>SXP-SOLAR</option>
      </select>

      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={handleBridge}>Bridge</button>
    </div>
  );
}
