import { searchMeasurementError } from './search-measurement.js';

const safe = fn => (...args) => { try { return fn(...args); } catch { return undefined; } };
const noop = Object.freeze({ success() {}, fail() {}, samePlayer() {}, finish() {} });
const sources = new Set(['network', 'fresh_cache', 'stale_cache']);

export function createActionMeasurement({ windowRef, getAnalytics, now = () => windowRef.performance.now() }) {
  let activeVs = null;
  function operation() {
    const client = getAnalytics();
    if (!client) return null;
    return { client, context: client.createContext(), startedAt: now(), finished: false };
  }
  function emit(op, name, fields) {
    try { op.client.track(name, fields, op.context); } catch { /* Measurement is optional. */ }
  }
  function endVs(op, outcome, resultSource = 'none', errorCode) {
    if (op.finished) return;
    op.finished = true;
    if (activeVs === op) activeVs = null;
    emit(op, 'sa_vs_finish', { vs_source: op.source, outcome, result_source: resultSource,
      duration_ms: Math.max(0, now() - op.startedAt), ...(outcome === 'failure' ? { error_code: errorCode } : {}) });
  }
  const closeVs = safe(outcome => { if (activeVs) endVs(activeVs, outcome); });
  const startVs = safe((source, isCurrent) => {
    closeVs('superseded');
    if (!['modal', 'favorite_chip'].includes(source)) return noop;
    const op = operation();
    if (!op) return noop;
    op.source = source;
    activeVs = op;
    emit(op, 'sa_vs_start', { vs_source: source });
    const current = () => activeVs === op && !op.finished && isCurrent();
    return {
      success: safe(resultSource => { if (current() && sources.has(resultSource)) endVs(op, 'success', resultSource); }),
      samePlayer: safe(() => { if (current()) endVs(op, 'failure', 'none', 'same_player'); }),
      fail: safe(error => {
        if (!current()) return;
        const code = searchMeasurementError(error);
        endVs(op, code === 'cancelled' ? 'cancelled' : 'failure', 'none', code);
      }),
    };
  });
  const favoriteChanged = safe((source, before, after) => {
    if (!['result_button', 'favorite_chip'].includes(source) || typeof before !== 'boolean' || typeof after !== 'boolean' || before === after) return;
    const op = operation();
    if (op) emit(op, 'sa_favorite_change', { action: after ? 'add' : 'remove', action_source: source, persistence: 'unknown' });
  });
  const startShare = safe(source => {
    if (!['image_button', 'link_button'].includes(source)) return noop;
    const op = operation();
    if (!op) return noop;
    emit(op, 'sa_share_start', { share_source: source });
    return { finish: safe((method, outcome, error) => {
      if (op.finished) return;
      op.finished = true;
      const code = outcome === 'failure' ? searchMeasurementError(error) : undefined;
      emit(op, 'sa_share_finish', { share_source: source, method, outcome, duration_ms: Math.max(0, now() - op.startedAt),
        ...(outcome === 'failure' ? { error_code: code === 'cancelled' ? 'unknown' : code } : {}) });
    }) };
  });
  windowRef.addEventListener('pagehide', () => closeVs('cancelled'));
  return { favoriteChanged, startVs: (...args) => startVs(...args) || noop,
    startShare: (...args) => startShare(...args) || noop,
    supersedeVs: () => closeVs('superseded'), cancelVs: () => closeVs('cancelled') };
}
