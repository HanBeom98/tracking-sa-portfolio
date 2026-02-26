import test from "node:test";
import assert from "node:assert/strict";
import { createLuckyCopy } from "../../src/domains/lucky-recommendation/application/lucky-copy.js";

test("lucky copy maps translation keys", () => {
  const copy = createLuckyCopy((key) => `tr:${key}`);
  assert.equal(copy.birth, "tr:lucky_birth_md_label");
  assert.equal(copy.check, "tr:lucky_check_button");
  assert.equal(copy.luckyColor, "tr:lucky_color_label");
});

test("lucky copy falls back to Korean defaults", () => {
  const copy = createLuckyCopy((_, fallback) => fallback);
  assert.equal(copy.loadingTitle, "AI가 오늘의 행운 추천을 찾고 있습니다...");
  assert.equal(copy.errorMessage, "행운 분석에 실패했습니다.");
});
