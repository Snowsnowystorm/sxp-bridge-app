import React from "react";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import BalanceCard from "./components/BalanceCard";
import BridgePanel from "./components/BridgePanel";
import WithdrawPanel from "./components/WithdrawPanel";
import TxTable from "./components/TxTable";
import ChartPanel from "./components/ChartPanel";
import TradePanel from "./components/TradePanel";
import OrderBook from "./components/OrderBook";

import "./App.css";

export default function App() {
  return (
    <div className="app">

      <Header />

      <div className="layout">
        <Sidebar />

        <div className="main">

          {/* 💎 TOP */}
          <div className="grid">
            <BalanceCard />
            <ChartPanel />
          </div>

          {/* 🌉 CORE ACTIONS */}
          <div className="grid">
            <BridgePanel />
            <WithdrawPanel />
          </div>

          {/* 💎 TRADING */}
          <div className="grid">
            <TradePanel />
            <OrderBook />
          </div>

          {/* 📊 HISTORY */}
          <TxTable />

        </div>
      </div>

    </div>
  );
}
