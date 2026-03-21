import { useState, useEffect } from "react";

export default function App() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [portfolio, setPortfolio] = useState([]);

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
      setToken(data.token);
      localStorage.setItem("token", data.token);
    }
  };

  // =========================
  // LOAD PORTFOLIO
  // =========================
  const loadPortfolio = async () => {
    const res = await fetch(
      "https://sxp-bridge-app-production.up.railway.app/api/portfolio",
      {
        headers: {
          Authorization: token,
        },
      }
    );

    const data = await res.json();
    setPortfolio(data);
  };

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) loadPortfolio();
  }, [token]);

  // =========================
  // UI
  // =========================
  if (!token) {
    return (
      <div className="container">
        <h1>💎 Login</h1>

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

  return (
    <div className="container">
      <h1>💎 Snow Doll Exchange</h1>

      <h2>Portfolio</h2>

      {portfolio.map((p, i) => (
        <div key={i}>
          {p.token}: {p.amount}
        </div>
      ))}
    </div>
  );
}
