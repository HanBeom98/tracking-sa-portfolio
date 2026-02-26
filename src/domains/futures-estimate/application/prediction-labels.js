const PRED_UP_THRESHOLD = 58.0;
const PRED_DOWN_THRESHOLD = 42.0;

function computePredictionLabel(probabilityUp) {
  if (typeof probabilityUp !== "number" || Number.isNaN(probabilityUp)) return "-";
  if (probabilityUp >= PRED_UP_THRESHOLD) return "up";
  if (probabilityUp <= PRED_DOWN_THRESHOLD) return "down";
  return "neutral";
}

function normalizeDirectionLabel(rawLabel) {
  const normalized = String(rawLabel || "").trim().toLowerCase();
  if (!normalized) return "-";

  if (["up", "상승", "rise", "bullish", "long", "buy"].includes(normalized)) return "up";
  if (["down", "하락", "fall", "bearish", "short", "sell"].includes(normalized)) return "down";
  if (["neutral", "중립", "sideways", "mixed"].includes(normalized)) return "neutral";
  if (["flat", "보합"].includes(normalized)) return "flat";
  return "-";
}

function toDirectionText(label) {
  return toDirectionTextWithTranslator(label, (_, fallback) => fallback);
}

function toPredictionResultText(item) {
  return toPredictionResultTextWithTranslator(item, (_, fallback) => fallback);
}

function toDirectionTextWithTranslator(label, translate) {
  const t = typeof translate === "function" ? translate : ((_, fallback) => fallback);
  if (label === "up") return t("futures_dir_up", "상승");
  if (label === "down") return t("futures_dir_down", "하락");
  if (label === "neutral") return t("futures_dir_neutral", "중립");
  if (label === "flat") return t("futures_dir_flat", "보합");
  return "-";
}

function toPredictionResultTextWithTranslator(item, translate) {
  const t = typeof translate === "function" ? translate : ((_, fallback) => fallback);
  if (!item || item.status !== "evaluated") return t("futures_result_pending", "대기");
  if (item.is_hit === true) return t("futures_result_success", "성공");
  if (item.is_hit === false) return t("futures_result_fail", "실패");
  return t("futures_result_neutral", "중립예측");
}

export {
  PRED_UP_THRESHOLD,
  PRED_DOWN_THRESHOLD,
  computePredictionLabel,
  normalizeDirectionLabel,
  toDirectionText,
  toPredictionResultText,
  toDirectionTextWithTranslator,
  toPredictionResultTextWithTranslator,
};
