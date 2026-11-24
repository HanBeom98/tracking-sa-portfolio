const { PRODUCT, fail, hash, id, validTime, owner, walletRef, orderRef, refundRef, paymentRef, refundPaymentRef,
  emptyWallet, validateWallet, validateOrder, matchLot, creditView } = require('./replay-coaching-credits.js');
const { capacityRef, readCapacity, matchReservation, checkCapacity, reserveCapacity: holdCapacity } = require('./replay-coaching-purchase-capacity.js');
const { hasDuration, validDays, expiryFromPayment, sameOrderTerms } = require('./replay-coaching-validity.js');
const { acknowledgement } = require('./replay-coaching-acknowledgement.js');
const reference = value => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
function productPolicy(product) {
  if (!product || product.id !== PRODUCT || !Number.isSafeInteger(product.quantity) || product.quantity < 1 || product.quantity > 50
    || !Number.isSafeInteger(product.amountKRW) || product.amountKRW < 1 || product.amountKRW % product.quantity !== 0
    || !id(product.termsVersion)
    || (hasDuration(product) ? !validDays(product.validDays) || product.expiresAt !== undefined && product.expiresAt !== null
      : !Object.hasOwn(product, 'expiresAt') || product.expiresAt !== null && !validTime(product.expiresAt))) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
  return { ...product, expiresAt: hasDuration(product) ? null : product.expiresAt };
}
function wallet(snapshot, uid) { return snapshot.exists ? validateWallet(snapshot.data(), uid) : emptyWallet(uid); }
function paidOrder(snapshot, uid, orderId) {
  const o = validateOrder(snapshot.exists ? snapshot.data() : null, uid, orderId);
  if (o.status !== 'paid') fail('ORDER_NOT_PAID', 409); return o;
}
function validateRefund(value, uid, orderId, refundId) {
  if (!value || value.schemaVersion !== 1 || value.ownerHash !== owner(uid) || value.orderId !== orderId || value.refundId !== refundId
    || !id(refundId) || !['reserved', 'settled'].includes(value.status) || !Number.isSafeInteger(value.quantity) || value.quantity < 1
    || !Number.isSafeInteger(value.amountKRW) || value.amountKRW < 1 || !validTime(value.createdAt)) fail('CREDIT_STATE_INVALID');
  return value;
}

