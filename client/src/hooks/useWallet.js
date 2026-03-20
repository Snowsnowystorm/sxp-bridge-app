import { useState } from "react";

export default function useWallet() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Install MetaMask");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    const chain = await window.ethereum.request({
      method: "eth_chainId"
    });

    setAccount(accounts[0]);
    setChainId(chain);
  };

  return { account, chainId, connectWallet };
}
