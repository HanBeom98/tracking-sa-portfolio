const { timingSafeEqual } = require('node:crypto');
const { fail, owner, validTime, validateOrder } = require('./replay-coaching-credits.js');
const { createTossPayBindingStore, rootRef } = require('./replay-coaching-tosspay-store.js');
const PRODUCT = require('./replay-coaching-merchant-product.cjs');
// Schema 1 TEST records predate product snapshots and retain their original offer.
const LEGACY_PRODUCT = Object.freeze({ id: PRODUCT.id, quantity: 50, amountKRW: 3300, validDays: 365,
  termsVersion: 'merchant_review_draft_v1', description: 'TrackingSA AI 리플레이 분석 50회 이용권 (TEST)' });
const productOf = v => v.schemaVersion === 1 ? LEGACY_PRODUCT : v.product;
const LIMITS = Object.freeze({ dailyRequests: 100, dailyOrders: 10 });
const secret = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const orderId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);
const equalKey = (a, b) => secret(a) && secret(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const orderRef = (db, uid, id) => db.collection(`${rootRef(db, 'TEST', uid).path}/review_orders`).doc(id);
const controlRef = db => db.collection('_replay_coaching_users').doc('tosspay_review_control_v1');
function validate(v, uid, id) {
  if (!exact(v, ['schemaVersion', 'mode', 'ownerHash', 'orderId', 'createdAt', 'state', 'approvalRequestedAt', 'confirmedAt', 'demoExpiresAt', ...(v?.schemaVersion === 2 ? ['product'] : [])])
    || ![1, 2].includes(v.schemaVersion) || v.schemaVersion === 2 && (!exact(v.product, Object.keys(PRODUCT)) || Object.keys(PRODUCT).some(k => v.product[k] !== PRODUCT[k])) || v.mode !== 'TEST' || v.ownerHash !== owner(uid) || v.orderId !== id || !validTime(v.createdAt)
    || !['created', 'dispatching', 'uncertain', 'confirmed', 'cancelled'].includes(v.state)
    || v.approvalRequestedAt !== null && (!validTime(v.approvalRequestedAt) || v.approvalRequestedAt < v.createdAt)
    || (v.state === 'confirmed' ? !validTime(v.confirmedAt) || v.confirmedAt < v.createdAt
      || !validTime(v.demoExpiresAt) || v.demoExpiresAt !== v.confirmedAt + productOf(v).validDays * 86400000 : v.confirmedAt !== null || v.demoExpiresAt !== null)) fail('REVIEW_STATE_INVALID');
  return v;
}
const view = v => ({ mode: 'TEST', demoOnly: true, operationalCreditsGranted: false,
  order: { orderId: v.orderId, state: v.state, quantity: productOf(v).quantity, amountKRW: productOf(v).amountKRW,
    validDays: productOf(v).validDays, confirmedAt: v.confirmedAt, demoExpiresAt: v.demoExpiresAt } });
function bindingOrder(uid, record) {
  const product = productOf(record);
  return validateOrder({ schemaVersion: 1, ownerHash: owner(uid), orderId: record.orderId, product: product.id,
    quantity: product.quantity, amountKRW: product.amountKRW, termsVersion: product.termsVersion, expiresAt: null,
    createdAt: record.createdAt, status: 'pending', paymentHash: null, paidAt: null,
    remaining: 0, held: 0, used: 0, refundHeld: 0, refunded: 0 }, uid, record.orderId);
}
function payment(p, binding) {
  const cancelled = p?.payStatus === 'PAY_CANCEL';
  if (!p || p.mode !== 'TEST' || p.orderNo !== binding.orderNo || p.payToken !== binding.payToken || (p.amountKRW !== binding.amountKRW && !(cancelled && p.amountKRW === 0))
    || typeof p.payStatus !== 'string' || !Number.isSafeInteger(p.refundableAmount) || p.refundableAmount < 0 || p.refundableAmount > binding.amountKRW
    || !Array.isArray(p.transactions) || p.transactions.length > 256
    || p.transactions.some(t => !t || !['PAY', 'REFUND'].includes(t.kind) || typeof t.reference !== 'string'
      || !/^[A-Za-z0-9:_-]{1,36}$/.test(t.reference) || !Number.isSafeInteger(t.amountKRW)
      || (t.kind === 'PAY' ? t.amountKRW <= 0 || t.amountKRW > binding.amountKRW : t.amountKRW >= 0 || t.amountKRW < -binding.amountKRW))
    || new Set(p.transactions.map(t => t.reference)).size !== p.transactions.length
    || cancelled && (p.refundableAmount !== 0 || p.transactions.length !== 0)) fail('REVIEW_PAYMENT_UNCONFIRMED', 409);
  return p;
}

// Isolated merchant TEST harness, never calls the operational order/credit
// manager or an AI provider. All external writes have durable one-shot fences.
function createMerchantTestHandler({ db, enabled = false, accessKey, provider, now = Date.now } = {}) {
  const store = createTossPayBindingStore({ db, enabled, mode: 'TEST', now });
  const read = (uid, id) => db.runTransaction(async tx => {
    const s = await tx.get(orderRef(db, uid, id)); if (!s.exists) fail('REVIEW_ORDER_NOT_FOUND', 404);
    return validate(s.data(), uid, id);
  });
  const change = (uid, id, operation) => db.runTransaction(async tx => {
    const ref = orderRef(db, uid, id), s = await tx.get(ref); if (!s.exists) fail('REVIEW_ORDER_NOT_FOUND', 404);
    const v = validate(s.data(), uid, id), time = now(); if (!validTime(time) || time < v.createdAt) fail('REVIEW_STATE_INVALID');
    if (operation === 'start') {
      if (v.state !== 'created') fail('REVIEW_UNRESOLVED', 409); v.state = 'dispatching';
    } else if (operation === 'approve') {
      if (!['dispatching', 'uncertain'].includes(v.state) || v.approvalRequestedAt !== null) fail('REVIEW_UNRESOLVED', 409);
      v.approvalRequestedAt = time;
    } else if (operation === 'cancel') {
      if (['confirmed', 'cancelled'].includes(v.state)) return v;
      if (!['dispatching', 'uncertain'].includes(v.state)) fail('REVIEW_UNRESOLVED', 409);
      v.state = 'cancelled';
    } else if (operation === 'uncertain') {
      if (v.state === 'confirmed' || v.state === 'uncertain') return v;
      if (v.state !== 'dispatching') fail('REVIEW_UNRESOLVED', 409); v.state = 'uncertain';
    } else {
      if (v.state === 'confirmed') return v;
      if (!['dispatching', 'uncertain'].includes(v.state)) fail('REVIEW_UNRESOLVED', 409);
      v.state = 'confirmed'; v.confirmedAt = time; v.demoExpiresAt = time + productOf(v).validDays * 86400000;
    }
    validate(v, uid, id); tx.set(ref, v); return v;
  });
  const uncertain = (uid, id) => Promise.allSettled([change(uid, id, 'uncertain'), store.markPaymentUncertain(uid, id)]);
  async function admit(uid, id, action) {
    const time = now(); if (!validTime(time) || !validTime(time + 9 * 3600000)) fail('REVIEW_STATE_INVALID');
    const day = new Date(time + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
    return db.runTransaction(async tx => {
      const ref = controlRef(db), oRef = orderRef(db, uid, id), [cs, os] = await Promise.all([tx.get(ref), tx.get(oRef)]);
      const c = cs.exists ? cs.data() : { schemaVersion: 1, day, requests: 0, created: 0, total: 0 };
      if (!exact(c, ['schemaVersion', 'day', 'requests', 'created', 'total']) || c.schemaVersion !== 1 || !/^\d{8}$/.test(c.day) || c.day > day
        || ['requests', 'created', 'total'].some(k => !Number.isSafeInteger(c[k]) || c[k] < 0)
        || c.requests > LIMITS.dailyRequests || c.created > LIMITS.dailyOrders || c.created > c.total) fail('REVIEW_STATE_INVALID');
      if (c.day !== day) { c.day = day; c.requests = 0; c.created = 0; }
      if (c.requests >= LIMITS.dailyRequests) fail('REVIEW_LIMIT', 429);
      let v = os.exists ? validate(os.data(), uid, id) : null;
      // Count authenticated misses too; throwing inside a transaction would
      // discard the counter and let an access-code holder bypass its bound.
      if (!v && action !== 'create') { c.requests++; tx.set(ref, c); return null; }
      if (!v) {
        if (c.created >= LIMITS.dailyOrders || c.total >= Number.MAX_SAFE_INTEGER) fail('REVIEW_LIMIT', 429);
        c.created++; c.total++;
        v = { schemaVersion: 2, product: { ...PRODUCT }, mode: 'TEST', ownerHash: owner(uid), orderId: id, createdAt: time,
          state: 'created', approvalRequestedAt: null, confirmedAt: null, demoExpiresAt: null };
        tx.set(oRef, v);
      }
      c.requests++; tx.set(ref, c); return v;
    });
  }
  return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    if (req.headers.origin && req.headers.origin !== 'https://trackingsa.com') return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    res.set('Access-Control-Allow-Origin', 'https://trackingsa.com');
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    if (enabled !== true) return res.status(503).json({ error: 'REVIEW_DISABLED' });
    try {
      if (!db || !secret(accessKey) || provider?.mode !== 'TEST' || ['createPayment', 'inspectPayment', 'approvePayment'].some(k => typeof provider[k] !== 'function')) fail('REVIEW_DISABLED');
      if (!equalKey(req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1], accessKey)) fail('REVIEW_ACCESS_REQUIRED', 401);
      const session = req.headers['x-review-session']; if (!secret(session)) fail('REVIEW_INVALID_REQUEST', 400);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('REVIEW_INVALID_REQUEST', 400);
      if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length > 1024) fail('REVIEW_INVALID_REQUEST', 400);
      let body; try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(req.rawBody)); } catch { fail('REVIEW_INVALID_REQUEST', 400); }
      if (!exact(body, ['action', 'orderId']) || !['create', 'get', 'checkout', 'complete'].includes(body.action) || !orderId(body.orderId)) fail('REVIEW_INVALID_REQUEST', 400);
      const uid = `merchant_test_${owner(session)}`, id = body.orderId;
      let record = await admit(uid, id, body.action);
      if (!record) fail('REVIEW_ORDER_NOT_FOUND', 404);
      if (body.action === 'create') await store.saveOrder(uid, id, bindingOrder(uid, record));
      if (body.action === 'get' && ['dispatching', 'uncertain'].includes(record.state)) {
        const b = await store.readCheckout(uid, id);
        if (b?.stage === 'ready') {
          const p = payment(await provider.inspectPayment({ orderNo: b.orderNo, payToken: b.payToken, amountKRW: b.amountKRW }), b);
          if (p.payStatus === 'PAY_CANCEL') record = await change(uid, id, 'cancel');
        }
      }
      if (record.state === 'cancelled') return res.status(200).json(view(record));
      if (body.action === 'checkout' && record.state !== 'confirmed') {
        await store.saveOrder(uid, id, bindingOrder(uid, record));
        const b = await store.readCheckout(uid, id);
        if (b?.stage === 'ready') return res.status(200).json({ ...view(record), checkoutPage: b.checkoutPage });
        await change(uid, id, 'start');
        try {
          const expected = await store.markPaymentDispatched(uid, id);
          await store.attachPayment(uid, id, await provider.createPayment({ ...expected, productDesc: productOf(record).description }));
          record = await read(uid, id);
          return res.status(200).json({ ...view(record), checkoutPage: (await store.readCheckout(uid, id)).checkoutPage });
        } catch { await uncertain(uid, id); fail('REVIEW_UNRESOLVED', 409); }
      }
      if (body.action === 'complete' && record.state !== 'confirmed') {
        let b; try { b = await store.loadBinding(uid, id); } catch { fail('REVIEW_UNRESOLVED', 409); }
        if (!b) fail('REVIEW_UNRESOLVED', 409);
        const expected = { orderNo: b.orderNo, payToken: b.payToken, amountKRW: b.amountKRW };
        let p = payment(await provider.inspectPayment(expected), b);
        if (p.payStatus === 'PAY_CANCEL') return res.status(200).json(view(await change(uid, id, 'cancel')));
        if (p.payStatus === 'PAY_APPROVED') {
          if (p.refundableAmount !== b.amountKRW || p.transactions.some(t => t?.kind === 'REFUND')) fail('REVIEW_PAYMENT_UNCONFIRMED', 409);
          await change(uid, id, 'approve');
          try { await provider.approvePayment(expected); p = payment(await provider.inspectPayment(expected), b); }
          catch { await uncertain(uid, id); fail('REVIEW_UNRESOLVED', 409); }
        }
        if (p.payStatus === 'PAY_COMPLETE') {
          const pays = p.transactions.filter(t => t?.kind === 'PAY');
          if (p.refundableAmount !== b.amountKRW || pays.length !== 1 || pays[0].amountKRW !== b.amountKRW
            || typeof pays[0].reference !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(pays[0].reference)
            || p.transactions.some(t => t?.kind === 'REFUND')) fail('REVIEW_PAYMENT_UNCONFIRMED', 409);
          record = await change(uid, id, 'confirm');
        } else if (!['PAY_STANDBY', 'PAY_APPROVED', 'PAY_PROGRESS'].includes(p.payStatus)) fail('REVIEW_PAYMENT_UNCONFIRMED', 409);
      }
      return res.status(200).json(view(record));
    } catch (error) {
      const codes = { REVIEW_DISABLED: 503, REVIEW_ACCESS_REQUIRED: 401, REVIEW_INVALID_REQUEST: 400, REVIEW_LIMIT: 429,
        REVIEW_ORDER_NOT_FOUND: 404, REVIEW_STATE_INVALID: 503, REVIEW_UNRESOLVED: 409, REVIEW_PAYMENT_UNCONFIRMED: 409 };
      const known = Object.hasOwn(codes, error?.code);
      return res.status(known ? codes[error.code] : 503).json({ error: known ? error.code : 'REVIEW_UNAVAILABLE' });
    }
  };
}
module.exports = { createMerchantTestHandler, PRODUCT, LIMITS, orderRef, controlRef };
