import { useState } from "react";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [adminData, setAdminData] = useState([]);

  // ================= LOGIN =================
  const login = async () => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.token) {
      setToken(data.token);
      loadAdmin(data.token);
    } else {
      alert(data.error);
    }
  };

  // ================= REGISTER =================
  const register = async () => {
    const res = await fetch(`${API}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    alert(data.message || data.error);
  };

  // ================= LOAD ADMIN =================
  const loadAdmin = async (token) => {
    const res = await fetch(`${API}/api/admin`, {
      headers: {
        Authorization: token
      }
    });

    const data = await res.json();

    if (data.users) {
      setView("admin");
      setAdminData(data.users);
    }
  };

  // ================= UI =================

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Arial"
    }}>

      {/* LOGIN / REGISTER */}
      {view !== "admin" && (
        <div style={{
          padding: 30,
          borderRadius: 20,
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 0 40px rgba(255,0,255,0.3)"
        }}>
          <h1 style={{ textAlign: "center" }}>💎 Snow Doll Login</h1>

          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button onClick={login} style={buttonStyle}>
            Login ✨
          </button>

          <button onClick={register} style={buttonStyle}>
            Register 💎
          </button>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {view === "admin" && (
        <div style={{
          width: "80%",
          padding: 30
        }}>
          <h1>👑 Admin Dashboard</h1>

          <h3>Users:</h3>

          {adminData.map((u, i) => (
            <div key={i} style={{
              padding: 10,
              marginBottom: 10,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 10
            }}>
              {u.email}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// 💎 STYLES

const inputStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 15,
  borderRadius: 10,
  border: "none",
  outline: "none"
};

const buttonStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(45deg, pink, purple)",
  color: "white",
  fontWeight: "bold"
};
