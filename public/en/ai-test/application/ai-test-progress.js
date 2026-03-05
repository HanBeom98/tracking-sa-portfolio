export function isAiTestResultStep(currentStep, totalQuestions) {
  return Number(currentStep) >= Number(totalQuestions);
}

export function getAiTestProgressPercent(currentStep, totalQuestions) {
  const total = Math.max(1, Number(totalQuestions) || 1);
  const step = Math.max(0, Math.min(Number(currentStep) || 0, total));
  return (step / total) * 100;
}
