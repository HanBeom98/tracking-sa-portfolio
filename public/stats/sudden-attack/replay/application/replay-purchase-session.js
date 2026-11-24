import { purchaseOrderId, validatePurchaseEnvelope } from '../domain/replay-purchase-response.js?v=3c61e3cf2182';
const errorStates = new Map([
  ['UNAUTHENTICATED', 'auth_required'], ['CREDIT_PURCHASE_DISABLED', 'disabled'], ['CHECKOUT_DISABLED', 'disabled'],
  ['CHECKOUT_NOT_CONFIGURED', 'disabled'], ['CREDIT_PRODUCT_NOT_CONFIGURED', 'disabled'],
  ['ORDER_NOT_FOUND', 'not_found'], ['ORDER_TERMS_CHANGED', 'terms_changed'], ['ORDER_CONFLICT', 'conflict'],
  ['PURCHASE_ACKNOWLEDGEMENT_REQUIRED', 'acknowledgement_required'],
  ['ORDER_EXPIRED', 'expired'], ['ORDER_ACCOUNT_UNAVAILABLE', 'account_unavailable'],
  ['ORDER_OPEN_LIMIT', 'limit'], ['ORDER_DAILY_LIMIT', 'limit'], ['CREDIT_CAPACITY', 'limit'],
  ['CHECKOUT_UNRESOLVED', 'unknown'], ['ORDER_CHECKOUT_UNRESOLVED', 'unknown'],
  ['CHECKOUT_PAYMENT_UNCONFIRMED', 'unconfirmed'], ['PAYMENT_FULFILLMENT_UNRESOLVED', 'fulfillment_pending'],
]);

