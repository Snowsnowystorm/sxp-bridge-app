import React, { useEffect, useState } from "react";
import axios from "axios";

const API = "https://sxp-bridge-app-sxp-bridge.up.railway.app";

export default function App() {
  const [status, setStatus] = useState("Loading...");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    axios.get(API + "/")
      .then(res => setStatus(res.data.message))
      .catch(() => setStatus("Backend not connected"));

    axios.get(API + "/users")
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]));
  }, []);

  return (
    <div style={{
      background: "#0f0c29",
      color: "white",
      minHeight: "100vh",
      padding: "30px",
      fontFamily: "sans-serif"
    }}>
      <h1>💎 SXP Bridge Dashboard</h1>

      <p>Status: {status}</p>

      <h2>Users</h2>
      {users.map((u, i) => (
        <div key={i} style={{
          padding: "10px",
          margin: "10px 0",
          background: "#1a1a2e",
          borderRadius: "10px"
        }}>
          {u.email}
        </div>
      ))}
    </div>
  );
}
