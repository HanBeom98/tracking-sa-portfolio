import test from "node:test";
import assert from "node:assert/strict";
import { createFortuneCopy } from "../../src/domains/fortune/application/fortune-copy.js";

test("fortune copy resolves keys through translator", () => {
  const copy = createFortuneCopy((key) => `tr:${key}`);
  assert.equal(copy.name, "tr:name_label");
  assert.equal(copy.check, "tr:check_fortune_button");
  assert.equal(copy.tooManyRequests, "tr:saju_too_many_requests");
});

test("fortune copy falls back to defaults when translation missing", () => {
  const copy = createFortuneCopy((_, fallback) => fallback);
  assert.equal(copy.placeholder, "이름을 입력하세요");
  assert.equal(copy.apiError, "운세 확인 실패. 잠시 후 다시 시도해주세요.");
});
