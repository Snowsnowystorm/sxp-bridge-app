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

  const bridge = async () => {
    await axios.post(
      `${API}/bridge`,
      {
        user_id: userId,
        amount: 1,
        from_chain: "SXP-ETH",
        to_chain: "SXP-BNB"
      },
      { headers: { Authorization: token } }
    );

    alert("🌉 Bridge Complete");
  };

  return (
    <div style={{ padding: 30, color: "white", background: "#0f0c29", minHeight: "100vh" }}>
      <h1>💎 Snow Doll Bridge 🦋</h1>

      {!token ? (
        <>
          <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button onClick={login}>Login</button>
        </>
      ) : (
        <>
          <button onClick={createWallet}>Create Wallet</button>
          <button onClick={getBalance}>Get Balance</button>
          <button onClick={bridge}>Bridge 🌉</button>

          {balances.map((b, i) => (
            <p key={i}>{b.token}: {b.amount}</p>
          ))}
        </>
      )}
    </div>
  );
}
