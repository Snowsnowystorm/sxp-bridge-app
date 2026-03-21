import { useState } from "react";

export default function WithdrawPanel() {
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");

  async function withdraw() {
    await fetch("/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ amount, to })
    });

    alert("Withdraw queued 💸");
  }

  return (
    <div className="card">
      <h3>Withdraw</h3>

      <input placeholder="Amount" onChange={e => setAmount(e.target.value)} />
      <input placeholder="Address" onChange={e => setTo(e.target.value)} />

      <button onClick={withdraw} className="glow-btn">
        Send
      </button>
    </div>
  );
}
