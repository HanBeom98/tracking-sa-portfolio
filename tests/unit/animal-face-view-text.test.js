import test from "node:test";
import assert from "node:assert/strict";
import { buildAnimalFaceViewText } from "../../src/domains/animal-face/application/view-text.js";

test("animal-face view text maps expected core labels", () => {
  const text = buildAnimalFaceViewText((key) => `tr:${key}`);
  assert.equal(text.h1, "tr:animal_face_test_h1");
  assert.equal(text.shareTitle, "tr:share_result");
  assert.equal(text.download, "tr:download_result");
});

test("animal-face view text falls back when translation key missing", () => {
  const text = buildAnimalFaceViewText((_, fallback) => fallback);
  assert.equal(text.gender, "성별을 선택해 주세요");
  assert.equal(text.analyzing, "AI가 당신의 얼굴을 분석 중입니다...");
});
