import React, { useState } from "react";
import axios from "axios";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [data, setData] = useState("");

  const login = async () => {
    try {
      const res = await axios.post(API + "/login", {
        email,
        password
      });

      setToken(res.data.token);
      setRole(res.data.role);
    } catch {
      alert("Login failed");
    }
  };

  const loadDashboard = async () => {
    const res = await axios.get(API + "/dashboard", {
      headers: { authorization: token }
    });
    setData(JSON.stringify(res.data));
  };

  const loadAdmin = async () => {
    const res = await axios.get(API + "/admin", {
      headers: { authorization: token }
    });
    setData(JSON.stringify(res.data));
  };

  return (
    <div style={{ padding: 30 }}>
      <h1>💎 SXP Platform</h1>

      {!token && (
        <>
          <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
          <br /><br />
          <input placeholder="Password" type="password" onChange={e => setPassword(e.target.value)} />
          <br /><br />
          <button onClick={login}>Login</button>
        </>
      )}

      {token && (
        <>
          <p>Logged in as: {role}</p>

          <button onClick={loadDashboard}>User Dashboard</button>

          {role === "admin" && (
            <button onClick={loadAdmin}>Admin Panel</button>
          )}

          <pre>{data}</pre>
        </>
      )}
    </div>
  );
}
