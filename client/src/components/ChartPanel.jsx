import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ChartPanel() {
  const [price, setPrice] = useState(0);

  useEffect(() => {
    const load = async () => {
      const res = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price?ids=solar&vs_currencies=usd"
      );
      setPrice(res.data.solar.usd);
    };

    load();
    const interval = setInterval(load, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card glow">
      <h3>📊 SXP Price</h3>
      <p>${price}</p>
    </div>
  );
}
