import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLogin = async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      setIsLoggedIn(true);
      loadUsers();
    } else {
      setMessage("❌ Invalid login");
    }
  };

  const loadUsers = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    setUsers(data);
  };

  const freezeUser = async (id) => {
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/api/admin/freeze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId: id })
    });

    loadUsers();
  };

  const unfreezeUser = async (id) => {
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/api/admin/unfreeze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId: id })
    });

    loadUsers();
  };

  if (!isLoggedIn) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Admin Login</h2>

        <input
          placeholder="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>Login</button>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Admin Dashboard 🚀</h2>

      <button onClick={loadUsers}>Refresh Users</button>

      <table border="1" cellPadding="10" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.balance}</td>
              <td>{u.status}</td>
              <td>
                {u.status === "active" ? (
                  <button onClick={() => freezeUser(u.id)}>
                    Freeze
                  </button>
                ) : (
                  <button onClick={() => unfreezeUser(u.id)}>
                    Unfreeze
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
