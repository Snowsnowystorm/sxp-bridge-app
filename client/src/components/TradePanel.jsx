import React, { useState } from "react";
import axios from "axios";

export default function TradePanel() {
  const [type, setType] = useState("buy");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");

  const placeOrder = async () => {
    await axios.post(
      `${import.meta.env.VITE_API_URL}/api/order`,
      {
        user_id: "demo-user", // replace later
        type,
        price,
        amount,
      }
    );

    alert("Order placed 💎");
  };

  return (
    <div className="card glow">
      <h3>💎 Trade SXP</h3>

      <select onChange={(e) => setType(e.target.value)}>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>

      <input
        placeholder="Price"
        onChange={(e) => setPrice(e.target.value)}
      />

      <input
        placeholder="Amount"
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={placeOrder}>Place Order</button>
    </div>
  );
}
