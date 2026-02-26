import { AI_TEST_MODELS } from "./ai-test-data.js";

export function sumAiTestScores(answers) {
  return (answers || []).reduce((sum, value) => sum + Number(value || 0), 0);
}

export function resolveAiTestResultIndex(totalScore, questionCount, modelCount = AI_TEST_MODELS.length) {
  const safeQuestionCount = Math.max(1, Number(questionCount) || 1);
  const safeModelCount = Math.max(1, Number(modelCount) || 1);
  const maxScore = safeQuestionCount * 3;
  const normalized = Math.max(0, Math.min(Number(totalScore) || 0, maxScore));
  return Math.min(Math.floor((normalized / (maxScore + 1)) * safeModelCount), safeModelCount - 1);
}

export function resolveAiTestModel(answers, questions = [], models = AI_TEST_MODELS) {
  const totalScore = sumAiTestScores(answers);
  const resultIndex = resolveAiTestResultIndex(totalScore, questions.length, models.length);
  return models[resultIndex];
}
