import { useState, useEffect } from "react";
import Admin from "./Admin";

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const API = "https://sxp-bridge-app-production.up.railway.app";

  const login = async () => {
    const res = await fetch(API + "/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");

    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
    }
  }, []);

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return (
      <div className="container">
        <h1>💎 Snow Doll Login</h1>

        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <input
          placeholder="Password"
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={login}>Login</button>
      </div>
    );
  }

  if (user?.role === "admin") {
    return <Admin />;
  }

  return (
    <div className="container">
      <h1>💎 Snow Doll Exchange</h1>

      <p>Welcome: {user.email}</p>

      <button onClick={logout}>Logout</button>
    </div>
  );
}
