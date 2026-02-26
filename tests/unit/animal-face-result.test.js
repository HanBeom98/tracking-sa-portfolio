import test from "node:test";
import assert from "node:assert/strict";
import { toSortedPredictions, buildAnimalFaceResult } from "../../src/domains/animal-face/application/animal-face-result.js";

test("animal-face result sorts predictions by probability", () => {
  const predictions = [
    { className: "cat", probability: 0.1 },
    { className: "dog", probability: 0.9 },
  ];
  const sorted = toSortedPredictions(predictions);
  assert.equal(sorted[0].className, "dog");
  assert.equal(sorted[1].className, "cat");
});

test("animal-face result resolves emoji/name/score from top prediction", () => {
  const predictions = [
    { className: "강아지", probability: 0.95678 },
  ];
  const result = buildAnimalFaceResult(predictions);
  assert.equal(result.name, "강아지상");
  assert.equal(result.emoji, "🐶");
  assert.equal(result.score, "95.68");
});

test("animal-face result returns fallback for unknown class", () => {
  const predictions = [
    { className: "dragon", probability: 0.5 },
  ];
  const result = buildAnimalFaceResult(predictions);
  assert.equal(result.name, "dragon");
  assert.equal(result.emoji, "❓");
});
