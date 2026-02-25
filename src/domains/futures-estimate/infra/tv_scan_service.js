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

export function mapTradingViewRowsToQuotes(rows) {
  return (rows || []).map((r) => {
    const d = Array.isArray(r?.d) ? r.d : [];
    return {
      symbol: r?.s || "",
      name: d[0] || r?.s || "",
      description: d[1] || "",
      close: typeof d[2] === "number" ? d[2] : null,
      change: typeof d[3] === "number" ? d[3] : null,
    };
  }).filter((q) => q.symbol);
}
