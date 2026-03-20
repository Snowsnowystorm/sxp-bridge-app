import useWallet from "./hooks/useWallet";

export default function App() {
  const { account, chainId, connectWallet } = useWallet();

  return (
    <div style={{
      padding: 20,
      color: "white",
      background: "#0f0f1a",
      height: "100vh"
    }}>
      <h1>SXP Bridge</h1>

      {!account ? (
        <button onClick={connectWallet}>
          Connect MetaMask
        </button>
      ) : (
        <div>
          <p>Connected Wallet:</p>
          <p>{account}</p>

          <p>Network:</p>
          <p>{chainId}</p>

          <button>
            Bridge SXP
          </button>
        </div>
      )}
    </div>
  );
}
