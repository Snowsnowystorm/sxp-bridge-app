import { useState } from "react";
import axios from "axios";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function Admin() {
  const [token, setToken] = useState("");
  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const loadUsers = async () => {
    const res = await axios.get(`${API}/admin/users`, {
      headers: { Authorization: token }
    });
    setUsers(res.data.users);
  };

  const loadBalances = async () => {
    const res = await axios.get(`${API}/admin/balances`, {
      headers: { Authorization: token }
    });
    setBalances(res.data.balances);
  };

  const loadTransactions = async () => {
    const res = await axios.get(`${API}/transactions/${users[0]?.id}`, {
      headers: { Authorization: token }
    });
    setTransactions(res.data.transactions);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>👑 Snow Doll Admin</h1>

      <input
        placeholder="Admin JWT"
        onChange={(e) => setToken(e.target.value)}
        style={styles.input}
      />

      <div style={styles.buttons}>
        <button onClick={loadUsers}>Users</button>
        <button onClick={loadBalances}>Balances</button>
        <button onClick={loadTransactions}>Transactions</button>
      </div>

      <div style={styles.grid}>
        <div>
          <h3>Users</h3>
          {users.map((u) => (
            <p key={u.id}>{u.email}</p>
          ))}
        </div>

        <div>
          <h3>Balances</h3>
          {balances.map((b, i) => (
            <p key={i}>{b.token}: {b.amount}</p>
          ))}
        </div>

        <div>
          <h3>Transactions</h3>
          {transactions.map((t, i) => (
            <p key={i}>
              {t.type} — {t.amount} — {t.chain}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "#0f0c29",
    color: "white",
    minHeight: "100vh",
    padding: 30
  },
  title: {
    textShadow: "0 0 20px pink"
  },
  input: {
    padding: 10,
    marginBottom: 20
  },
  buttons: {
    display: "flex",
    gap: 10,
    marginBottom: 20
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 20
  }
};
