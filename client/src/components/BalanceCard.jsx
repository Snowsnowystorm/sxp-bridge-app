export default function BalanceCard({ balance }) {
  return (
    <div className="card">
      <h2 className="glow">Wallet Balance</h2>
      <h1>{balance} SXP</h1>
    </div>
  );
}
