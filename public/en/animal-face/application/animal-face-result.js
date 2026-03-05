const DEFAULT_ANIMAL_DATA = {
  "강아지": { emoji: "🐶", kor: "강아지상" },
  "고양이": { emoji: "🐱", kor: "고양이상" },
  "다람쥐": { emoji: "🐿️", kor: "다람쥐상" },
  "곰": { emoji: "🐻", kor: "곰상" },
  "토끼": { emoji: "🐰", kor: "토끼상" },
  "여우": { emoji: "🦊", kor: "여우상" },
};

function toSortedPredictions(predictions) {
  const list = Array.isArray(predictions) ? predictions.slice() : [];
  return list.sort((a, b) => (b?.probability || 0) - (a?.probability || 0));
}

function buildAnimalFaceResult(predictions, animalData = DEFAULT_ANIMAL_DATA) {
  const sorted = toSortedPredictions(predictions);
  if (!sorted.length) return null;
  const top = sorted[0] || {};
  const className = String(top.className || "").trim();
  const probability = typeof top.probability === "number" ? top.probability : 0;
  const confidence = (Math.max(0, Math.min(1, probability)) * 100).toFixed(2);
  const meta = animalData[className] || { emoji: "❓", kor: className || "알 수 없음" };
  return {
    name: meta.kor,
    emoji: meta.emoji,
    score: confidence,
  };
}

export {
  DEFAULT_ANIMAL_DATA,
  toSortedPredictions,
  buildAnimalFaceResult,
};
