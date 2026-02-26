import test from "node:test";
import assert from "node:assert/strict";
import { getAiTestProgressPercent, isAiTestResultStep } from "../../src/domains/ai-test/application/ai-test-progress.js";

test("ai-test progress percent is clamped by total questions", () => {
  assert.equal(getAiTestProgressPercent(0, 5), 0);
  assert.equal(getAiTestProgressPercent(2, 5), 40);
  assert.equal(getAiTestProgressPercent(9, 5), 100);
});

test("ai-test result step check matches question boundary", () => {
  assert.equal(isAiTestResultStep(4, 5), false);
  assert.equal(isAiTestResultStep(5, 5), true);
});
