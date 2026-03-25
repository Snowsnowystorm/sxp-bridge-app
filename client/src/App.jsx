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
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await res.json();

      if (data.success) {
        setMessage("✅ Login successful");
        localStorage.setItem("token", data.token);
      } else {
        setMessage("❌ Invalid login");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Server error");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: "sans-serif"
    }}>
      <div style={{
        padding: "30px",
        borderRadius: "12px",
        background: "#111",
        width: "300px",
        textAlign: "center"
      }}>
        <h2>SXP Bridge Login</h2>

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
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Login
        </button>

        <p style={{ marginTop: "15px" }}>{message}</p>
      </div>
    </div>
  );
}
