const DEFAULT_TICKERS = [
  "AMEX:SPY",
  "NASDAQ:QQQ",
  "AMEX:DIA",
  "FX_IDC:USDKRW",
  "TVC:GOLD",
  "BITSTAMP:BTCUSD",
];

export function normalizeTickers(input) {
  const tickers = Array.isArray(input) && input.length ? input : DEFAULT_TICKERS;
  return tickers.map((v) => String(v).trim()).filter(Boolean).slice(0, 20);
}

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

