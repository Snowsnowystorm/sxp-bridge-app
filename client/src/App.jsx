import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    try {
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
        setMessage("✅ Login successful");
      } else {
        setMessage("❌ Invalid login");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Server error");
    }
  };

  const testAdmin = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/api/admin`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      setMessage(data.message || "No access");
      console.log(data);
    } catch (err) {
      console.error(err);
      setMessage("❌ Admin error");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0a0a0a",
      color: "#fff"
    }}>
      <div style={{
        padding: "30px",
        borderRadius: "12px",
        background: "#111",
        width: "320px"
      }}>
        <h2>SXP Bridge 🔐</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: "10px", padding: "10px" }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: "10px", padding: "10px" }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "10px",
            background: "#6c5ce7",
            border: "none",
            borderRadius: "6px",
            marginBottom: "10px"
          }}
        >
          Login
        </button>

        <button
          onClick={testAdmin}
          style={{
            width: "100%",
            padding: "10px",
            background: "#00cec9",
            border: "none",
            borderRadius: "6px"
          }}
        >
          Test Admin
        </button>

        <p style={{ marginTop: "15px" }}>{message}</p>
      </div>
    </div>
  );
}
