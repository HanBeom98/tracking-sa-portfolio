export const DEFAULT_TICKERS = [
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

export function classifySignal(symbol, change) {
  if (symbol === "FX_IDC:USDKRW") {
    if (change >= 0.2) return { score: -2, text: "원화 약세(부담)" };
    if (change > 0) return { score: -1, text: "원화 약세 소폭" };
    if (change <= -0.2) return { score: 2, text: "원화 강세(우호)" };
    return { score: 1, text: "원화 강세 소폭" };
  }
  if (symbol === "TVC:GOLD") {
    if (change >= 0.4) return { score: -1, text: "리스크오프 경계" };
    if (change <= -0.4) return { score: 1, text: "리스크온 보조" };
    return { score: 0, text: "중립" };
  }
  if (symbol === "BITSTAMP:BTCUSD") {
    if (change >= 1.0) return { score: 1, text: "리스크온 보조" };
    if (change <= -1.0) return { score: -1, text: "리스크오프 보조" };
    return { score: 0, text: "중립" };
  }
  if (change >= 0.5) return { score: 2, text: "상승 우호" };
  if (change > 0) return { score: 1, text: "상승 보조" };
  if (change <= -0.5) return { score: -2, text: "하락 우려" };
  return { score: -1, text: "약세 보조" };
}

export function verdictFromScore(totalScore) {
  if (totalScore >= 4) return "상승 우위";
  if (totalScore <= -4) return "하락 우위";
  return "중립";
}

