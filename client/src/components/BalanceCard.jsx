import React from "react";

export default function BalanceCard({ balance }) {
  return (
    <div className="card glow">
      <h3>💎 SXP Balance</h3>
      <p style={{ fontSize: "24px", fontWeight: "bold" }}>
        {balance || 0} SXP
      </p>
    </div>
  );
}
