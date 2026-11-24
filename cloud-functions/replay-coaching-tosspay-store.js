const { PRODUCT, fail, hash, owner, id, validTime, validateOrder, orderRef, refundRef } = require('./replay-coaching-credits.js');
const { hasDuration, validDays, sameOrderTerms, orderTerms } = require('./replay-coaching-validity.js');
const { hasAck, validIdentity } = require('./replay-coaching-acknowledgement.js');
const check = (v, code = 'TOSSPAY_BINDING_INVALID') => { if (!v) fail(code, 409); };
const refText = v => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,36}$/.test(v);
const token = v => typeof v === 'string' && /^[\x21-\x7e]{1,30}$/.test(v);
const phases = ['prepared', 'dispatching', 'uncertain', 'ready'];
const immutable = ['product', 'quantity', 'amountKRW', 'termsVersion', 'expiresAt', 'createdAt'];
const rootRef = (db, mode, uid) => db.collection('_replay_coaching_users').doc(`tosspay_${mode.toLowerCase()}_v1_${owner(uid)}`);
const childRef = (db, mode, uid, kind, key) => { check(id(key)); return db.collection(`${rootRef(db, mode, uid).path}/${kind}`).doc(key); };
const markerRef = (db, mode, kind, value) => db.collection('_replay_coaching_users').doc(`tosspay_${mode.toLowerCase()}_${kind}_${hash(value)}`);
const externalOrderNo = (mode, uid, orderId) => `tsa_${mode === 'TEST' ? 't' : 'l'}_${hash(`${owner(uid)}:${orderId}`).slice(0, 40)}`;
const externalRefundNo = (mode, uid, orderId, refundId) => `tsa_${mode === 'TEST' ? 't' : 'l'}_${hash(`${owner(uid)}:${orderId}:${refundId}`).slice(0, 28)}`;
function checkoutURL(value, payToken) {
  let u; try { u = new URL(value); } catch { fail('TOSSPAY_BINDING_INVALID', 409); }
  check(u.origin === 'https://pay.toss.im' && !u.username && !u.password && !u.hash && value.length <= 255
    && u.pathname.startsWith('/payfront/') && u.searchParams.getAll('payToken').length === 1 && u.searchParams.get('payToken') === payToken);
  return u.href;
}
function binding(snapshot, mode, uid, orderId) {
  if (!snapshot.exists) fail('TOSSPAY_BINDING_NOT_FOUND', 404);
  const b = snapshot.data();
  check(b && b.schemaVersion === 1 && b.provider === 'tosspay' && b.mode === mode && b.ownerHash === owner(uid)
    && b.orderId === orderId && b.orderNo === externalOrderNo(mode, uid, orderId) && phases.includes(b.stage)
    && validTime(b.savedAt) && b.order && immutable.every(k => Object.hasOwn(b.order, k)));
  check(b.order.product === PRODUCT && Number.isSafeInteger(b.order.amountKRW) && b.order.amountKRW > 0 && Number.isSafeInteger(b.order.quantity)
    && b.order.quantity >= 1 && b.order.quantity <= 50 && b.order.amountKRW % b.order.quantity === 0 && id(b.order.termsVersion)
    && validTime(b.order.createdAt) && (b.order.expiresAt === null || validTime(b.order.expiresAt) && b.order.expiresAt > b.order.createdAt));
  check(!hasDuration(b.order) || validDays(b.order.validDays) && b.order.expiresAt === null);
  check(!hasAck(b.order) || validIdentity(b.order.acknowledgement, b.order.createdAt));
  check(b.stage === 'ready' ? token(b.payToken) && checkoutURL(b.checkoutPage, b.payToken)
    : b.payToken === null && b.checkoutPage === null);
  return b;
}
function refundBinding(snapshot, mode, uid, orderId, refundId) {
  if (!snapshot.exists) fail('TOSSPAY_REFUND_BINDING_NOT_FOUND', 404);
  const r = snapshot.data();
  check(r && r.schemaVersion === 1 && r.mode === mode && r.ownerHash === owner(uid) && r.orderId === orderId && r.refundId === refundId
    && r.refundNo === externalRefundNo(mode, uid, orderId, refundId) && phases.includes(r.stage)
    && Number.isSafeInteger(r.amountKRW) && r.amountKRW > 0 && Number.isSafeInteger(r.quantity) && r.quantity > 0 && r.quantity <= 50
    && /^tosspay:[A-Za-z0-9:_-]{1,36}$/.test(r.paymentReference) && validTime(r.savedAt)
    && (r.stage === 'ready' ? refText(r.transactionReference) : r.transactionReference === null));
  return r;
}

