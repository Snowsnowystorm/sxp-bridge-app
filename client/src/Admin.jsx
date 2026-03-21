import { useEffect, useState } from "react";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [trades, setTrades] = useState([]);

  const token = localStorage.getItem("token");

  // =========================
  // LOAD DATA
  // =========================
  const load = async () => {
    const headers = { Authorization: token };

    const u = await fetch(API + "/api/admin/users", { headers });
    const w = await fetch(API + "/api/admin/withdrawals", { headers });
    const t = await fetch(API + "/api/admin/trades", { headers });

    setUsers(await u.json());
    setWithdrawals(await w.json());
    setTrades(await t.json());
  };

  useEffect(() => {
    load();
  }, []);

  // =========================
  // ACTIONS
  // =========================
  const freeze = async (id) => {
    await fetch(API + "/api/admin/freeze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ user_id: id }),
    });

    load();
  };

  const unfreeze = async (id) => {
    await fetch(API + "/api/admin/unfreeze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ user_id: id }),
    });

    load();
  };

  return (
    <div className="container">
      <h1>👑 Snow Doll Admin</h1>

      {/* USERS */}
      <div className="card">
        <h2>Users</h2>

        {users.map((u) => (
          <div key={u.id} className="row">
            <span>{u.email}</span>
            <span>{u.is_frozen ? "❌ Frozen" : "✅ Active"}</span>

            {!u.is_frozen ? (
              <button onClick={() => freeze(u.id)}>Freeze</button>
            ) : (
              <button onClick={() => unfreeze(u.id)}>Unfreeze</button>
            )}
          </div>
        ))}
      </div>

      {/* WITHDRAWALS */}
      <div className="card">
        <h2>Withdrawals</h2>

        {withdrawals.map((w) => (
          <div key={w.id} className="row">
            <span>{w.amount}</span>
            <span>{w.address}</span>
            <span>Risk: {w.risk_score}</span>
          </div>
        ))}
      </div>

      {/* TRADES */}
      <div className="card">
        <h2>Trades</h2>

        {trades.map((t) => (
          <div key={t.id} className="row">
            <span>{t.amount}</span>
            <span>{t.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
