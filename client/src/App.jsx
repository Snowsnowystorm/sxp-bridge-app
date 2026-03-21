import { useState } from "react";
import axios from "axios";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [balances, setBalances] = useState([]);

  const login = async () => {
    const res = await axios.post(`${API}/login`, { email, password });
    setToken(res.data.token);
    setUserId(res.data.user.id);
  };

  const createWallet = async () => {
    await axios.post(
      `${API}/create-wallet`,
      { user_id: userId, chain: "SXP-ETH" },
      { headers: { Authorization: token } }
    );
    alert("💎 Wallet Created");
  };

  const getBalance = async () => {
    const res = await axios.get(`${API}/balance/${userId}`, {
      headers: { Authorization: token }
    });
    setBalances(res.data.balances);
  };

  return (
    <div className="app">
      <div className="sparkles"></div>

      <h1 className="title">💎 Snow Doll Bridge 🦋</h1>

      {!token ? (
        <div className="card">
          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={login}>Login ✨</button>
        </div>
      ) : (
        <div className="card">
          <button onClick={createWallet}>Create Wallet 🦋</button>
          <button onClick={getBalance}>Load Balance 💎</button>

          <div className="balances">
            {balances.map((b, i) => (
              <p key={i}>{b.token}: {b.amount}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
