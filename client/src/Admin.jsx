import { useState } from "react";
import axios from "axios";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function Admin() {
  const [token, setToken] = useState("");
  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState([]);

  const fetchUsers = async () => {
    const res = await axios.get(`${API}/admin/users`, {
      headers: { Authorization: token }
    });
    setUsers(res.data.users);
  };

  const fetchBalances = async () => {
    const res = await axios.get(`${API}/admin/balances`, {
      headers: { Authorization: token }
    });
    setBalances(res.data.balances);
  };

  return (
    <div className="admin">
      <h1>👑 Snow Doll Admin</h1>

      <input
        placeholder="Admin JWT Token"
        onChange={(e) => setToken(e.target.value)}
      />

      <button onClick={fetchUsers}>Load Users</button>
      <button onClick={fetchBalances}>Load Balances</button>

      <div>
        <h2>Users</h2>
        {users.map((u) => (
          <p key={u.id}>{u.email}</p>
        ))}
      </div>

      <div>
        <h2>Balances</h2>
        {balances.map((b, i) => (
          <p key={i}>
            {b.user_id} — {b.token}: {b.amount}
          </p>
        ))}
      </div>
    </div>
  );
}
