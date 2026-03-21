import { useEffect, useRef } from "react";

export default function TradingChart() {
  const chartRef = useRef();

  useEffect(() => {
    const script = document.createElement("script");

    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;

    script.onload = () => {
      new window.TradingView.widget({
        container_id: chartRef.current.id,
        symbol: "BINANCE:ETHUSDT",
        interval: "5",
        theme: "dark",
        style: "1",
        locale: "en",
        width: "100%",
        height: 500,
        enable_publishing: false,
        hide_side_toolbar: false,
      });
    };

    document.body.appendChild(script);
  }, []);

  return <div id="tradingview_chart" ref={chartRef}></div>;
}
