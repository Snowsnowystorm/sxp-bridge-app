import { useState } from "react";

export default function App() {
  const [connected, setConnected] = useState(false);

  const connectWallet = () => {
    // placeholder (Phase 3 = real MetaMask)
    setConnected(true);
  };

  return (
    <div style={{ padding: 20, color: "white", background: "#0f0f1a", height: "100vh" }}>
      <h1>SXP Bridge</h1>

      {!connected ? (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p>Wallet Connected ✅</p>
          <button>Bridge SXP</button>
        </div>
      )}
    </div>
  );
}
