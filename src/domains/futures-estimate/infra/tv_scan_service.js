import { normalizeTickers } from "../domain/impact_rules.js";

export { normalizeTickers };

export async function fetchTradingViewScan(tickers) {
  return fetch("https://scanner.tradingview.com/global/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "tracking-sa-tv-scan-proxy",
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: ["name", "description", "close", "change"],
    }),
  });
}
