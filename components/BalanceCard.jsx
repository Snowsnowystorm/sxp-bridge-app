import { useEffect, useState } from "react";

export default function BalanceCard() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    async function load() {
      const res = await fetch("/transactions", {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token")
        }
      });

      const data = await res.json();

      const total = data.reduce((acc, tx) => {
        if (tx.status === "completed" && tx.type === "deposit") {
          return acc + Number(tx.amount);
        }
        return acc;
      }, 0);

      setBalance(total);
    }

    load();
  }, []);

  return (
    <div className="card big">
      <h3>Total SXP Balance</h3>
      <h1>{balance} SXP</h1>
    </div>
  );
}
