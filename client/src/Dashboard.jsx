import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import BalanceCard from "./components/BalanceCard";
import BridgePanel from "./components/BridgePanel";
import WithdrawPanel from "./components/WithdrawPanel";
import ChartPanel from "./components/ChartPanel";
import TxTable from "./components/TxTable";
import "./styles/snow.css";

export default function Dashboard() {
  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Header />

        <div className="grid">
          <BalanceCard />
          <ChartPanel />
        </div>

        <div className="grid">
          <BridgePanel />
          <WithdrawPanel />
        </div>

        <TxTable />
      </div>
    </div>
  );
}
