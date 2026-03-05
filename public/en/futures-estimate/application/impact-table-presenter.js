function getTranslate(translate) {
  return typeof translate === "function" ? translate : ((_, fallback) => fallback);
}

function toIndicatorNameWithTranslator(symbol, rawName, translate) {
  const t = getTranslate(translate);
  const bySymbol = {
    "AMEX:SPY": t("futures_indicator_spy", "SPY (S&P500 ETF)"),
    "NASDAQ:QQQ": t("futures_indicator_qqq", "QQQ (Nasdaq-100 ETF)"),
    "AMEX:DIA": t("futures_indicator_dia", "DIA (Dow ETF)"),
    "FX_IDC:USDKRW": t("futures_indicator_usdkrw", "USDKRW (USD/KRW)"),
    "TVC:GOLD": t("futures_indicator_gold", "GOLD (Spot Gold)"),
    "BITSTAMP:BTCUSD": t("futures_indicator_btcusd", "BTCUSD (Bitcoin)"),
  };
  if (symbol && bySymbol[symbol]) return bySymbol[symbol];
  return rawName || symbol || "-";
}

function normalizeImpactSignal(rawSignal) {
  const text = String(rawSignal || "").trim().toLowerCase();
  if (!text) return "unknown";

  const hasStrong = text.includes("강함") || text.includes("strong");
  const hasUp = text.includes("상승") || text.includes("up") || text.includes("bullish") || text.includes("buy");
  const hasDown = text.includes("하락") || text.includes("down") || text.includes("bearish") || text.includes("sell");
  const hasNeutral = text.includes("중립") || text.includes("neutral") || text.includes("flat");

  if (hasUp && hasStrong) return "up_strong";
  if (hasUp) return "up";
  if (hasDown && hasStrong) return "down_strong";
  if (hasDown) return "down";
  if (hasNeutral) return "neutral";
  return "unknown";
}

function toImpactSignalTextWithTranslator(rawSignal, translate) {
  const t = getTranslate(translate);
  const normalized = normalizeImpactSignal(rawSignal);
  if (normalized === "up_strong") return t("futures_signal_up_strong", "상승 기여 강함");
  if (normalized === "up") return t("futures_signal_up", "상승 기여");
  if (normalized === "down_strong") return t("futures_signal_down_strong", "하락 기여 강함");
  if (normalized === "down") return t("futures_signal_down", "하락 기여");
  if (normalized === "neutral") return t("futures_signal_neutral", "중립");
  return t("futures_signal_unknown", "판단 불가");
}

export {
  toIndicatorNameWithTranslator,
  normalizeImpactSignal,
  toImpactSignalTextWithTranslator,
};
