import { useState, useEffect } from "react";

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // =========================
  // LOGIN
  // =========================
  const login = async () => {
    const res = await fetch(
      "https://sxp-bridge-app-production.up.railway.app/api/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
    }
  };

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // =========================
  // LOGOUT
  // =========================
  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  // =========================
  // PROTECTION
  // =========================
  if (!token) {
    return (
      <div className="container">
        <h1>💎 Snow Doll Login</h1>

        <input
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="Password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={login}>Login</button>
      </div>
    );
  }

  // =========================
  // ADMIN PANEL
  // =========================
  if (user?.role === "admin") {
    return (
      <div className="container">
        <h1>👑 ADMIN DASHBOARD</h1>

        <p>Welcome Admin: {user.email}</p>

        <button onClick={logout}>Logout</button>

        <div className="card">
          <h2>Admin Controls</h2>

          <p>✔ View users</p>
          <p>✔ Freeze accounts</p>
          <p>✔ Monitor withdrawals</p>
          <p>✔ Monitor trades</p>
        </div>
      </div>
    );
  }

  // =========================
  // USER DASHBOARD
  // =========================
  return (
    <div className="container">
      <h1>💎 Snow Doll Exchange</h1>

      <p>Welcome: {user.email}</p>

      <button onClick={logout}>Logout</button>

      <div className="card">
        <h2>User Dashboard</h2>

        <p>✔ Trade</p>
        <p>✔ View portfolio</p>
        <p>✔ Withdraw</p>
      </div>
    </div>
  );
}
