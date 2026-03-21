import { useState } from "react";
import { ethers } from "ethers";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState("");
  const [balance, setBalance] = useState("");

  // 🔗 CONNECT WALLET
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Install MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const address = await signer.getAddress();
      const net = await provider.getNetwork();

      setAccount(address);
      setNetwork(net.name);

      // 🔥 FETCH REAL BALANCE FROM BACKEND
      const res = await fetch(`${API}/api/balance/${address}`);
      const data = await res.json();

      setBalance(data.balance);

    } catch (err) {
      console.error(err);
      alert("Error connecting wallet");
    }
  };

  return (
    <div style={{
      padding: 30,
      background: "#0f0c29",
      minHeight: "100vh",
      color: "white",
      fontFamily: "Arial"
    }}>
      <h1>💎 SXP Bridge</h1>

      {!account ? (
        <button onClick={connectWallet} style={{
          padding: "10px 20px",
          fontSize: 16,
          cursor: "pointer"
        }}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p><strong>Wallet:</strong> {account}</p>
          <p><strong>Network:</strong> {network}</p>
          <p><strong>Balance:</strong> {balance} ETH</p>
        </div>
      )}
    </div>
  );
}
