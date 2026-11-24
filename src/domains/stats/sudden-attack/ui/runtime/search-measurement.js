import { requestFailureCode } from '../../../../shared/http-request.js';

const SOURCES = new Set(['network', 'fresh_cache', 'stale_cache']);
const ENTRIES = new Set(['input_button', 'input_enter', 'recent', 'favorite', 'direct_link', 'history', 'in_page', 'refresh']);
const safe = (fn) => (...args) => { try { return fn(...args); } catch { return undefined; } };
const noop = Object.freeze({ queryState() {}, rendered() {}, complete() {}, revalidated() {}, fail() {} });

export function searchMeasurementError(error) {
  if (error?.name === 'AbortError' || requestFailureCode(error) === 'REQUEST_ABORTED') return 'cancelled';
  if (error?.message === 'TEST_KEY_LIMITATION') return 'permission';
  return ({ REQUEST_TIMEOUT: 'timeout', NETWORK_ERROR: 'network', INVALID_RESPONSE: 'invalid_response',
    HTTP_ERROR: 'http', RATE_LIMITED: 'rate_limited', PLAYER_NOT_FOUND: 'not_found',
    PERMISSION_DENIED: 'permission' })[requestFailureCode(error)] || 'unknown';
}

// UI observation only: never delays, cancels or retries the underlying search.
export function createSearchMeasurement({ windowRef, documentRef, getAnalytics,
  now = () => windowRef.performance.now() }) {
  let active = null;
  const visible = () => documentRef.visibilityState === 'visible';
  const current = (op) => active === op && !op.closed && op.isCurrent();
  const elapsed = (op) => Math.max(0, now() - op.startedAt);

  function emit(op, name, fields) {
    try { op.client.track(name, { entry_point: op.entry, ...fields }, op.context); } catch { /* Best effort. */ }
  }
  function clearExposure(op) {
    if (op.exposureTimer !== null) windowRef.clearTimeout(op.exposureTimer);
    op.exposureTimer = null;
  }
  function cleanup(op) {
    if (op.frame !== null) windowRef.cancelAnimationFrame(op.frame);
    op.frame = null;
    clearExposure(op);
    op.observer?.disconnect();
    op.observer = null;
  }
  function finish(op, outcome, revalidation, errorCode) {
    if (op.finished) return;
    op.finished = true;
    emit(op, 'sa_search_finish', { outcome, result_shown: op.shown ? 1 : 0,
      result_source: op.shown ? op.paintedSource : 'none', revalidation,
      duration_ms: elapsed(op), ...(['failure', 'partial'].includes(outcome) ? { error_code: errorCode } : {}) });
  }
  function flushFinish(op) {
    if (!current(op) || op.finished || !op.settlement) return;
    const { outcome, revalidation, errorCode } = op.settlement;
    if (['success', 'partial'].includes(outcome) && (!op.shown || op.pendingPaint)) return;
    finish(op, outcome, revalidation, errorCode);
  }
  function expose(op) {
    if (!current(op) || op.summarySent || !op.shown || !visible() || op.ratio < 0.5 || !op.target?.isConnected) {
      clearExposure(op);
      return;
    }
    if (op.exposureTimer !== null) return;
    op.exposureTimer = windowRef.setTimeout(safe(() => {
      op.exposureTimer = null;
      if (!current(op) || op.summarySent || !visible() || op.ratio < 0.5 || !op.target?.isConnected) return;
      op.summarySent = true;
      emit(op, 'sa_summary_view', {});
      op.observer?.disconnect();
    }), 1000);
  }
  function observeSummary(op, target) {
    clearExposure(op);
    op.observer?.disconnect();
    op.observer = null;
    op.target = target;
    op.ratio = 0;
    if (op.summarySent || !target || typeof windowRef.IntersectionObserver !== 'function') return;
    const observer = new windowRef.IntersectionObserver(safe((entries) => {
      if (!current(op) || op.observer !== observer) return;
      for (const entry of entries) if (entry.target === op.target) {
        op.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
      }
      expose(op);
    }), { threshold: [0, 0.5] });
    op.observer = observer;
    observer.observe(target);
  }
  function schedulePaint(op) {
    if (!current(op) || !op.pendingPaint || !visible() || op.frame !== null) return;
    const revision = op.revision;
    op.frame = windowRef.requestAnimationFrame(safe(() => {
      op.frame = null;
      if (!current(op) || revision !== op.revision || !visible()) return;
      op.frame = windowRef.requestAnimationFrame(safe(() => {
        op.frame = null;
        if (!current(op) || revision !== op.revision || !visible()) return;
        op.pendingPaint = false;
        op.paintedSource = op.renderSource;
        if (!op.shown) {
          op.shown = true;
          emit(op, 'sa_search_first_result', { result_source: op.paintedSource, duration_ms: elapsed(op) });
        }
        expose(op);
        flushFinish(op);
      }));
    }));
  }
  function close(outcome) {
    if (!active) return;
    const op = active;
    finish(op, outcome, op.revalidating ? 'interrupted' : 'not_needed');
    op.closed = true;
    cleanup(op);
    active = null;
  }
  const rendered = safe((source, target) => {
    const op = active;
    if (!op || !current(op) || !SOURCES.has(source)) return;
    // A re-render can replace the observed DOM, but is not a new search.
    if (op.frame !== null) windowRef.cancelAnimationFrame(op.frame);
    op.frame = null;
    op.revision += 1;
    op.renderSource = source;
    op.pendingPaint = true;
    observeSummary(op, target);
    schedulePaint(op);
  });
  const start = safe((entry, isCurrent) => {
    close('superseded');
    const client = getAnalytics();
    if (!client || !ENTRIES.has(entry)) return noop;
    const op = { client, context: client.createContext(), entry, isCurrent, startedAt: now(),
      shown: false, finished: false, closed: false, revalidating: false, settlement: null,
      frame: null, revision: 0, pendingPaint: false, paintedSource: 'none',
      observer: null, exposureTimer: null, ratio: 0, target: null, summarySent: false };
    active = op;
    emit(op, 'sa_search_start', {});
    const settle = (outcome, revalidation, errorCode) => {
      if (!current(op) || op.finished || op.settlement) return;
      op.settlement = { outcome, revalidation, errorCode };
      flushFinish(op);
    };
    return {
      queryState: safe((state) => { if (current(op) && state?.revalidating) op.revalidating = true; }),
      rendered: safe((source, target) => { if (current(op)) rendered(source, target); }),
      complete: safe(() => settle('success', 'not_needed')),
      revalidated: safe((error) => {
        if (!current(op)) return;
        if (error && searchMeasurementError(error) === 'cancelled') { close('cancelled'); return; }
        settle(error ? 'partial' : 'success', error ? 'failure' : 'success', error ? searchMeasurementError(error) : undefined);
      }),
      fail: safe((error) => {
        const code = searchMeasurementError(error);
        if (code === 'cancelled') { if (current(op)) close('cancelled'); return; }
        settle('failure', 'not_needed', code);
      }),
    };
  });
  documentRef.addEventListener('visibilitychange', safe(() => {
    if (!active) return;
    clearExposure(active);
    if (!visible()) {
      if (active.frame !== null) windowRef.cancelAnimationFrame(active.frame);
      active.frame = null;
      return;
    }
    // Re-observe to get a fresh intersection after returning from a hidden tab.
    if (active.observer && active.target) {
      active.ratio = 0;
      active.observer.unobserve(active.target);
      active.observer.observe(active.target);
    }
    schedulePaint(active);
  }));
  windowRef.addEventListener('pagehide', safe(() => close('cancelled')));
  return { start: (...args) => start(...args) || noop, rendered,
    supersede: safe(() => close('superseded')), cancel: safe(() => close('cancelled')) };
}
