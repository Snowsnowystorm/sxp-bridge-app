import { useEffect } from "react";

export default function ChartPanel() {
  useEffect(() => {
    // Prevent duplicate widget load
    if (document.getElementById("tv-script")) return;

    const script = document.createElement("script");
    script.id = "tv-script";
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;

    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: "tv_chart",
          width: "100%",
          height: 400,
          symbol: "BINANCE:ETHUSDT",
          interval: "15",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          hide_top_toolbar: false,
          save_image: false
        });
      }
    };

    document.body.appendChild(script);
  }, []);

  return (
    <div className="card big">
      <h3>📈 Live Market</h3>
      <div id="tv_chart" />
    </div>
  );
}
