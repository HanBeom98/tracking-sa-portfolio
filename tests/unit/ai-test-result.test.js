import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveAiTestModel,
  resolveAiTestResultIndex,
  sumAiTestScores,
} from "../../src/domains/ai-test/application/ai-test-result.js";
import { AI_TEST_MODELS, AI_TEST_QUESTIONS } from "../../src/domains/ai-test/application/ai-test-data.js";

test("ai-test score sum handles numeric and string values", () => {
  assert.equal(sumAiTestScores([3, "2", 1, 0]), 6);
});

test("ai-test result index stays in model range", () => {
  const qCount = AI_TEST_QUESTIONS.length;
  assert.equal(resolveAiTestResultIndex(0, qCount, 4), 0);
  assert.equal(resolveAiTestResultIndex(15, qCount, 4), 3);
});

test("ai-test model resolver returns model for high score", () => {
  const model = resolveAiTestModel([3, 3, 3, 3, 3], AI_TEST_QUESTIONS, AI_TEST_MODELS);
  assert.equal(model.name, "Llama 3");
});
