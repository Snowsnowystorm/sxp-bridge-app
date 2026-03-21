import React, { useState } from "react";
import { ethers } from "ethers";
import axios from "axios";

const API = "https://sxp-bridge-app-production.up.railway.app";

export default function App() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);

    setAccount(accounts[0]);
  };

  const getBalance = async () => {
    const res = await axios.post(API + "/balance", {
      address: account,
      chain: "ETH",
      tokenAddress: "0xYourTokenAddress"
    });

    setBalance(res.data.balance);
  };

  return (
    <div style={{ padding: 30, color: "white", background: "#0f0c29", minHeight: "100vh" }}>
      <h1>💎 SXP Bridge</h1>

      {!account && (
        <button onClick={connectWallet}>Connect Wallet</button>
      )}

      {account && (
        <>
          <p>Wallet: {account}</p>

          <button onClick={getBalance}>Get Balance</button>

          <p>Balance: {balance}</p>
        </>
      )}
    </div>
  );
}
