export const FEATURE_SET = [
  { symbol: "AMEX:SPY", source: "spy.us", name: "SPY" },
  { symbol: "NASDAQ:QQQ", source: "qqq.us", name: "QQQ" },
  { symbol: "AMEX:DIA", source: "dia.us", name: "DIA" },
  { symbol: "FX_IDC:USDKRW", source: "usdkrw", name: "USDKRW" },
  { symbol: "TVC:GOLD", source: "xauusd", name: "GOLD" },
  { symbol: "BITSTAMP:BTCUSD", source: "btcusd", name: "BTCUSD" },
];

export const TARGET_CONFIG = {
  source: "ewy.us",
  name: "EWY",
};

export function getDefaultFeatureSymbols() {
  return FEATURE_SET.map((v) => v.symbol);
}

export function normalizeTickers(input) {
  const fallback = getDefaultFeatureSymbols();
  const raw = Array.isArray(input) && input.length ? input : fallback;
  const allowed = new Set(fallback);
  return raw.map((v) => String(v).trim()).filter((v) => allowed.has(v));
}

export function featureBySymbol(symbol) {
  return FEATURE_SET.find((v) => v.symbol === symbol) || null;
}

export function classifyContribution(weightedZ) {
  if (weightedZ >= 0.3) return { score: 2, text: "상승 기여 강함" };
  if (weightedZ > 0.05) return { score: 1, text: "상승 기여" };
  if (weightedZ <= -0.3) return { score: -2, text: "하락 기여 강함" };
  if (weightedZ < -0.05) return { score: -1, text: "하락 기여" };
  return { score: 0, text: "중립" };
}

export function verdictFromProbability(pUp) {
  if (pUp >= 0.58) return "상승 우위";
  if (pUp <= 0.42) return "하락 우위";
  return "중립";
}
