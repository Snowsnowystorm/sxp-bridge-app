import React, { useEffect, useState } from "react";
import axios from "axios";

// ✅ YOUR LIVE BACKEND
const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [status, setStatus] = useState("Loading...");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // TEST BACKEND CONNECTION
    axios.get(API + "/")
      .then(res => {
        setStatus(res.data || "Connected");
      })
      .catch(err => {
        console.error(err);
        setStatus("Backend not connected");
        setError("Cannot reach backend");
      });

    // FETCH USERS
    axios.get(API + "/users")
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]));
  }, []);

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      color: "white",
      minHeight: "100vh",
      padding: "30px",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ fontSize: "28px" }}>💎 SXP Bridge Dashboard</h1>

      <p><strong>Status:</strong> {status}</p>

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      <h2 style={{ marginTop: "20px" }}>Users</h2>

      {users.length === 0 && <p>No users found</p>}

      {users.map((u, i) => (
        <div key={i} style={{
          padding: "12px",
          margin: "10px 0",
          background: "#1a1a2e",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(255,255,255,0.1)"
        }}>
          {u.email}
        </div>
      ))}
    </div>
  );
}
