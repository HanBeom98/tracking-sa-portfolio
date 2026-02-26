import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnimalFaceResult,
  toSortedPredictions,
} from "../../src/domains/animal-face/application/animal-face-result.js";

test("animal-face result sorts predictions by probability", () => {
  const sorted = toSortedPredictions([
    { className: "고양이", probability: 0.2 },
    { className: "강아지", probability: 0.9 },
  ]);
  assert.equal(sorted[0].className, "강아지");
});

test("animal-face result resolves emoji/name/score from top prediction", () => {
  const result = buildAnimalFaceResult([
    { className: "고양이", probability: 0.82 },
    { className: "강아지", probability: 0.11 },
  ]);
  assert.equal(result.name, "고양이상");
  assert.equal(result.emoji, "🐱");
  assert.equal(result.score, "82.00");
});

test("animal-face result returns fallback for unknown class", () => {
  const result = buildAnimalFaceResult([{ className: "알수없음", probability: 0.55 }]);
  assert.equal(result.name, "알수없음");
  assert.equal(result.emoji, "❓");
  assert.equal(result.score, "55.00");
});
