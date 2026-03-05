function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function formatChangePercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-%";
  return `${value.toFixed(2)}%`;
}

function buildImpactSummaryText(data) {
  return buildImpactSummaryTextWithTranslator(data, (_, fallback) => fallback);
}

function buildImpactSummaryTextWithTranslator(data, translate) {
  const t = typeof translate === "function" ? translate : ((_, fallback) => fallback);
  const totalScore = typeof data?.totalScore === "number" ? data.totalScore : "-";
  const probabilityText = typeof data?.probabilityUp === "number" ? `${data.probabilityUp}%` : "-";
  const sampleText = typeof data?.samples === "number" ? `${data.samples}` : "-";
  const verdictText = data?.verdict || "-";
  return t(
    "futures_summary_template",
    `종합 점수 ${totalScore}점 | 상승확률 ${probabilityText} | 판정 ${verdictText} (표본 ${sampleText})`
  )
    .replace("{totalScore}", String(totalScore))
    .replace("{probability}", probabilityText)
    .replace("{verdict}", verdictText)
    .replace("{samples}", sampleText);
}

function buildUpdatedAtText(updatedAt, locale = "ko-KR") {
  const date = updatedAt ? new Date(updatedAt) : new Date();
  return buildUpdatedAtTextWithTranslator(updatedAt, locale, (_, fallback) => fallback);
}

function buildUpdatedAtTextWithTranslator(updatedAt, locale, translate) {
  const t = typeof translate === "function" ? translate : ((_, fallback) => fallback);
  const date = updatedAt ? new Date(updatedAt) : new Date();
  const formatted = date.toLocaleString(locale);
  return t("futures_updated_prefix", `업데이트: ${formatted}`).replace("{value}", formatted);
}

export {
  formatNumber,
  formatChangePercent,
  buildImpactSummaryText,
  buildImpactSummaryTextWithTranslator,
  buildUpdatedAtText,
  buildUpdatedAtTextWithTranslator,
};
