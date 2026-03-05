const DEFAULT_ANIMAL_DATA = {
  "강아지": {
    emoji: "🐶",
    kor: "강아지상",
    en: "Puppy-like",
    korDesc: "다정하고 귀여운 인상을 가진 당신은 귀여운 강아지상!",
    enDesc: "You have a friendly and approachable image, just like a cute puppy!"
  },
  "고양이": {
    emoji: "🐱",
    kor: "고양이상",
    en: "Cat-like",
    korDesc: "신비롭고 매력적인 분위기를 가진 당신은 도도한 고양이상!",
    enDesc: "You have a mysterious and charming vibe, much like a cat!"
  },
  "다람쥐": {
    emoji: "🐿️",
    kor: "다람쥐상",
    en: "Squirrel-like",
    korDesc: "활기차고 생생한 매력을 가진 당신은 깜찍한 다람쥐상!",
    enDesc: "You have an energetic and lively personality, similar to a squirrel!"
  },
  "곰": {
    emoji: "🐻",
    kor: "곰상",
    en: "Bear-like",
    korDesc: "듬직하고 따뜻한 포용력을 가진 당신은 포근한 곰상!",
    enDesc: "You have a dependable and warm presence, like a big bear!"
  },
  "토끼": {
    emoji: "🐰",
    kor: "토끼상",
    en: "Rabbit-like",
    korDesc: "맑고 순수한 인상을 가진 당신은 상큼한 토끼상!",
    enDesc: "You have a bright and innocent image, just like a soft rabbit!"
  },
  "여우": {
    emoji: "🦊",
    kor: "여우상",
    en: "Fox-like",
    korDesc: "지적이고 세련된 매력을 가진 당신은 매혹적인 여우상!",
    enDesc: "You have a sharp and intelligent look, with an alluring fox-like charm!"
  },
};

function toSortedPredictions(predictions) {
  const list = Array.isArray(predictions) ? predictions.slice() : [];
  return list.sort((a, b) => (b?.probability || 0) - (a?.probability || 0));
}

function buildAnimalFaceResult(predictions, lang = "ko", animalData = DEFAULT_ANIMAL_DATA) {
  const sorted = toSortedPredictions(predictions);
  if (!sorted.length) return null;
  const top = sorted[0] || {};
  const className = String(top.className || "").trim();
  const probability = typeof top.probability === "number" ? top.probability : 0;
  const confidence = (Math.max(0, Math.min(1, probability)) * 100).toFixed(2);
  const meta = animalData[className] || {
    emoji: "❓",
    kor: className || "알 수 없음",
    en: className || "Unknown",
    korDesc: "",
    enDesc: ""
  };
  return {
    name: lang === "en" ? meta.en : meta.kor,
    desc: lang === "en" ? meta.enDesc : meta.korDesc,
    emoji: meta.emoji,
    score: confidence,
  };
}

export {
  DEFAULT_ANIMAL_DATA,
  toSortedPredictions,
  buildAnimalFaceResult,
};