// Private server persistence only. No endpoint, external calls, wallet grants,
// money transfers, timers, queries or automatic cleanup. Mode must be explicit.
function createTossPayBindingStore({ db, enabled = false, mode, now = Date.now } = {}) {
  const gate = () => { if (enabled !== true) fail('TOSSPAY_STORE_DISABLED');
    check(db && typeof db.runTransaction === 'function' && ['TEST', 'LIVE'].includes(mode)); };
  const timestamp = () => { const t = now(); check(validTime(t)); return t; };
  const paymentView = (b, uid) => ({ provider: 'tosspay', mode, uid, orderId: b.orderId, orderNo: b.orderNo,
    amountKRW: b.order.amountKRW, payToken: b.payToken });
  const checkLiveCheckout = async (tx, uid, orderId, b, allowed = ['dispatching', 'uncertain']) => {
    if (mode !== 'LIVE') return;
    const os = await tx.get(orderRef(db, uid, orderId)), o = validateOrder(os.exists ? os.data() : null, uid, orderId);
    check(sameOrderTerms(o, b.order), 'TOSSPAY_ORDER_CONFLICT');
    if (o.checkout) check(o.status === 'pending' && allowed.includes(o.checkout.state), 'TOSSPAY_CHECKOUT_UNRESOLVED');
  };
  return {
    async saveOrder(uid, orderId, serverOrder) {
      gate(); const order = validateOrder(serverOrder, uid, orderId), time = timestamp();
      check(order.expiresAt === null || time < order.expiresAt, 'TOSSPAY_ORDER_EXPIRED');
      const ref = childRef(db, mode, uid, 'payments', orderId);
      return db.runTransaction(async tx => {
        const existing = await tx.get(ref);
        if (mode === 'LIVE') {
          const actual = await tx.get(orderRef(db, uid, orderId));
          const o = validateOrder(actual.exists ? actual.data() : null, uid, orderId);
          check(sameOrderTerms(o, order), 'TOSSPAY_ORDER_CONFLICT');
          check(existing.exists || o.status === 'pending', 'TOSSPAY_ORDER_ALREADY_PAID');
          if (!existing.exists && o.checkout) check(o.checkout.state !== 'closed', 'TOSSPAY_CHECKOUT_UNRESOLVED');
        }
        if (existing.exists) {
          const b = binding(existing, mode, uid, orderId);
          check(sameOrderTerms(b.order, order), 'TOSSPAY_ORDER_CONFLICT');
          return { orderNo: b.orderNo, stage: b.stage, duplicate: true };
        }
        const snapshot = orderTerms(order);
        const b = { schemaVersion: 1, provider: 'tosspay', mode, ownerHash: owner(uid), orderId,
          orderNo: externalOrderNo(mode, uid, orderId), order: snapshot, stage: 'prepared', payToken: null, checkoutPage: null, savedAt: time };
        tx.set(ref, b); return { orderNo: b.orderNo, stage: b.stage, duplicate: false };
      });
    },
    async markPaymentDispatched(uid, orderId) {
      gate(); const ref = childRef(db, mode, uid, 'payments', orderId), time = timestamp();
      return db.runTransaction(async tx => {
        const b = binding(await tx.get(ref), mode, uid, orderId);
        check(b.stage === 'prepared', 'TOSSPAY_CHECKOUT_UNRESOLVED');
        await checkLiveCheckout(tx, uid, orderId, b, ['dispatching']);
        tx.set(ref, { ...b, stage: 'dispatching', dispatchedAt: time });
        return { orderNo: b.orderNo, amountKRW: b.order.amountKRW };
      });
    },
    async markPaymentUncertain(uid, orderId) {
      gate(); const ref = childRef(db, mode, uid, 'payments', orderId);
      return db.runTransaction(async tx => {
        const b = binding(await tx.get(ref), mode, uid, orderId);
        if (b.stage === 'ready' || b.stage === 'uncertain') return;
        check(b.stage === 'dispatching', 'TOSSPAY_CHECKOUT_UNRESOLVED'); tx.set(ref, { ...b, stage: 'uncertain' });
      });
    },
    async attachPayment(uid, orderId, verifiedPayment) {
      gate(); const p = verifiedPayment;
      check(p && p.mode === mode && token(p.payToken)); const checkoutPage = checkoutURL(p.checkoutPage, p.payToken);
      const ref = childRef(db, mode, uid, 'payments', orderId), marker = markerRef(db, mode, 'token', p.payToken);
      return db.runTransaction(async tx => {
        const [bs, ms] = await Promise.all([tx.get(ref), tx.get(marker)]);
        const b = binding(bs, mode, uid, orderId);
        check(p.orderNo === b.orderNo && p.amountKRW === b.order.amountKRW, 'TOSSPAY_ORDER_CONFLICT');
        if (ms.exists) check(ms.data().ownerHash === owner(uid) && ms.data().orderId === orderId, 'TOSSPAY_TOKEN_ALREADY_BOUND');
        if (b.stage === 'ready') {
          check(b.payToken === p.payToken && b.checkoutPage === checkoutPage && ms.exists, 'TOSSPAY_ORDER_CONFLICT');
          return { duplicate: true };
        }
        check(['dispatching', 'uncertain'].includes(b.stage), 'TOSSPAY_CHECKOUT_UNRESOLVED');
        await checkLiveCheckout(tx, uid, orderId, b);
        tx.set(ref, { ...b, stage: 'ready', payToken: p.payToken, checkoutPage });
        tx.set(marker, { schemaVersion: 1, mode, ownerHash: owner(uid), orderId }); return { duplicate: false };
      });
    },
    async loadBinding(uid, orderId) {
      gate(); const ref = childRef(db, mode, uid, 'payments', orderId);
      return db.runTransaction(async tx => {
        const s = await tx.get(ref); if (!s.exists) return null;
        const b = binding(s, mode, uid, orderId); check(b.stage === 'ready', 'TOSSPAY_CHECKOUT_UNRESOLVED');
        return paymentView(b, uid);
      });
    },
    // Owner-scoped server read for checkout orchestration. Never return the raw
    // document to a browser; only the validated Toss URL may be handed off.
    async readCheckout(uid, orderId) {
      gate(); const ref = childRef(db, mode, uid, 'payments', orderId);
      return db.runTransaction(async tx => {
        const s = await tx.get(ref); if (!s.exists) return null;
        const b = binding(s, mode, uid, orderId);
        return { ...paymentView(b, uid), stage: b.stage, checkoutPage: b.checkoutPage };
      });
    },
    async saveRefund(uid, orderId, refundId, serverReservation, paymentReference) {
      gate(); check(id(refundId) && /^tosspay:[A-Za-z0-9:_-]{1,36}$/.test(paymentReference));
      const r = serverReservation, time = timestamp();
      check(r && r.schemaVersion === 1 && r.ownerHash === owner(uid) && r.orderId === orderId && r.refundId === refundId
        && ['reserved', 'settled'].includes(r.status) && Number.isSafeInteger(r.quantity) && r.quantity > 0 && r.quantity <= 50
        && Number.isSafeInteger(r.amountKRW) && r.amountKRW > 0);
      const ref = childRef(db, mode, uid, 'refund_bindings', refundId), bRef = childRef(db, mode, uid, 'payments', orderId);
      return db.runTransaction(async tx => {
        const [bs, rs] = await Promise.all([tx.get(bRef), tx.get(ref)]), b = binding(bs, mode, uid, orderId);
        check(b.stage === 'ready' && r.amountKRW === r.quantity * (b.order.amountKRW / b.order.quantity));
        if (rs.exists) {
          const v = refundBinding(rs, mode, uid, orderId, refundId);
          check(v.amountKRW === r.amountKRW && v.quantity === r.quantity && v.paymentReference === paymentReference, 'TOSSPAY_REFUND_CONFLICT');
          return { refundNo: v.refundNo, amountKRW: v.amountKRW, stage: v.stage, duplicate: true };
        }
        check(r.status === 'reserved', 'TOSSPAY_REFUND_NOT_RESERVED');
        if (mode === 'LIVE') {
          const [reservation, os] = await Promise.all([tx.get(refundRef(db, uid, refundId)), tx.get(orderRef(db, uid, orderId))]);
          const actual = reservation.exists ? reservation.data() : null;
          const o = validateOrder(os.exists ? os.data() : null, uid, orderId);
          check(actual && actual.ownerHash === owner(uid) && actual.orderId === orderId && actual.refundId === refundId
            && actual.status === 'reserved' && actual.quantity === r.quantity && actual.amountKRW === r.amountKRW
            && o.status === 'paid' && o.paymentHash === hash(paymentReference) && o.refundHeld >= r.quantity
            && sameOrderTerms(o, b.order),
          'TOSSPAY_REFUND_NOT_RESERVED');
        }
        const value = { schemaVersion: 1, mode, ownerHash: owner(uid), orderId, refundId,
          refundNo: externalRefundNo(mode, uid, orderId, refundId), amountKRW: r.amountKRW, quantity: r.quantity,
          paymentReference, stage: 'prepared', transactionReference: null, savedAt: time };
        tx.set(ref, value); return { refundNo: value.refundNo, amountKRW: value.amountKRW, stage: value.stage, duplicate: false };
      });
    },
    async markRefundDispatched(uid, orderId, refundId) {
      gate(); const ref = childRef(db, mode, uid, 'refund_bindings', refundId), time = timestamp();
      return db.runTransaction(async tx => {
        const r = refundBinding(await tx.get(ref), mode, uid, orderId, refundId);
        check(r.stage === 'prepared', 'TOSSPAY_REFUND_UNRESOLVED'); tx.set(ref, { ...r, stage: 'dispatching', dispatchedAt: time });
        return { refundNo: r.refundNo, amountKRW: r.amountKRW };
      });
    },
    async markRefundUncertain(uid, orderId, refundId) {
      gate(); const ref = childRef(db, mode, uid, 'refund_bindings', refundId);
      return db.runTransaction(async tx => {
        const r = refundBinding(await tx.get(ref), mode, uid, orderId, refundId);
        if (r.stage === 'ready' || r.stage === 'uncertain') return;
        check(r.stage === 'dispatching', 'TOSSPAY_REFUND_UNRESOLVED'); tx.set(ref, { ...r, stage: 'uncertain' });
      });
    },
    async attachRefund(uid, orderId, refundId, verifiedRefund) {
      gate(); const v = verifiedRefund; check(v && v.mode === mode && refText(v.reference));
      const ref = childRef(db, mode, uid, 'refund_bindings', refundId), marker = markerRef(db, mode, 'refund_tx', v.reference);
      return db.runTransaction(async tx => {
        const [rs, ms] = await Promise.all([tx.get(ref), tx.get(marker)]), r = refundBinding(rs, mode, uid, orderId, refundId);
        check(v.refundNo === r.refundNo && v.amountKRW === r.amountKRW, 'TOSSPAY_REFUND_CONFLICT');
        if (ms.exists) check(ms.data().ownerHash === owner(uid) && ms.data().orderId === orderId && ms.data().refundId === refundId,
          'TOSSPAY_REFUND_ALREADY_BOUND');
        if (r.stage === 'ready') { check(r.transactionReference === v.reference && ms.exists, 'TOSSPAY_REFUND_CONFLICT'); return { duplicate: true }; }
        check(['dispatching', 'uncertain'].includes(r.stage), 'TOSSPAY_REFUND_UNRESOLVED');
        tx.set(ref, { ...r, stage: 'ready', transactionReference: v.reference });
        tx.set(marker, { schemaVersion: 1, mode, ownerHash: owner(uid), orderId, refundId }); return { duplicate: false };
      });
    },
    async loadRefundBinding(uid, orderId, refundId) {
      gate(); const ref = childRef(db, mode, uid, 'refund_bindings', refundId);
      return db.runTransaction(async tx => {
        const s = await tx.get(ref); if (!s.exists) return null;
        const r = refundBinding(s, mode, uid, orderId, refundId); check(r.stage === 'ready', 'TOSSPAY_REFUND_UNRESOLVED');
        return { uid, orderId, refundId, mode, paymentReference: r.paymentReference, refundNo: r.refundNo,
          amountKRW: r.amountKRW, transactionReference: r.transactionReference };
      });
    },
  };
}
module.exports = { createTossPayBindingStore, rootRef, childRef };
