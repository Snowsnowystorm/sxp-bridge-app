import { useState } from "react";
import { ethers } from "ethers";

export default function App() {
  const [account, setAccount] = useState("");
  const [network, setNetwork] = useState("");

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    setAccount(address);
    setNetwork(network.name);
  };

  return (
    <div style={{
      padding: 30,
      background: "#0f0c29",
      minHeight: "100vh",
      color: "white"
    }}>
      <h1>💎 SXP Bridge</h1>

      {!account ? (
        <button onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <div>
          <p>Wallet: {account}</p>
          <p>Network: {network}</p>
        </div>
      )}
    </div>
  );
}
