const { createHash, randomUUID } = require('node:crypto');
const { ACCOUNTING, POLICY, uint, validateControl, controlRef, validateCostQuote, sameCostQuote, usageCost } = require('./replay-coaching-cost.js');
const { normalizeCoachingResult } = require('./replay-coaching-result.js');
const { hasDuration, validDays, expiryFromPayment } = require('./replay-coaching-validity.js');
const { hasAck, validAcknowledgement } = require('./replay-coaching-acknowledgement.js');
const PRODUCT = 'replay_ai_credits_v1';
const MAX_LOTS = 50, MAX_BALANCE = 10000;
const fail = (code, status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const hash = value => createHash('sha256').update(value).digest('hex');
const periodAt = now => new Date(now + 9 * 3600000).toISOString().slice(0, 7).replace('-', '');
const dayAt = now => new Date(now + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const validTime = time => uint(time) && Number.isFinite(new Date(time).getTime());
function owner(uid) { if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) fail('INVALID_REQUEST', 400); return hash(uid); }
const walletRef = (db, uid) => db.collection('_replay_coaching_users').doc(`credits_v1_${owner(uid)}`);
const childRef = (db, uid, collection, key) => db.collection(`${walletRef(db, uid).path}/${collection}`).doc(key);
const orderRef = (db, uid, orderId) => { if (!id(orderId)) fail('INVALID_ORDER', 400); return childRef(db, uid, 'orders', orderId); };
const refundRef = (db, uid, refundId) => { if (!id(refundId)) fail('INVALID_REFUND', 400); return childRef(db, uid, 'refunds', refundId); };
const paymentRef = (db, reference) => db.collection('_replay_coaching_users').doc(`credit_payment_${hash(reference)}`);
const refundPaymentRef = (db, reference) => db.collection('_replay_coaching_users').doc(`credit_refund_${hash(reference)}`);
function refsFor(db, uid, requestId, period) {
  if (!/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(requestId)) fail('INVALID_REQUEST_ID', 400);
  return { walletRef: walletRef(db, uid), requestRef: childRef(db, uid, 'requests', requestId),
    budgetRef: db.collection('_replay_coaching_users').doc(`credit_cost_${ACCOUNTING}_${owner(uid)}_${period}`),
    globalRef: db.collection('_replay_coaching_months').doc(`${ACCOUNTING}_${period}`) };
}
const emptyWallet = uid => ({ schemaVersion: 1, ownerHash: owner(uid), status: 'active', purchased: 0, used: 0,
  refunded: 0, available: 0, held: 0, refundHeld: 0, lots: [], active: null });
function validateWallet(value, uid) {
  if (!exact(value, ['schemaVersion', 'ownerHash', 'status', 'purchased', 'used', 'refunded', 'available', 'held', 'refundHeld', 'lots', 'active'])
    || value.schemaVersion !== 1 || value.ownerHash !== owner(uid) || !['active', 'blocked'].includes(value.status)
    || ['purchased', 'used', 'refunded', 'available', 'held', 'refundHeld'].some(key => !uint(value[key]))
    || value.available + value.held + value.refundHeld > MAX_BALANCE || value.held > 1
    || value.purchased !== value.used + value.refunded + value.available + value.held + value.refundHeld
    || !Array.isArray(value.lots) || value.lots.length > MAX_LOTS || new Set(value.lots.map(l => l.orderId)).size !== value.lots.length) fail('CREDIT_STATE_INVALID');
  for (const lot of value.lots) {
    if (!exact(lot, ['orderId', 'remaining', 'held', 'refundHeld', 'expiresAt']) || !id(lot.orderId)
      || !uint(lot.remaining) || !uint(lot.held) || lot.held > 1 || !uint(lot.refundHeld)
      || lot.remaining + lot.held + lot.refundHeld < 1 || lot.remaining + lot.held + lot.refundHeld > 50
      || lot.expiresAt !== null && !validTime(lot.expiresAt)) fail('CREDIT_STATE_INVALID');
  }
  for (const [total, field] of [['available', 'remaining'], ['held', 'held'], ['refundHeld', 'refundHeld']]) {
    if (value[total] !== value.lots.reduce((n, lot) => n + lot[field], 0)) fail('CREDIT_STATE_INVALID');
  }
  if (Boolean(value.active) !== Boolean(value.held)) fail('CREDIT_STATE_INVALID');
  if (value.active) {
    const a = value.active;
    if (!/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(a.requestId) || !/^[a-f0-9]{64}$/.test(a.digest)
      || typeof a.lease !== 'string' || !a.lease || !id(a.orderId) || !validTime(a.startedAt)
      || a.period !== periodAt(a.startedAt) || a.day !== dayAt(a.startedAt)
      || !['reserved', 'dispatching'].includes(a.stage) || !value.lots.some(l => l.orderId === a.orderId && l.held === 1)
      || a.stage === 'dispatching' && (!validTime(a.dispatchedAt) || a.dispatchedAt < a.startedAt)) fail('CREDIT_STATE_INVALID');
    try { validateCostQuote(a.quote); } catch { fail('CREDIT_STATE_INVALID'); }
  }
  return value;
}
function validateOrder(value, uid, orderId) {
  if (!value || value.schemaVersion !== 1 || value.ownerHash !== owner(uid) || value.orderId !== orderId || !id(orderId)
    || value.product !== PRODUCT || !uint(value.quantity) || value.quantity < 1 || value.quantity > 50
    || !uint(value.amountKRW) || value.amountKRW < 1 || value.amountKRW % value.quantity !== 0
    || !id(value.termsVersion) || !validTime(value.createdAt) || value.expiresAt !== null && (!validTime(value.expiresAt) || value.expiresAt <= value.createdAt)
    || !['pending', 'paid'].includes(value.status)
    || ['remaining', 'held', 'used', 'refundHeld', 'refunded'].some(key => !uint(value[key])) || value.held > 1) fail('CREDIT_STATE_INVALID');
  const total = value.remaining + value.held + value.used + value.refundHeld + value.refunded;
  if (hasAck(value) && !validAcknowledgement(value.acknowledgement, value)) fail('CREDIT_STATE_INVALID');
  if (value.status === 'pending' ? total !== 0 || value.paymentHash !== null || value.paidAt !== null
    : total !== value.quantity || !/^[a-f0-9]{64}$/.test(value.paymentHash) || !validTime(value.paidAt)) fail('CREDIT_STATE_INVALID');
  if (hasDuration(value) && (!validDays(value.validDays) || (value.status === 'pending' ? value.expiresAt !== null
    : value.paidAt < value.createdAt || expiryFromPayment(value.paidAt, value.validDays) === null
      || value.expiresAt !== expiryFromPayment(value.paidAt, value.validDays)))) fail('CREDIT_STATE_INVALID');
  if (Object.hasOwn(value, 'checkout')) {
    const c = value.checkout;
    const keys = ['state', 'reservedAt', 'updatedAt', ...(c && Object.hasOwn(c, 'approvalRequestedAt') ? ['approvalRequestedAt'] : [])];
    if (!exact(c, keys) || c.reservedAt !== value.createdAt || !validTime(c.updatedAt) || c.updatedAt < c.reservedAt
      || !['reserved', 'dispatching', 'uncertain', 'closed', 'funded'].includes(c.state)
      || Object.hasOwn(c, 'approvalRequestedAt') && (!validTime(c.approvalRequestedAt) || c.approvalRequestedAt < c.reservedAt
        || c.approvalRequestedAt > c.updatedAt || ['reserved', 'closed'].includes(c.state))
      || (value.status === 'paid' ? c.state !== 'funded'
        || (hasDuration(value) ? c.updatedAt < value.paidAt : c.updatedAt !== value.paidAt) : c.state === 'funded')) fail('CREDIT_STATE_INVALID');
  }
  return value;
}
function matchLot(wallet, order) {
  const lot = wallet.lots.find(l => l.orderId === order.orderId);
  if (!lot || order.status !== 'paid' || ['held', 'refundHeld'].some(k => lot[k] !== order[k])
    || lot.remaining !== order.remaining || lot.expiresAt !== order.expiresAt) fail('CREDIT_STATE_INVALID');
  return lot;
}
function creditView(wallet, now) {
  if (!validTime(now)) fail('COACHING_NOT_CONFIGURED');
  return { remaining: wallet.lots.reduce((n, lot) => n + (lot.expiresAt === null || now < lot.expiresAt ? lot.remaining : 0), 0), held: wallet.held };
}
function globalState(value) {
  const g = value || { schemaVersion: 2, accounting: ACCOUNTING, successfulCalls: 0, usedCalls: 0, heldCalls: 0, spentUnits: 0, heldUnits: 0 };
  if (g.schemaVersion !== 2 || g.accounting !== ACCOUNTING
    || ['successfulCalls', 'usedCalls', 'heldCalls', 'spentUnits', 'heldUnits'].some(k => !uint(g[k])) || g.successfulCalls > g.usedCalls) fail('QUOTA_STATE_INVALID');
  return g;
}
function budgetState(value, period) {
  const b = value || { schemaVersion: 1, accounting: ACCOUNTING, period, spentUnits: 0, heldUnits: 0, attempts: 0, used: 0, days: [] };
  if (b.schemaVersion !== 1 || b.accounting !== ACCOUNTING || b.period !== period
    || ['spentUnits', 'heldUnits', 'attempts', 'used'].some(k => !uint(b[k])) || b.used > b.attempts
    || !Array.isArray(b.days) || b.days.length > 31 || new Set(b.days.map(d => d.day)).size !== b.days.length
    || b.days.some(d => !/^\d{8}$/.test(d.day) || !d.day.startsWith(period)
      || ['attempts', 'used', 'spentUnits'].some(k => !uint(d[k])) || d.attempts < 1 || d.attempts > POLICY.dailyAttempts || d.used > POLICY.dailySuccess || d.used > d.attempts)
    || b.attempts !== b.days.reduce((n, d) => n + d.attempts, 0) || b.used !== b.days.reduce((n, d) => n + d.used, 0)
    || b.spentUnits !== b.days.reduce((n, d) => n + d.spentUnits, 0)) fail('QUOTA_STATE_INVALID');
  return b;
}
function checkIdentity(uid, requestId, digest, now) {
  owner(uid);
  if (!/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(requestId) || !/^[a-f0-9]{64}$/.test(digest) || !validTime(now)) fail('INVALID_REQUEST', 400);
}
function readWallet(snapshot, uid) { if (!snapshot.exists) fail('AI_CREDITS_REQUIRED', 403); return validateWallet(snapshot.data(), uid); }
function duplicate(record, wallet, uid, requestId, digest, now) {
  if (record) {
    if (record.schemaVersion !== 1 || record.ownerHash !== owner(uid) || record.requestId !== requestId || !record.reservation) fail('CREDIT_STATE_INVALID');
    if (record.digest !== digest) fail('IDEMPOTENCY_CONFLICT', 409);
    if (record.status === 'completed') return { duplicate: true, result: normalizeCoachingResult(record.result), credits: creditView(wallet, now) };
    if (!['reserved', 'dispatching'].includes(record.status)) fail('PREVIOUS_ATTEMPT_FAILED', 409);
    if (!wallet.active || wallet.active.requestId !== requestId) fail('CREDIT_STATE_INVALID');
  }
  if (wallet.active) fail(now - wallet.active.startedAt >= 60000 ? 'REQUEST_UNRESOLVED' : 'REQUEST_IN_PROGRESS', 409);
  return null;
}
function checkNew(wallet, budget, global, control, config, requestId, now, units = 1) {
  if (!config || !uint(config.userMicros) || config.userMicros < 1 || config.userMicros > POLICY.maxUserMicros
    || !uint(config.globalMonthly) || config.globalMonthly < 1 || config.globalMonthly > 10000) fail('COACHING_NOT_CONFIGURED');
  if (wallet.status !== 'active') fail('CREDIT_ACCOUNT_BLOCKED', 403);
  if (!creditView(wallet, now).remaining) fail('CREDITS_EXHAUSTED', 429);
  const period = periodAt(now), cap = validateControl(control, period), day = budget.days.find(d => d.day === dayAt(now));
  if (!requestId.startsWith(`${period}-`)) fail('INVALID_REQUEST_ID', 400);
  if ((day?.used || 0) >= POLICY.dailySuccess) fail('DAILY_USER_LIMIT', 429);
  if ((day?.attempts || 0) >= POLICY.dailyAttempts) fail('DAILY_ATTEMPT_LIMIT', 429);
  if (budget.spentUnits + budget.heldUnits + units > config.userMicros) fail('USER_BUDGET_LIMIT', 429);
  if (global.usedCalls + global.heldCalls >= config.globalMonthly) fail('GLOBAL_LIMIT', 429);
  if (global.spentUnits + global.heldUnits + units > cap.allocatedMicros) fail('GLOBAL_BUDGET_LIMIT', 429);
}
async function inspectCreditRequest(db, uid, requestId, digest, now, config) {
  checkIdentity(uid, requestId, digest, now);
  const refs = refsFor(db, uid, requestId, periodAt(now));
  return db.runTransaction(async tx => {
    const [w, r, b, g, c] = await Promise.all([tx.get(refs.walletRef), tx.get(refs.requestRef), tx.get(refs.budgetRef), tx.get(refs.globalRef), tx.get(controlRef(db))]);
    const wallet = readWallet(w, uid), existing = duplicate(r.exists ? r.data() : null, wallet, uid, requestId, digest, now);
    if (existing) return existing;
    checkNew(wallet, budgetState(b.exists ? b.data() : null, periodAt(now)), globalState(g.exists ? g.data() : null), c.exists ? c.data() : null, config, requestId, now);
    return null;
  });
}
async function readCreditResult(db, uid, requestId, digest, now) {
  checkIdentity(uid, requestId, digest, now);
  const refs = refsFor(db, uid, requestId, periodAt(now));
  return db.runTransaction(async tx => {
    const [w, r] = await Promise.all([tx.get(refs.walletRef), tx.get(refs.requestRef)]);
    if (!r.exists) return null;
    return duplicate(r.data(), readWallet(w, uid), uid, requestId, digest, now);
  });
}
async function reserveCredit(db, uid, requestId, digest, quote, config, now) {
  checkIdentity(uid, requestId, digest, now); validateCostQuote(quote, now);
  const period = periodAt(now), refs = refsFor(db, uid, requestId, period);
  return db.runTransaction(async tx => {
    const [w, r, b, g, c] = await Promise.all([tx.get(refs.walletRef), tx.get(refs.requestRef), tx.get(refs.budgetRef), tx.get(refs.globalRef), tx.get(controlRef(db))]);
    const wallet = readWallet(w, uid), existing = duplicate(r.exists ? r.data() : null, wallet, uid, requestId, digest, now);
    if (existing) return existing;
    const budget = budgetState(b.exists ? b.data() : null, period), global = globalState(g.exists ? g.data() : null);
    checkNew(wallet, budget, global, c.exists ? c.data() : null, config, requestId, now, quote.maxCostMicros);
    // Expiring lots first, then stable order ID. No query or monthly credit reset.
    const lot = wallet.lots.filter(l => l.remaining && (l.expiresAt === null || now < l.expiresAt))
      .sort((a, b) => (a.expiresAt ?? Number.MAX_SAFE_INTEGER) - (b.expiresAt ?? Number.MAX_SAFE_INTEGER) || a.orderId.localeCompare(b.orderId))[0];
    const oRef = orderRef(db, uid, lot.orderId), o = await tx.get(oRef);
    const order = validateOrder(o.exists ? o.data() : null, uid, lot.orderId); matchLot(wallet, order);
    const active = { requestId, digest, lease: randomUUID(), orderId: lot.orderId, period, day: dayAt(now), quote: { ...quote }, startedAt: now, stage: 'reserved' };
    lot.remaining--; lot.held++; order.remaining--; order.held++;
    wallet.available--; wallet.held++; wallet.active = active;
    budget.heldUnits += quote.maxCostMicros; budget.attempts++;
    let day = budget.days.find(d => d.day === active.day);
    if (!day) { day = { day: active.day, attempts: 0, used: 0, spentUnits: 0 }; budget.days.push(day); }
    day.attempts++;
    global.heldCalls++; global.heldUnits += quote.maxCostMicros;
    validateWallet(wallet, uid); validateOrder(order, uid, lot.orderId); budgetState(budget, period); globalState(global);
    tx.set(refs.walletRef, wallet); tx.set(oRef, order); tx.set(refs.budgetRef, budget); tx.set(refs.globalRef, global);
    tx.set(refs.requestRef, { schemaVersion: 1, ownerHash: owner(uid), requestId, digest, status: 'reserved', reservation: active });
    return { uid, ...refs, orderRef: oRef, active, duplicate: false };
  });
}
async function transactionState(db, tx, reservation) {
  const { uid, active } = reservation;
  const refs = refsFor(db, uid, active.requestId, active.period), oRef = orderRef(db, uid, active.orderId);
  const [w, r, o, b, g] = await Promise.all([tx.get(refs.walletRef), tx.get(refs.requestRef), tx.get(oRef), tx.get(refs.budgetRef), tx.get(refs.globalRef)]);
  const wallet = readWallet(w, uid), request = r.exists ? r.data() : null, order = validateOrder(o.exists ? o.data() : null, uid, active.orderId);
  if (!request || request.ownerHash !== owner(uid) || request.requestId !== active.requestId || request.digest !== active.digest
    || !request.reservation || ['lease', 'orderId', 'period', 'day', 'startedAt'].some(k => request.reservation[k] !== active[k])
    || !sameCostQuote(request.reservation.quote, active.quote)) fail('CREDIT_STATE_INVALID');
  const budget = budgetState(b.exists ? b.data() : null, active.period), global = globalState(g.exists ? g.data() : null);
  return { uid, refs, oRef, wallet, request, order, budget, global };
}
function fence(s, expected) {
  const active = s.wallet.active;
  if (!active || ['requestId', 'digest', 'lease', 'orderId', 'period', 'day', 'startedAt'].some(k => active[k] !== expected[k])
    || !sameCostQuote(active.quote, expected.quote) || s.request.status !== active.stage
    || s.budget.heldUnits !== active.quote.maxCostMicros || s.global.heldCalls < 1 || s.global.heldUnits < active.quote.maxCostMicros) fail('CREDIT_STATE_INVALID');
  matchLot(s.wallet, s.order); return active;
}
function settlement(tx, s, expected, outcome, now) {
  const a = fence(s, expected), { wallet, order, budget, global, request } = s;
  const signature = hash(JSON.stringify(outcome)), success = outcome.status === 'completed', dispatched = outcome.status !== 'cancelled';
  const lot = matchLot(wallet, order), day = budget.days.find(d => d.day === a.day);
  if (!day) fail('CREDIT_STATE_INVALID');
  lot.held--; order.held--; wallet.held--; wallet.active = null;
  if (success) { wallet.used++; order.used++; budget.used++; day.used++; global.successfulCalls++; }
  else { lot.remaining++; order.remaining++; wallet.available++; }
  wallet.lots = wallet.lots.filter(l => l.remaining + l.held + l.refundHeld > 0);
  budget.heldUnits -= a.quote.maxCostMicros; budget.spentUnits += outcome.chargedUnits; day.spentUnits += outcome.chargedUnits;
  global.heldCalls--; global.heldUnits -= a.quote.maxCostMicros; global.spentUnits += outcome.chargedUnits; global.usedCalls += Number(dispatched);
  validateWallet(wallet, s.uid); validateOrder(order, s.uid, a.orderId); budgetState(budget, a.period); globalState(global);
  tx.set(s.refs.walletRef, wallet); tx.set(s.oRef, order); tx.set(s.refs.budgetRef, budget); tx.set(s.refs.globalRef, global);
  tx.set(s.refs.requestRef, { ...request, ...outcome, settlementHash: signature, settledAt: now });
  return { credits: creditView(wallet, now), status: outcome.status, chargedUnits: outcome.chargedUnits };
}
async function markCreditDispatched(db, reservation, now) {
  if (!validTime(now)) fail('COACHING_NOT_CONFIGURED');
  return db.runTransaction(async tx => {
    const s = await transactionState(db, tx, reservation), a = fence(s, reservation.active), c = await tx.get(controlRef(db));
    if (a.stage !== 'reserved' || now < a.startedAt) fail('CREDIT_STATE_INVALID');
    let stopped = false;
    try {
      const cap = validateControl(c.exists ? c.data() : null, a.period); validateCostQuote(a.quote, now);
      if (periodAt(now) !== a.period || s.global.spentUnits + s.global.heldUnits > cap.allocatedMicros) stopped = true;
    } catch { stopped = true; }
    if (stopped || s.wallet.status !== 'active' || s.order.expiresAt !== null && now >= s.order.expiresAt) {
      settlement(tx, s, a, { status: 'cancelled', chargedUnits: 0, costResolution: 'not_dispatched', outputTokens: null }, now); return false;
    }
    const next = { ...a, stage: 'dispatching', dispatchedAt: now };
    tx.set(s.refs.walletRef, { ...s.wallet, active: next }); tx.set(s.refs.requestRef, { ...s.request, status: 'dispatching', reservation: next });
    return true;
  });
}
async function finishCredit(db, reservation, { customerSuccess, chargedUnits, measured, result }, now) {
  if (!validTime(now) || typeof customerSuccess !== 'boolean' || !uint(chargedUnits)
    || chargedUnits !== usageCost(reservation.active.quote, measured) || chargedUnits > reservation.active.quote.maxCostMicros
    || customerSuccess !== Boolean(result)) fail('INVALID_SETTLEMENT');
  const normalized = result ? normalizeCoachingResult(result) : null;
  const outcome = { status: customerSuccess ? 'completed' : 'failed', chargedUnits, costResolution: 'known', outputTokens: measured.usage.output_tokens,
    ...(normalized ? { result: normalized } : {}) };
  return db.runTransaction(async tx => {
    const s = await transactionState(db, tx, reservation);
    if (s.request.settlementHash) {
      if (s.request.settlementHash !== hash(JSON.stringify(outcome))) fail('INVALID_SETTLEMENT');
      return { duplicate: true, credits: creditView(s.wallet, now), status: s.request.status, chargedUnits: s.request.chargedUnits };
    }
    if (s.wallet.active?.stage !== 'dispatching') fail('INVALID_SETTLEMENT');
    return settlement(tx, s, reservation.active, outcome, now);
  });
}
// Trusted explicit recovery only. No HTTP export or timeout-driven refund.
async function recoverCredit(db, uid, requestId, lease, resolution, now) {
  if (!validTime(now) || typeof lease !== 'string' || !['cancel_before_dispatch', 'close_max_cost'].includes(resolution)) fail('INVALID_RECOVERY', 400);
  const refs = refsFor(db, uid, requestId, periodAt(now));
  return db.runTransaction(async tx => {
    const r = await tx.get(refs.requestRef), request = r.exists ? r.data() : null;
    if (!request?.reservation || request.reservation.lease !== lease) fail('RECOVERY_CONFLICT', 409);
    const s = await transactionState(db, tx, { uid, active: request.reservation });
    if (request.settlementHash) return { alreadySettled: true, status: request.status, credits: creditView(s.wallet, now), chargedUnits: request.chargedUnits };
    const a = fence(s, request.reservation);
    if (now - a.startedAt < 60000) fail('REQUEST_IN_PROGRESS', 409);
    if ((a.stage === 'dispatching') !== (resolution === 'close_max_cost')) fail('RECOVERY_CONFLICT', 409);
    const dispatched = a.stage === 'dispatching';
    return settlement(tx, s, a, { status: dispatched ? 'closed_unknown' : 'cancelled', chargedUnits: dispatched ? a.quote.maxCostMicros : 0,
      costResolution: dispatched ? 'maximum' : 'not_dispatched', outputTokens: null }, now);
  });
}
module.exports = { PRODUCT, MAX_LOTS, MAX_BALANCE, fail, hash, periodAt, id, exact, validTime, owner, walletRef, orderRef, refundRef, paymentRef, refundPaymentRef,
  emptyWallet, validateWallet, validateOrder, matchLot, creditView, refsFor, inspectCreditRequest, readCreditResult, reserveCredit, markCreditDispatched, finishCredit, recoverCredit };
