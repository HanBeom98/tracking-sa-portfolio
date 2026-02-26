const PRED_UP_THRESHOLD = 58.0;
const PRED_DOWN_THRESHOLD = 42.0;

function computePredictionLabel(probabilityUp) {
  if (typeof probabilityUp !== "number" || Number.isNaN(probabilityUp)) return "-";
  if (probabilityUp >= PRED_UP_THRESHOLD) return "up";
  if (probabilityUp <= PRED_DOWN_THRESHOLD) return "down";
  return "neutral";
}

function toDirectionText(label) {
  if (label === "up") return "상승";
  if (label === "down") return "하락";
  if (label === "neutral") return "중립";
  if (label === "flat") return "보합";
  return "-";
}

function toPredictionResultText(item) {
  if (!item || item.status !== "evaluated") return "대기";
  if (item.is_hit === true) return "성공";
  if (item.is_hit === false) return "실패";
  return "중립예측";
}

export {
  PRED_UP_THRESHOLD,
  PRED_DOWN_THRESHOLD,
  computePredictionLabel,
  toDirectionText,
  toPredictionResultText,
};
