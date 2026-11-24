const { fail, id, exact, validTime, walletRef, emptyWallet, validateWallet, validateOrder, matchLot, creditView } = require('./replay-coaching-credits.js');
const PAGE_SIZE = 10;
const { hasAck, identity } = require('./replay-coaching-acknowledgement.js');
function validateCursor(cursor) {
  if (cursor !== null && (!exact(cursor, ['createdAt', 'orderId']) || !validTime(cursor.createdAt) || !id(cursor.orderId))) fail('INVALID_REQUEST', 400);
}
const checkoutState = o => o.checkout?.state || (o.status === 'paid' ? 'funded' : 'unavailable');
function historyRow(o, time) {
  const expired = o.expiresAt !== null && time >= o.expiresAt ? o.remaining : 0;
  return { orderId: o.orderId, quantity: o.quantity, amountKRW: o.amountKRW, currency: 'KRW', termsVersion: o.termsVersion,
    createdAt: o.createdAt, paidAt: o.paidAt, expiresAt: o.expiresAt, ...(Object.hasOwn(o, 'validDays') ? { validDays: o.validDays } : {}),
    status: o.status, checkoutState: checkoutState(o), remaining: o.remaining - expired, expired,
    ...(hasAck(o) ? { acknowledgement: identity(o.acknowledgement) } : {}),
    held: o.held, used: o.used, refundHeld: o.refundHeld, refunded: o.refunded };
}

// Read-only, bounded and owner-scoped. No payment provider/AI access, writes,
// collection-group query, listeners, offsets or new history/index documents.
function createPurchaseHistoryReader({ db, enabled = false, now = Date.now } = {}) {
  return async (uid, cursor = null) => {
    if (enabled !== true) fail('CREDIT_PURCHASE_DISABLED');
    if (!db || typeof db.runTransaction !== 'function') fail('CREDIT_PRODUCT_NOT_CONFIGURED');
    validateCursor(cursor);
    const ref = walletRef(db, uid);
    let query = db.collection(`${ref.path}/orders`).orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
    if (cursor !== null) query = query.startAfter(cursor.createdAt, cursor.orderId);
    query = query.limit(PAGE_SIZE + 1);
    return db.runTransaction(async tx => {
      const [orders, wallet] = await Promise.all([tx.get(query), tx.get(ref)]);
      const time = now(); if (!validTime(time)) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
      const w = wallet.exists ? validateWallet(wallet.data(), uid) : emptyWallet(uid);
      if (!Array.isArray(orders.docs) || orders.docs.length > PAGE_SIZE + 1) fail('CREDIT_STATE_INVALID');
      const checked = orders.docs.map(doc => {
        const o = validateOrder(doc.data(), uid, doc.id);
        if (o.status === 'paid') {
          if (!wallet.exists) fail('CREDIT_STATE_INVALID');
          if (o.remaining + o.held + o.refundHeld > 0) matchLot(w, o);
        }
        return o;
      });
      const page = checked.slice(0, PAGE_SIZE), last = page.at(-1), usable = creditView(w, time).remaining;
      return { asOf: time,
        account: { status: w.status, purchased: w.purchased, remaining: usable, expired: w.available - usable,
          held: w.held, used: w.used, refundHeld: w.refundHeld, refunded: w.refunded },
        orders: page.map(o => historyRow(o, time)),
        nextCursor: checked.length > PAGE_SIZE ? { createdAt: last.createdAt, orderId: last.orderId } : null };
    }, { readOnly: true });
  };
}
module.exports = { PAGE_SIZE, createPurchaseHistoryReader };