// Internal operations only, disabled by default. Verification ports must read a
// trusted payment/refund source OUTSIDE Firestore retries; they do not send money.
// No client/admin-role bypass, endpoint, bank credential or automatic funding.
function createCreditOrderManager({ db, enabled = false, product, reserveCapacity = false, verifyPayment, verifyRefund, now = Date.now } = {}) {
  const gate = () => { if (enabled !== true) fail('CREDIT_PURCHASE_DISABLED'); if (!db) fail('CREDIT_PRODUCT_NOT_CONFIGURED'); };
  async function changeCheckout(uid, orderId, action) {
    gate(); const ref = orderRef(db, uid, orderId), cRef = capacityRef(db, uid), time = now();
    if (!validTime(time)) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
    return db.runTransaction(async tx => {
      const [os, cs, ws, profile] = await Promise.all([tx.get(ref), tx.get(cRef), tx.get(walletRef(db, uid)), tx.get(db.collection('users').doc(uid))]);
      if (!os.exists) fail('ORDER_NOT_FOUND', 404);
      const o = validateOrder(os.data(), uid, orderId), c = readCapacity(cs, uid, time), w = wallet(ws, uid);
      if (o.status !== 'pending' || !o.checkout) fail('ORDER_CHECKOUT_UNRESOLVED', 409);
      if (action === 'closed' && o.checkout.state === 'closed') return { duplicate: true };
      matchReservation(c, o);
      if (action === 'closed') {
        if (o.checkout.state !== 'reserved') fail('ORDER_CHECKOUT_UNRESOLVED', 409);
        c.reservations = c.reservations.filter(r => r.orderId !== orderId);
        tx.set(cRef, c);
      } else if (['dispatching', 'approve', 'inspect'].includes(action)) {
        if (action === 'dispatching' ? o.checkout.state !== 'reserved' : !['reserved', 'dispatching', 'uncertain'].includes(o.checkout.state)) fail('ORDER_CHECKOUT_UNRESOLVED', 409);
        if (!profile.exists || profile.data().uid !== uid || w.status !== 'active') fail('ORDER_ACCOUNT_UNAVAILABLE', 409);
        if (o.expiresAt !== null && time >= o.expiresAt) fail('ORDER_EXPIRED', 409);
        checkCapacity(w, c.reservations);
        if (action === 'inspect') return o;
        if (action === 'approve') {
          if (o.checkout.state === 'reserved' || Object.hasOwn(o.checkout, 'approvalRequestedAt')) fail('ORDER_CHECKOUT_UNRESOLVED', 409);
          o.checkout = { ...o.checkout, approvalRequestedAt: time, updatedAt: time };
          validateOrder(o, uid, orderId); tx.set(ref, o); return { duplicate: false };
        }
      } else {
        if (o.checkout.state === 'uncertain') return { duplicate: true };
        if (o.checkout.state !== 'dispatching') fail('ORDER_CHECKOUT_UNRESOLVED', 409);
      }
      o.checkout = { ...o.checkout, state: action, updatedAt: time }; validateOrder(o, uid, orderId);
      tx.set(ref, o); return { duplicate: false };
    });
  }
  return {
    readProduct() {
      gate(); const p = productPolicy(product), time = now();
      if (!validTime(time) || p.expiresAt !== null && p.expiresAt <= time) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
      return { id: p.id, quantity: p.quantity, amountKRW: p.amountKRW, currency: 'KRW', termsVersion: p.termsVersion, expiresAt: p.expiresAt,
        ...(hasDuration(p) ? { validDays: p.validDays } : {}) };
    },
    async readOrder(uid, orderId) {
      gate(); const ref = orderRef(db, uid, orderId);
      return db.runTransaction(async tx => {
        const s = await tx.get(ref); if (!s.exists) fail('ORDER_NOT_FOUND', 404);
        return validateOrder(s.data(), uid, orderId);
      });
    },
    beginCheckout: (uid, orderId) => changeCheckout(uid, orderId, 'dispatching'),
    inspectCheckout: (uid, orderId) => changeCheckout(uid, orderId, 'inspect'),
    beginApproval: (uid, orderId) => changeCheckout(uid, orderId, 'approve'),
    markCheckoutUncertain: (uid, orderId) => changeCheckout(uid, orderId, 'uncertain'),
    cancelUnstartedOrder: (uid, orderId) => changeCheckout(uid, orderId, 'closed'),
    async createOrder(uid, orderId, disclosure) {
      gate(); const p = productPolicy(product), time = now(), ref = orderRef(db, uid, orderId);
      if (!validTime(time) || p.expiresAt !== null && p.expiresAt <= time) fail('CREDIT_PRODUCT_NOT_CONFIGURED');
      return db.runTransaction(async tx => {
        const [existing, profile] = await Promise.all([tx.get(ref), tx.get(db.collection('users').doc(uid))]);
        if (!profile.exists || profile.data().uid !== uid) fail('ORDER_ACCOUNT_UNAVAILABLE', 409);
        const capacity = reserveCapacity === true ? await tx.get(capacityRef(db, uid)) : null;
        if (existing.exists) {
          const o = validateOrder(existing.data(), uid, orderId);
          const expected = { ...p, product: p.id, createdAt: o.createdAt,
            ...(disclosure === undefined ? {} : { acknowledgement: acknowledgement(p, disclosure, o.createdAt) }) };
          if (!sameOrderTerms(o, expected)) fail('ORDER_CONFLICT', 409);
          if (reserveCapacity === true) {
            if (!o.checkout || o.checkout.state === 'closed') fail('ORDER_CONFLICT', 409);
            if (o.status === 'pending') matchReservation(readCapacity(capacity, uid, time), o);
          }
          return { orderId, duplicate: true };
        }
        if (reserveCapacity === true) {
          const ws = await tx.get(walletRef(db, uid)), w = wallet(ws, uid), c = readCapacity(capacity, uid, time);
          if (w.status !== 'active') fail('ORDER_ACCOUNT_UNAVAILABLE', 409);
          holdCapacity(c, w, orderId, p.quantity, time); tx.set(capacityRef(db, uid), c);
        }
        const consent = disclosure === undefined ? {} : { acknowledgement: acknowledgement(p, disclosure, time) };
        tx.set(ref, { schemaVersion: 1, ownerHash: owner(uid), orderId, product: p.id, quantity: p.quantity, amountKRW: p.amountKRW,
          termsVersion: p.termsVersion, expiresAt: p.expiresAt, createdAt: time, status: 'pending', paymentHash: null, paidAt: null,
          ...(hasDuration(p) ? { validDays: p.validDays } : {}),
          ...consent,
          remaining: 0, held: 0, used: 0, refundHeld: 0, refunded: 0,
          ...(reserveCapacity === true ? { checkout: { state: 'reserved', reservedAt: time, updatedAt: time } } : {}) });
        return { orderId, duplicate: false };
      });
    },
    async confirmPayment(uid, orderId, paymentReference) {
      gate();
      if (!reference(paymentReference) || typeof verifyPayment !== 'function') fail('PAYMENT_VERIFICATION_REQUIRED');
      const ref = orderRef(db, uid, orderId), read = await db.runTransaction(async tx => {
        const snapshot = await tx.get(ref); return validateOrder(snapshot.exists ? snapshot.data() : null, uid, orderId);
      });
      let proof;
      try { proof = await verifyPayment({ uid, orderId, paymentReference, amountKRW: read.amountKRW, currency: 'KRW' }); }
      catch { fail('PAYMENT_UNCONFIRMED', 409); }
      if (!proof || proof.mode !== undefined && proof.mode !== 'LIVE' || proof.status !== 'settled' || proof.uid !== uid || proof.orderId !== orderId || proof.paymentReference !== paymentReference
        || proof.amountKRW !== read.amountKRW || proof.currency !== 'KRW') fail('PAYMENT_UNCONFIRMED', 409);
      const time = now(); if (!validTime(time)) fail('COACHING_NOT_CONFIGURED');
      if (hasDuration(read) && (proof.mode !== 'LIVE' || !validTime(proof.paidAt) || proof.paidAt < read.createdAt
        || proof.paidAt > time || expiryFromPayment(proof.paidAt, read.validDays) === null)) fail('PAYMENT_UNCONFIRMED', 409);
      const payRef = paymentRef(db, paymentReference), wRef = walletRef(db, uid), paymentHash = hash(paymentReference);
      return db.runTransaction(async tx => {
        const cRef = capacityRef(db, uid);
        const [os, ws, ps, profile, cs] = await Promise.all([tx.get(ref), tx.get(wRef), tx.get(payRef), tx.get(db.collection('users').doc(uid)), tx.get(cRef)]);
        const o = validateOrder(os.exists ? os.data() : null, uid, orderId), w = wallet(ws, uid);
        if (JSON.stringify(o) !== JSON.stringify(read)) {
          // Only a previous fulfillment may have changed the immutable order.
          if (!sameOrderTerms(o, read)) fail('ORDER_CONFLICT', 409);
        }
        if (o.status === 'paid') {
          if (o.paymentHash !== paymentHash || !ps.exists || ps.data().ownerHash !== owner(uid) || ps.data().orderId !== orderId) fail('PAYMENT_ALREADY_APPLIED', 409);
          if (hasDuration(o) && o.paidAt !== proof.paidAt) fail('PAYMENT_UNCONFIRMED', 409);
          return { duplicate: true, credits: creditView(w, time) };
        }
        if (!profile.exists || profile.data().uid !== uid || w.status !== 'active') fail('ORDER_ACCOUNT_UNAVAILABLE', 409);
        if (ps.exists) fail('PAYMENT_ALREADY_APPLIED', 409);
        if (o.expiresAt !== null && time >= o.expiresAt) fail('ORDER_EXPIRED', 409);
        const c = readCapacity(cs, uid, time);
        if (o.checkout) {
          if (!['dispatching', 'uncertain'].includes(o.checkout.state)) fail('ORDER_CHECKOUT_UNRESOLVED', 409);
          matchReservation(c, o);
          c.reservations = c.reservations.filter(r => r.orderId !== orderId);
          o.checkout = { ...o.checkout, state: 'funded', updatedAt: time };
        } else if (c.reservations.some(r => r.orderId === orderId)) fail('CREDIT_STATE_INVALID');
        checkCapacity(w, c.reservations, o.quantity, 1);
        o.status = 'paid'; o.paymentHash = paymentHash; o.paidAt = hasDuration(o) ? proof.paidAt : time; o.remaining = o.quantity;
        if (hasDuration(o)) o.expiresAt = expiryFromPayment(o.paidAt, o.validDays);
        w.purchased += o.quantity; w.available += o.quantity;
        w.lots.push({ orderId, remaining: o.quantity, held: 0, refundHeld: 0, expiresAt: o.expiresAt });
        validateWallet(w, uid); validateOrder(o, uid, orderId);
        if (o.checkout) tx.set(cRef, c);
        tx.set(ref, o); tx.set(wRef, w); tx.set(payRef, { schemaVersion: 1, ownerHash: owner(uid), orderId, amountKRW: o.amountKRW, appliedAt: time });
        return { duplicate: false, credits: creditView(w, time) };
      });
    },
    // Reserve unused units BEFORE a bank refund. Pending/uncertain refunds keep
    // these units locked; no automatic release or double-spending on expiry.
    async reserveRefund(uid, orderId, refundId, quantity) {
      gate();
      if (!id(refundId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) fail('INVALID_REFUND', 400);
      const ref = refundRef(db, uid, refundId), oRef = orderRef(db, uid, orderId), wRef = walletRef(db, uid), time = now();
      if (!validTime(time)) fail('COACHING_NOT_CONFIGURED');
      return db.runTransaction(async tx => {
        const [rs, os, ws] = await Promise.all([tx.get(ref), tx.get(oRef), tx.get(wRef)]);
        const o = paidOrder(os, uid, orderId), w = wallet(ws, uid);
        if (rs.exists) {
          const r = validateRefund(rs.data(), uid, orderId, refundId);
          if (r.quantity !== quantity || r.amountKRW !== quantity * (o.amountKRW / o.quantity)) fail('REFUND_CONFLICT', 409);
          return { duplicate: true, amountKRW: r.amountKRW, status: r.status };
        }
        if (o.held) fail('REFUND_REQUEST_IN_PROGRESS', 409);
        if (quantity > o.remaining) fail('REFUND_EXCEEDS_UNUSED', 409);
        const lot = matchLot(w, o); lot.remaining -= quantity; lot.refundHeld += quantity;
        w.available -= quantity; w.refundHeld += quantity; o.remaining -= quantity; o.refundHeld += quantity;
        const r = { schemaVersion: 1, ownerHash: owner(uid), orderId, refundId, quantity,
          amountKRW: quantity * (o.amountKRW / o.quantity), status: 'reserved', createdAt: time };
        validateWallet(w, uid); validateOrder(o, uid, orderId);
        tx.set(ref, r); tx.set(oRef, o); tx.set(wRef, w);
        return { duplicate: false, amountKRW: r.amountKRW, status: r.status };
      });
    },
    async confirmRefund(uid, orderId, refundId, refundReference) {
      gate();
      if (!reference(refundReference) || typeof verifyRefund !== 'function') fail('REFUND_VERIFICATION_REQUIRED');
      const ref = refundRef(db, uid, refundId), oRef = orderRef(db, uid, orderId), wRef = walletRef(db, uid);
      const read = await db.runTransaction(async tx => {
        const [rs, os] = await Promise.all([tx.get(ref), tx.get(oRef)]);
        return { refund: validateRefund(rs.exists ? rs.data() : null, uid, orderId, refundId), order: paidOrder(os, uid, orderId) };
      });
      let proof;
      try { proof = await verifyRefund({ uid, orderId, refundId, refundReference, paymentHash: read.order.paymentHash, amountKRW: read.refund.amountKRW, currency: 'KRW' }); }
      catch { fail('REFUND_UNCONFIRMED', 409); }
      if (!proof || proof.mode !== undefined && proof.mode !== 'LIVE' || proof.status !== 'settled' || proof.uid !== uid || proof.orderId !== orderId || proof.refundId !== refundId
        || proof.refundReference !== refundReference || proof.paymentHash !== read.order.paymentHash
        || proof.amountKRW !== read.refund.amountKRW || proof.currency !== 'KRW') fail('REFUND_UNCONFIRMED', 409);
      const time = now(), marker = refundPaymentRef(db, refundReference), markerHash = hash(refundReference);
      if (!validTime(time)) fail('COACHING_NOT_CONFIGURED');
      return db.runTransaction(async tx => {
        const [rs, os, ws, ms] = await Promise.all([tx.get(ref), tx.get(oRef), tx.get(wRef), tx.get(marker)]);
        const r = validateRefund(rs.exists ? rs.data() : null, uid, orderId, refundId), o = paidOrder(os, uid, orderId), w = wallet(ws, uid);
        if (r.quantity !== read.refund.quantity || r.amountKRW !== read.refund.amountKRW || o.paymentHash !== read.order.paymentHash) fail('REFUND_CONFLICT', 409);
        if (r.status === 'settled') {
          if (r.refundHash !== markerHash || !ms.exists || ms.data().ownerHash !== owner(uid) || ms.data().refundId !== refundId) fail('REFUND_CONFLICT', 409);
          return { duplicate: true, credits: creditView(w, time) };
        }
        if (ms.exists) fail('REFUND_ALREADY_APPLIED', 409);
        const lot = matchLot(w, o);
        if (o.refundHeld < r.quantity || lot.refundHeld < r.quantity) fail('CREDIT_STATE_INVALID');
        lot.refundHeld -= r.quantity; w.refundHeld -= r.quantity; w.refunded += r.quantity; o.refundHeld -= r.quantity; o.refunded += r.quantity;
        w.lots = w.lots.filter(l => l.remaining + l.held + l.refundHeld > 0);
        validateWallet(w, uid); validateOrder(o, uid, orderId);
        tx.set(wRef, w); tx.set(oRef, o); tx.set(ref, { ...r, status: 'settled', refundHash: markerHash, settledAt: time });
        tx.set(marker, { schemaVersion: 1, ownerHash: owner(uid), orderId, refundId, amountKRW: r.amountKRW, appliedAt: time });
        return { duplicate: false, credits: creditView(w, time) };
      });
    },
  };
}
module.exports = { createCreditOrderManager };
