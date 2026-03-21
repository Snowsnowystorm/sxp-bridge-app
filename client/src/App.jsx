import { useState } from "react";
import { ethers } from "ethers";

export default function App() {
  const [account, setAccount] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
  };

  return (
    <div style={{
      padding: 30,
      color: "white",
      background: "#0f0c29",
      minHeight: "100vh"
    }}>
      <h1>💎 SXP Bridge</h1>

      {!account ? (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <p>Connected: {account}</p>
      )}
    </div>
  );
}
