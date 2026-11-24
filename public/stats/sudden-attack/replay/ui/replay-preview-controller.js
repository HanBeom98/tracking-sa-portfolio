import { isLocalCoachingTest } from '../domain/replay-local-mode.js?v=761b6d62adab';
import { resolvePlaybackReviewTarget } from '../domain/replay-playback.js?v=bc9d6a4e5b8c';

// Explicit local opt-in only. The controller owns subscriptions, request history
// and scene references for its page lifetime, never the production free path.
export function createReplayPreviewController({ results, shell, location, getAnalysis, getPlayback, scrollBehavior }, {
  loadCoaching = () => import('./replay-coaching-local.js?v=304684487acf'),
  loadPurchase = () => import('./replay-purchase-flow.js?v=72d741623e8f'),
  loadEngine = () => import('../domain/replay-coaching-review.js?v=cba755e80115'),
  loadReview = () => import('./replay-review-panel.js?v=8bfeb31f3616'),
  loadApi = () => import('./replay-review-api.js?v=b18d804b5470'),
} = {}) {
  const query = new URLSearchParams(location.search);
  const reviewEnabled = location.origin === 'http://127.0.0.1:4173' && query.get('coaching') === 'review';
  const requests = new Map(), playbackTargets = new Map();
  let disposed = false, revision = 0, coaching = null, reviewUi = null;
  let releaseReview = null, releasePurchase = null;
  const current = (ticket, source) => !disposed && revision === ticket && getAnalysis() === source && !results.classList.contains('hidden');
  if (isLocalCoachingTest(location)) {
    void loadCoaching().then(({ createLocalReplayCoachingPanel }) => {
      if (disposed) return;
      coaching = createLocalReplayCoachingPanel(results, location);
      const analysis = getAnalysis();
      if (analysis && !results.classList.contains('hidden')) coaching?.setEvidence(analysis.coachingEvidence);
    }).catch(() => { /* Optional mock failure leaves free analysis usable. */ });
  }
  if (reviewEnabled && query.get('transport') === 'api' && query.get('purchase') === 'flow') {
    void loadPurchase().then(ui => {
      if (!disposed) releasePurchase = ui.mountReplayPurchaseFlow(shell, location);
    }).catch(() => {});
  }
  function clearReview() {
    revision++; playbackTargets.clear(); reviewUi = null;
    const release = releaseReview; releaseReview = null; release?.();
    results.querySelector('#replayReviewPreview')?.remove();
  }
  async function show(analysis, playbackModel) {
    coaching?.setEvidence(analysis.coachingEvidence);
    if (!reviewEnabled || disposed || getAnalysis() !== analysis) return;
    const ticket = ++revision;
    try {
      const [engine, ui] = await Promise.all([loadEngine(), loadReview()]);
      if (!current(ticket, analysis) || !ui.isLocalReviewPreview(location)) return;
      reviewUi = ui;
      const review = engine.buildReplayCoachingReview(analysis);
      for (const candidate of review.candidates) {
        const target = resolvePlaybackReviewTarget(playbackModel, candidate, analysis.player.nexonSN);
        if (target) playbackTargets.set(candidate.evidenceId, target);
      }
      const playbackRefs = new Set(playbackTargets.keys());
      results.insertAdjacentHTML('beforeend', ui.renderReplayReviewPanel(review));
      const panel = results.querySelector('#replayReviewPreview');
      if (query.get('transport') === 'api') {
        const apiUi = await loadApi();
        if (!current(ticket, analysis)) return;
        releaseReview = apiUi.mountReplayReviewApi(panel, review, { location, records: requests, playbackRefs });
      } else releaseReview = ui.mountReplayReviewResult(panel, review, { playbackRefs });
    } catch { /* Preview failure leaves free analysis usable. */ }
  }
  return { show, clearReview,
    clear() { clearReview(); coaching?.clear(); },
    jumpToReview(round) {
      if (!disposed && reviewEnabled) reviewUi?.focusReplayReviewAnchor(results, Number(round), scrollBehavior);
    },
    jumpToPlayback(evidenceId) {
      if (disposed || !reviewEnabled) return;
      const target = playbackTargets.get(evidenceId);
      if (target && getPlayback()?.seekToScene(target)) {
        const panel = results.querySelector('#replayPlayback');
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      }
    },
    dispose() {
      disposed = true; clearReview(); coaching?.dispose(); coaching = null;
      const release = releasePurchase; releasePurchase = null; release?.(); requests.clear();
    },
  };
}
