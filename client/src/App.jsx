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
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.token) {
        setToken(data.token);
        loadAdmin(data.token);
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      alert("Error connecting to backend");
    }
  };

  // ================= REGISTER =================
  const register = async () => {
    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      alert(data.message || data.error);
    } catch {
      alert("Register failed");
    }
  };

  // ================= MAKE ADMIN =================
  const makeAdmin = async () => {
    try {
      const res = await fetch(`${API}/api/make-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: "Vaultcollectionarchive@gmail.com"
        })
      });

      const data = await res.json();
      alert(data.message || data.error);
    } catch {
      alert("Failed to make admin");
    }
  };

  // ================= LOAD ADMIN =================
  const loadAdmin = async (token) => {
    try {
      const res = await fetch(`${API}/api/admin`, {
        headers: {
          Authorization: token
        }
      });

      const data = await res.json();

      if (data.users) {
        setView("admin");
        setAdminData(data.users);
      } else {
        alert(data.error || "Not admin");
      }
    } catch {
      alert("Admin load failed");
    }
  };

  // ================= UI =================

  return (
    <div style={containerStyle}>

      {/* LOGIN / REGISTER */}
      {view !== "admin" && (
        <div style={cardStyle}>
          <h1 style={{ textAlign: "center" }}>💎 Snow Doll Portal</h1>

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

          <button onClick={makeAdmin} style={adminButtonStyle}>
            Become Admin 👑
          </button>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {view === "admin" && (
        <div style={dashboardStyle}>
          <h1>👑 Snow Doll Admin Dashboard</h1>

          <h3>Registered Users:</h3>

          {adminData.length === 0 && <p>No users yet</p>}

          {adminData.map((u, i) => (
            <div key={i} style={userCardStyle}>
              {u.email}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ================= STYLES =================

const containerStyle = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "white",
  fontFamily: "Arial"
};

const cardStyle = {
  padding: 30,
  borderRadius: 20,
  width: 320,
  background: "rgba(255,255,255,0.05)",
  backdropFilter: "blur(20px)",
  boxShadow: "0 0 40px rgba(255,0,255,0.3)"
};

const inputStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 15,
  borderRadius: 10,
  border: "none",
  outline: "none"
};

const buttonStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(45deg, pink, purple)",
  color: "white",
  fontWeight: "bold"
};

const adminButtonStyle = {
  ...buttonStyle,
  background: "linear-gradient(45deg, gold, orange)"
};

const dashboardStyle = {
  width: "80%",
  padding: 30
};

const userCardStyle = {
  padding: 12,
  marginBottom: 10,
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)"
};
