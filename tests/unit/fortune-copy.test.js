import test from "node:test";
import assert from "node:assert/strict";
import { createFortuneCopy } from "../../src/domains/fortune/application/fortune-copy.js";

test("fortune copy resolves keys through translator", () => {
  const copy = createFortuneCopy((key) => `tr:${key}`);
  assert.equal(copy.name, "tr:name");
  assert.equal(copy.check, "tr:get_saju_reading");
  assert.equal(copy.tooManyRequests, "tr:saju_too_many_requests");
});

test("fortune copy falls back to defaults when translation missing", () => {
  const copy = createFortuneCopy((_, fallback) => fallback);
  assert.equal(copy.placeholder, "이름을 입력하세요");
  assert.equal(copy.apiError, "사주 풀이 실패. 잠시 후 다시 시도해주세요.");
});
