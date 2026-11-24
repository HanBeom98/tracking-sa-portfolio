export function createPublicSearchLoading({ loading, loadingProgress, loadingProgressBar, loadingHint }) {
  let loadingProgressTimer = null;
  let loadingProgressStartedAt = 0;
  let loadingRunId = 0;

  function setLoadingProgress(value, hint) {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));
    if (loadingProgressBar) loadingProgressBar.style.width = `${safeValue}%`;
    loadingProgress?.setAttribute('aria-valuenow', String(safeValue));
    if (loadingHint && hint) loadingHint.textContent = hint;
  }

  function stopLoadingProgress() {
    if (loadingProgressTimer) window.clearInterval(loadingProgressTimer);
    loadingProgressTimer = null;
  }

  function startLoadingProgress() {
    stopLoadingProgress();
    loadingRunId += 1;
    loadingProgressStartedAt = Date.now();
    setLoadingProgress(8, '플레이어 정보를 확인하고 있어요.');
    loadingProgressTimer = window.setInterval(() => {
      const elapsed = Date.now() - loadingProgressStartedAt;
      if (elapsed < 1800) setLoadingProgress(34, '최근 경기 데이터를 불러오고 있어요.');
      else if (elapsed < 4200) setLoadingProgress(62, '최근 20경기의 주요 지표를 분석하고 있어요.');
      else if (elapsed < 8000) setLoadingProgress(82, '결과 화면을 정리하고 있어요.');
      else setLoadingProgress(90, '데이터가 많아 조금 더 걸리고 있어요.');
    }, 700);
  }

  function finishLoading() {
    const runId = loadingRunId;
    stopLoadingProgress();
    setLoadingProgress(100, '분석이 완료됐어요. 결과를 표시합니다.');
    window.setTimeout(() => {
      if (runId === loadingRunId) loading.classList.add('hidden');
    }, 280);
  }

  if (loading) {
    new MutationObserver(() => {
      if (loading.classList.contains('hidden')) {
        stopLoadingProgress();
        window.setTimeout(() => setLoadingProgress(8, '플레이어 정보를 확인하고 있어요.'), 250);
      } else {
        startLoadingProgress();
      }
    }).observe(loading, { attributes: true, attributeFilter: ['class'] });
  }

  function begin() {
    loadingRunId += 1;
  }

  function reset() {
    loadingRunId += 1;
    stopLoadingProgress();
  }

  return { begin, reset, finishLoading };
}
