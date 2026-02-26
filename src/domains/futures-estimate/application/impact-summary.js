function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toLocaleString();
}

function formatChangePercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-%";
  return `${value.toFixed(2)}%`;
}

function buildImpactSummaryText(data) {
  const totalScore = typeof data?.totalScore === "number" ? data.totalScore : "-";
  const probabilityText = typeof data?.probabilityUp === "number" ? `${data.probabilityUp}%` : "-";
  const sampleText = typeof data?.samples === "number" ? `${data.samples}` : "-";
  const verdictText = data?.verdict || "-";
  return `종합 점수 ${totalScore}점 | 상승확률 ${probabilityText} | 판정 ${verdictText} (표본 ${sampleText})`;
}

function buildUpdatedAtText(updatedAt, locale = "ko-KR") {
  const date = updatedAt ? new Date(updatedAt) : new Date();
  return `업데이트: ${date.toLocaleString(locale)}`;
}

export {
  formatNumber,
  formatChangePercent,
  buildImpactSummaryText,
  buildUpdatedAtText,
};