// One owner-bound order pointer survives navigation. No token/payment URL,
// result, price or consent is persisted. Every action is an explicit user action.
export function createReplayPurchaseSession({ getUser, send, uuid, readPointer, writePointer, clearPointer,
  returnOrderId = null, invalidReturn = false, returning = false, onChange = () => {} } = {}) {
  let observedUid = null, orderId = null, order = null, product = null, paymentEnabled = false, accepted = false;
  let state = 'idle', checkoutPage = null, revision = 0, disposed = false, abort = null, storageBlocked = false;
  const uid = () => getUser()?.uid || null;
  const busy = () => state === 'pending';
  function adoptIdentity() {
    observedUid = uid(); order = null; product = null; paymentEnabled = false; accepted = false; checkoutPage = null; storageBlocked = false;
    orderId = null; state = invalidReturn ? 'invalid_return' : 'idle';
    if (!observedUid) return;
    if (invalidReturn) return;
    if (returnOrderId !== null) { orderId = returnOrderId; state = 'restore'; return; }
    try {
      const saved = readPointer(observedUid);
      if (saved !== null && !purchaseOrderId(saved)) throw Error('INVALID_POINTER');
      orderId = saved; if (saved) state = 'restore'; else if (returning) state = 'missing_return';
    } catch { storageBlocked = true; state = 'storage_unavailable'; }
  }
  function view() {
    const current = uid() === observedUid && Boolean(uid()), ready = current && !busy() && !invalidReturn && !(returning && !orderId);
    const pendingOrder = current && order?.status === 'pending' && ['reserved', 'dispatching', 'uncertain'].includes(order.checkoutState);
    return { state: !uid() ? 'signed_out' : !current ? 'idle' : state,
      order: current && order ? structuredClone(order) : null, product: current && product ? structuredClone(product) : null,
      orderId: current ? orderId : null, checkoutPage: current ? checkoutPage : null, accepted: current && accepted,
      canLoad: ready, canCreate: ready && !storageBlocked && product !== null && paymentEnabled && accepted
        && order === null && returnOrderId === null && !returning,
      canLookup: ready && Boolean(orderId), canCheckout: ready && pendingOrder && order.paymentEnabled,
      canComplete: ready && pendingOrder && order.checkoutState !== 'reserved' && order.paymentEnabled,
      canCancel: ready && pendingOrder && order.checkoutState === 'reserved',
      canReset: current && !busy() && (invalidReturn || state === 'not_found' && returnOrderId !== null || order?.status === 'paid' || order?.checkoutState === 'closed') };
  }
  const publish = () => { if (!disposed) onChange(view()); };
  function authChanged() {
    if (disposed || uid() === observedUid) return;
    revision++; abort?.abort(); abort = null; adoptIdentity(); publish();
  }
  adoptIdentity();
  return {
    view, authChanged,
    accept(value) { if (!disposed && !busy()) { accepted = value === true; publish(); } },
    reset() {
      if (!view().canReset || disposed) return false;
      if (invalidReturn || state === 'not_found' && returnOrderId !== null) { invalidReturn = false; returnOrderId = null; returning = false; adoptIdentity(); publish(); return true; }
      try { clearPointer(uid()); } catch { state = 'storage_unavailable'; publish(); return false; }
      revision++; returnOrderId = null; invalidReturn = false; returning = false; orderId = null; order = null; checkoutPage = null;
      accepted = false; storageBlocked = false; state = 'idle'; publish(); return true;
    },
    dispose() { disposed = true; revision++; abort?.abort(); order = null; product = null; checkoutPage = null; },
    async request(action) {
      if (disposed) return;
      authChanged(); const before = view();
      const allowed = { product: before.canLoad, create: before.canCreate, get: before.canLookup,
        checkout: before.canCheckout, complete: before.canComplete, cancel: before.canCancel };
      if (!allowed[action]) return;
      const user = getUser(), requestUid = user.uid, turn = ++revision;
      abort = new AbortController(); const signal = abort.signal;
      const current = () => !disposed && turn === revision && uid() === requestUid;
      state = 'pending'; checkoutPage = null; publish();
      try {
        const token = await user.getIdToken(); if (!current()) return;
        if (action === 'create') {
          if (!orderId) { const next = uuid(); if (!purchaseOrderId(next)) throw Error('INVALID_ORDER_ID'); orderId = next; }
        }
        if (['create', 'checkout', 'complete'].includes(action)) {
          // Persist BEFORE sending a mutating request or leaving for checkout.
          try { writePointer(requestUid, orderId); storageBlocked = false; }
          catch { storageBlocked = true; state = 'storage_unavailable'; return; }
        }
        const body = action === 'product' ? { action } : { action, orderId, ...(action === 'create' ? {
          termsVersion: product.termsVersion, acknowledgement: { accepted: true, version: product.disclosure.version, digest: product.disclosure.digest } } : {}) };
        const result = await send(body, token, signal); if (!current()) return;
        if (result.status !== 200) {
          const b = result.body, code = b && Object.keys(b).length === 1 && typeof b.error === 'string' ? b.error : '';
          if (['ORDER_TERMS_CHANGED', 'PURCHASE_ACKNOWLEDGEMENT_REQUIRED'].includes(code)) {
            accepted = false; product = null; paymentEnabled = false;
          }
          state = errorStates.get(code) || 'unknown'; return;
        }
        const response = validatePurchaseEnvelope(result.body, action, orderId);
        if (action === 'create') {
          const r = response.order.acknowledgement, d = product.disclosure;
          if (!r || response.order.termsVersion !== product.termsVersion
            || ['purpose', 'version', 'title', 'text', 'digest'].some(k => r[k] !== d[k])) throw Error('INVALID_ACKNOWLEDGEMENT_RECEIPT');
        }
        if (action === 'product') {
          product = response.product; paymentEnabled = response.paymentEnabled; accepted = false;
          state = storageBlocked ? 'storage_unavailable' : paymentEnabled ? 'product_ready' : 'disabled';
        } else {
          order = response.order;
          state = order.status === 'paid' ? 'funded' : order.checkoutState === 'closed' ? 'closed'
            : response.outcome || (action === 'get' ? 'order_found' : 'order_created');
          checkoutPage = response.checkoutPage || null;
        }
      } catch {
        if (current()) state = orderId ? 'unknown' : 'auth_required';
      } finally {
        if (current()) { abort = null; publish(); } else if (!disposed) authChanged();
      }
    },
  };
}
