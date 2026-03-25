import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [message, setMessage] = useState("");

  const [wallets, setWallets] = useState(null);
  const [balance, setBalance] = useState(null);

  /* LOGIN */
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
        setToken(data.token);
        setMessage("✅ Logged in");
      } else {
        setMessage("❌ Login failed");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Server error");
    }
  };

  /* LOAD DATA */
  const loadWallets = async () => {
    const res = await fetch(`${API_URL}/api/user/wallets`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    setWallets(data);
  };

  const loadBalance = async () => {
    const res = await fetch(`${API_URL}/api/user/balance`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    setBalance(data.balance);
  };

  /* AUTO LOAD AFTER LOGIN */
  useEffect(() => {
    if (token) {
      loadWallets();
      loadBalance();
    }
  }, [token]);

  /* LOGOUT */
  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setWallets(null);
    setBalance(null);
  };

  /* LOGIN SCREEN */
  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2>SXP Bridge Login 🔐</h2>

          <input
            style={styles.input}
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.button} onClick={handleLogin}>
            Login
          </button>

          <p>{message}</p>
        </div>
      </div>
    );
  }

  /* DASHBOARD */
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Dashboard 🚀</h2>

        <button style={styles.logout} onClick={handleLogout}>
          Logout
        </button>

        {/* BALANCE */}
        <div style={styles.section}>
          <h3>Total Balance</h3>
          <p>{balance !== null ? balance : "Loading..."}</p>
        </div>

        {/* WALLETS */}
        <div style={styles.section}>
          <h3>Your Wallets</h3>

          {wallets ? (
            <>
              <p><strong>ETH:</strong> {wallets.eth_address}</p>
              <p><strong>BNB:</strong> {wallets.bnb_address}</p>
            </>
          ) : (
            <p>Loading wallets...</p>
          )}
        </div>

        {/* REFRESH */}
        <button style={styles.button} onClick={() => {
          loadWallets();
          loadBalance();
        }}>
          Refresh
        </button>

        <p style={{ marginTop: 20 }}>{message}</p>
      </div>
    </div>
  );
}

/* STYLES */
const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "sans-serif"
  },
  card: {
    padding: "30px",
    borderRadius: "12px",
    background: "#111",
    width: "360px"
  },
  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "6px",
    border: "none"
  },
  button: {
    width: "100%",
    padding: "10px",
    background: "#6c5ce7",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    marginBottom: "10px"
  },
  logout: {
    width: "100%",
    padding: "10px",
    background: "#d63031",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    marginBottom: "20px"
  },
  section: {
    marginBottom: "20px"
  }
};
