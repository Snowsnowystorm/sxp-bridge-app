import { useState, useEffect } from "react";
import "./index.css";

import ChartPanel from "./components/ChartPanel";
import TxTable from "./components/TxTable";
import BridgePanel from "./components/BridgePanel";
import BalanceCard from "./components/BalanceCard";
import WithdrawPanel from "./components/WithdrawPanel";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(false);

  const API = import.meta.env.VITE_API_URL;

  // 💎 LOGIN FUNCTION
  const handleLogin = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // SAVE TOKEN
      localStorage.setItem("token", data.token);
      setToken(data.token);

      setLoading(false);
    } catch (err) {
      console.error(err);
      alert("Server error");
      setLoading(false);
    }
  };

  // 💎 LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  // 💎 LOGIN SCREEN
  if (!token) {
    return (
      <div className="login-container">
        <h1>💎 Snow Doll Login</h1>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>
          {loading ? "Loading..." : "Login"}
        </button>
      </div>
    );
  }

  // 💎 MAIN DASHBOARD (AFTER LOGIN)
  return (
    <div className="app">
      <header className="header">
        <h1>💎 Snow Doll Exchange</h1>
        <button onClick={handleLogout}>Logout</button>
      </header>

      <div className="grid">
        <div className="left">
          <ChartPanel />
          <TxTable />
        </div>

        <div className="right">
          <BalanceCard />
          <BridgePanel />
          <WithdrawPanel />
        </div>
      </div>
    </div>
  );
}
