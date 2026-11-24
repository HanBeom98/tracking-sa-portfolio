const { createCreditOrderManager } = require('./replay-coaching-credit-orders.js');
const { createTossPayBindingStore } = require('./replay-coaching-tosspay-store.js');
const { fail } = require('./replay-coaching-credits.js');
const { createReplayCheckout, configured } = require('./replay-coaching-checkout.js');
const { createPurchaseHistoryReader } = require('./replay-coaching-purchase-history.js');
const { previewDisclosure, saleDisclosure, verifyAcknowledgement, hasAck } = require('./replay-coaching-acknowledgement.js');
const ORIGIN = 'https://trackingsa.com';
const statuses = Object.freeze({ UNAUTHENTICATED: 401, JSON_REQUIRED: 415, BODY_TOO_LARGE: 413, INVALID_JSON: 400, INVALID_REQUEST: 400,
  PURCHASE_ACKNOWLEDGEMENT_REQUIRED: 400,
  ORDER_TERMS_CHANGED: 409, ORDER_CONFLICT: 409, ORDER_NOT_FOUND: 404, ORDER_ACCOUNT_UNAVAILABLE: 409, ORDER_EXPIRED: 409,
  ORDER_CHECKOUT_UNRESOLVED: 409, CREDIT_CAPACITY: 409, ORDER_OPEN_LIMIT: 429, ORDER_DAILY_LIMIT: 429,
  CREDIT_PRODUCT_NOT_CONFIGURED: 503, CREDIT_STATE_INVALID: 503,
  CHECKOUT_DISABLED: 503, CHECKOUT_NOT_CONFIGURED: 503, CHECKOUT_UNRESOLVED: 409,
  CHECKOUT_PAYMENT_UNCONFIRMED: 409, PAYMENT_FULFILLMENT_UNRESOLVED: 503 });
const view = (o, paymentEnabled) => ({ orderId: o.orderId, product: o.product, quantity: o.quantity, amountKRW: o.amountKRW, currency: 'KRW',
  termsVersion: o.termsVersion, expiresAt: o.expiresAt, createdAt: o.createdAt, status: o.status,
  ...(Object.hasOwn(o, 'validDays') ? { validDays: o.validDays, paidAt: o.paidAt } : {}),
  ...(hasAck(o) ? { acknowledgement: { ...o.acknowledgement } } : {}),
  checkoutState: o.checkout?.state || (o.status === 'paid' ? 'funded' : 'unavailable'), paymentEnabled });

// Dormant authenticated purchase path. Checkout has its own explicit opt-in and
// injected provider; no deployed export, key lookup, callback trust or polling.
function createReplayPurchaseHandler({ db, verifyToken, enabled = false, product, checkoutEnabled = false, provider, productDesc, disclosureDocument, requireSaleAcknowledgement = false, now = Date.now } = {}) {
  const policy = product && { ...product };
  const saleDocument = disclosureDocument && { ...disclosureDocument };
  const manager = createCreditOrderManager({ db, enabled, product: policy, reserveCapacity: true, now });
  const bindings = createTossPayBindingStore({ db, enabled, mode: 'LIVE', now });
  const checkout = createReplayCheckout({ db, enabled: enabled === true && checkoutEnabled === true, provider, productDesc, now });
  const paymentEnabled = checkoutEnabled === true && configured(provider, productDesc);
  const disclosure = p => saleDocument ? saleDisclosure(p, saleDocument) : previewDisclosure(p);
  const history = createPurchaseHistoryReader({ db, enabled, now });
  return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    if (req.headers.origin && req.headers.origin !== ORIGIN) return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    res.set('Access-Control-Allow-Origin', ORIGIN);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    if (enabled !== true) return res.status(503).json({ error: 'CREDIT_PURCHASE_DISABLED' });
    try {
      if (!db || typeof verifyToken !== 'function') fail('CREDIT_PRODUCT_NOT_CONFIGURED');
      const token = typeof req.headers.authorization === 'string' && req.headers.authorization.match(/^Bearer ([^\s]{1,8192})$/i)?.[1];
      if (!token) fail('UNAUTHENTICATED', 401);
      let identity;
      try { identity = await verifyToken(token); } catch { fail('UNAUTHENTICATED', 401); }
      const uid = identity?.uid;
      if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) fail('UNAUTHENTICATED', 401);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('JSON_REQUIRED', 415);
      if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length > 2048) fail('BODY_TOO_LARGE', 413);
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(req.rawBody)); } catch { fail('INVALID_JSON', 400); }
      if (body && typeof body === 'object' && !Array.isArray(body) && body.action === 'history') {
        if (Object.keys(body).length !== 2 || !Object.hasOwn(body, 'cursor')) fail('INVALID_REQUEST', 400);
        return res.status(200).json(await history(uid, body.cursor));
      }
      if (body && typeof body === 'object' && !Array.isArray(body) && body.action === 'product') {
        if (Object.keys(body).length !== 1) fail('INVALID_REQUEST', 400);
        const p = manager.readProduct();
        return res.status(200).json({ product: { ...p, disclosure: disclosure(p) }, paymentEnabled });
      }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !['create', 'get', 'cancel', 'checkout', 'complete'].includes(body.action)
        || typeof body.orderId !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(body.orderId)) fail('INVALID_REQUEST', 400);
      if (body.action === 'create' && Object.keys(body).length === 3 && !Object.hasOwn(body, 'acknowledgement')) fail('PURCHASE_ACKNOWLEDGEMENT_REQUIRED', 400);
      const keys = body.action === 'create' ? ['action', 'orderId', 'termsVersion', 'acknowledgement'] : ['action', 'orderId'];
      if (Object.keys(body).length !== keys.length || !keys.every(k => Object.hasOwn(body, k))) fail('INVALID_REQUEST', 400);
      let duplicate, outcome;
      if (body.action === 'create') {
        if (!policy) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
        if (body.termsVersion !== policy.termsVersion) fail('ORDER_TERMS_CHANGED', 409);
        const acceptedDisclosure = verifyAcknowledgement(manager.readProduct(), body.acknowledgement, disclosure(manager.readProduct()));
        duplicate = (await manager.createOrder(uid, body.orderId, acceptedDisclosure)).duplicate;
        const o = await manager.readOrder(uid, body.orderId);
        await bindings.saveOrder(uid, body.orderId, o);
      } else if (requireSaleAcknowledgement && ['checkout', 'complete'].includes(body.action)) {
        const saved = await manager.readOrder(uid, body.orderId);
        if (saved.status !== 'paid' && saved.acknowledgement?.purpose !== 'sale') fail('ORDER_TERMS_CHANGED', 409);
        outcome = body.action === 'checkout' ? await checkout.start(uid, body.orderId) : await checkout.complete(uid, body.orderId);
      } else if (body.action === 'cancel') duplicate = (await manager.cancelUnstartedOrder(uid, body.orderId)).duplicate;
      else if (body.action === 'checkout') outcome = await checkout.start(uid, body.orderId);
      else if (body.action === 'complete') outcome = await checkout.complete(uid, body.orderId);
      const order = await manager.readOrder(uid, body.orderId);
      return res.status(200).json({ order: view(order, paymentEnabled), ...(duplicate === undefined ? {} : { duplicate }), ...(outcome || {}) });
    } catch (error) {
      const known = Object.hasOwn(statuses, error?.code);
      return res.status(known ? statuses[error.code] : 503).json({ error: known ? error.code : 'PURCHASE_UNAVAILABLE' });
    }
  };
}
module.exports = { createReplayPurchaseHandler };
