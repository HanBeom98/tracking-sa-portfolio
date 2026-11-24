import { validatePurchaseHistory } from '../domain/replay-purchase-history-response.js?v=f99b867850e9';

// Explicit read actions only. Responses/pagination never cross account changes,
// and no balance or purchase history is persisted in browser storage.
export function createReplayPurchaseHistorySession({ getUser, send, onChange = () => {} } = {}) {
  let observedUid = getUser()?.uid || null, data = null, state = 'idle', revision = 0, abort = null, disposed = false;
  const uid = () => getUser()?.uid || null;
  function view() {
    const current = uid() === observedUid && Boolean(uid());
    return { state: !uid() ? 'signed_out' : !current ? 'idle' : state,
      data: current && data ? structuredClone(data) : null,
      canRefresh: current && state !== 'loading', canNext: current && state !== 'loading' && Boolean(data?.nextCursor) };
  }
  const publish = () => { if (!disposed) onChange(view()); };
  function authChanged() {
    if (disposed || uid() === observedUid) return;
    revision++; abort?.abort(); abort = null; observedUid = uid(); data = null; state = 'idle'; publish();
  }
  return {
    view, authChanged,
    dispose() { disposed = true; revision++; abort?.abort(); abort = null; data = null; },
    async request(action = 'refresh') {
      if (disposed) return;
      authChanged(); const before = view();
      if (action === 'refresh' ? !before.canRefresh : action !== 'next' || !before.canNext) return;
      const user = getUser(), requestUid = user.uid, turn = ++revision, cursor = action === 'next' ? { ...data.nextCursor } : null;
      const current = () => !disposed && turn === revision && uid() === requestUid;
      abort = new AbortController(); const signal = abort.signal;
      data = null; state = 'loading'; publish();
      try {
        const token = await user.getIdToken(); if (!current()) return;
        const result = await send({ action: 'history', cursor }, token, signal); if (!current()) return;
        if (result.status !== 200) {
          state = result.status === 401 && result.body?.error === 'UNAUTHENTICATED' ? 'auth_required' : 'error'; return;
        }
        const response = validatePurchaseHistory(result.body);
        // Reject stale/non-advancing pages even if the server shape is valid.
        if (cursor && response.orders.some(o => o.createdAt > cursor.createdAt
          || o.createdAt === cursor.createdAt && o.orderId >= cursor.orderId)) throw Error('INVALID_HISTORY_PAGE');
        data = response; state = response.orders.length ? 'ready' : 'empty';
      } catch { if (current()) state = 'error'; }
      finally { if (current()) { abort = null; publish(); } else if (!disposed) authChanged(); }
    },
  };
}
