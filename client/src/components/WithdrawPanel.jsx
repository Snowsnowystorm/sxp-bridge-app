import React, { useState } from "react";
import axios from "axios";

export default function WithdrawPanel() {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");

  const handleWithdraw = async () => {
    try {
      await axios.post("/api/withdraw", { address, amount });
      alert("Withdrawal sent 💸");
    } catch (err) {
      alert("Withdraw failed ❌");
    }
  };

  return (
    <div className="card glow">
      <h3>💸 Withdraw</h3>

      <input
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={handleWithdraw}>Send</button>
    </div>
  );
}
