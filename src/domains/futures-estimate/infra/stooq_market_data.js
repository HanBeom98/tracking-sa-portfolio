export async function fetchStooqDailySeries(symbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "tracking-sa-stooq-model" },
  });
  if (!res.ok) {
    throw new Error(`stooq_http_${res.status}_${symbol}`);
  }
  const text = await res.text();
  return parseStooqCsv(text);
}

export function parseStooqCsv(csvText) {
  const text = String(csvText || "").trim();
  if (!text || text.startsWith("No data")) return [];
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    if (parts.length < 5) continue;
    const date = parts[0];
    const close = Number(parts[4]);
    if (!date || Number.isNaN(close)) continue;
    out.push({ date, close });
  }
  return out;
}

export function toDailyReturns(series) {
  const m = new Map();
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1]?.close;
    const curr = series[i]?.close;
    const date = series[i]?.date;
    if (!prev || !curr || !date) continue;
    m.set(date, (curr - prev) / prev);
  }
  return m;
}

