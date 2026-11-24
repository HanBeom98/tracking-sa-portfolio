const { createHash, randomUUID } = require('node:crypto');
const { MAX_ATTEMPTS, validateCoachingAccess, sameCoachingAccess } = require('./replay-coaching-access.js');
const { ACCOUNTING, POLICY, costMicros, validateCostQuote, sameCostQuote, usageCost, validateControl, controlRef } = require('./replay-coaching-cost.js');
const { normalizeCoachingResult } = require('./replay-coaching-result.js');
const { entitlementRef, validateReplayEntitlement } = require('./replay-coaching-entitlement.js');
const fail = (code, status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const hash = value => createHash('sha256').update(value).digest('hex');
const periodAt = now => new Date(now + 9 * 3600000).toISOString().slice(0, 7).replace('-', '');
const dayAt = now => new Date(now + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
const monetary = state => state.accounting === ACCOUNTING;
const validUnits = value => Number.isSafeInteger(value) && value >= 0;
const nonempty = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
function counters(value, names) {
  if (names.some(k => !validUnits(value[k]))) fail('QUOTA_STATE_INVALID');
  return value;
}
function globalState(data, money = Boolean(data?.accounting)) {
  const state = data || { schemaVersion: 2, successfulCalls: 0, usedCalls: 0, heldCalls: 0, spentUnits: 0, heldUnits: 0,
    ...(money ? { accounting: ACCOUNTING } : {}) };
  counters(state, ['successfulCalls', 'usedCalls', 'heldCalls', 'spentUnits', 'heldUnits']);
  if (state.schemaVersion !== 2 || state.successfulCalls > state.usedCalls
    || (money ? !monetary(state) : state.accounting !== undefined)) fail('QUOTA_STATE_INVALID');
  return state;
}
function windowState(data, active = null, money = false) {
  counters(data, ['used', 'held', 'attempts']);
  try { validateCoachingAccess(data.access); } catch { fail('QUOTA_STATE_INVALID'); }
  if (data.attempts > data.access.attemptLimit || data.used + data.held > data.access.successLimit
    || !Array.isArray(data.recent) || data.recent.length > MAX_ATTEMPTS
    || data.held !== Number(Boolean(active)) || data.attempts !== data.recent.length + data.held
    || data.recent.some(r => !r || !nonempty(r.id) || !nonempty(r.digest) || !nonempty(r.lease)
      || !['completed', 'failed', 'cancelled', 'closed_unknown'].includes(r.status)
      || !['known', 'not_dispatched', 'maximum'].includes(r.costResolution) || !validUnits(r.chargedUnits))
    || new Set(data.recent.map(r => r.id)).size !== data.recent.length
    || data.used !== data.recent.filter(r => r.status === 'completed').length) fail('QUOTA_STATE_INVALID');
  if (active && (active.accessId !== data.access.id || !nonempty(active.id) || !active.id.startsWith(`${active.period}-`)
    || !nonempty(active.digest) || !nonempty(active.lease)
    || !validUnits(active.units) || active.units === 0 || !validUnits(active.startedAt) || active.period !== periodAt(active.startedAt)
    || active.startedAt < data.access.startsAt || active.startedAt >= data.access.endsAt
    || !['reserved', 'dispatching'].includes(active.stage)
    || active.stage === 'dispatching' && (!validUnits(active.dispatchedAt) || active.dispatchedAt < active.startedAt)
      || data.recent.some(r => r.id === active.id)
      || active.entitlementRequired !== undefined && (active.entitlementRequired !== true || !money))) fail('QUOTA_STATE_INVALID');
  if (money) {
    if (!validUnits(data.spentUnits) || !Array.isArray(data.days) || data.days.length > 33
      || new Set(data.days.map(d => d.day)).size !== data.days.length) fail('QUOTA_STATE_INVALID');
    const records = [...data.recent, ...(active ? [active] : [])];
    for (const r of records) {
      try { validateCostQuote(r.quote); } catch { fail('QUOTA_STATE_INVALID'); }
      if (!/^\d{8}$/.test(r.day) || r.day < dayAt(data.access.startsAt) || r.day > dayAt(data.access.endsAt - 1)
        || !data.days.some(d => d.day === r.day) || (r === active ? r.units !== r.quote.maxCostMicros || r.day !== dayAt(r.startedAt)
          : r.chargedUnits > r.quote.maxCostMicros)) fail('QUOTA_STATE_INVALID');
      if (r !== active) {
        if (r.result !== undefined) {
          if (r.status !== 'completed') fail('QUOTA_STATE_INVALID');
          try { normalizeCoachingResult(r.result); } catch { fail('QUOTA_STATE_INVALID'); }
        }
        const resolution = { completed: 'known', failed: 'known', cancelled: 'not_dispatched', closed_unknown: 'maximum' }[r.status];
        if (r.costResolution !== resolution || (resolution === 'known'
          ? !validUnits(r.outputTokens) || r.outputTokens > r.quote.maxOutputTokens
            || r.chargedUnits !== costMicros(r.quote.inputTokens, r.outputTokens, r.quote.rateVersion)
          : r.outputTokens !== null || r.chargedUnits !== (resolution === 'maximum' ? r.quote.maxCostMicros : 0))) fail('QUOTA_STATE_INVALID');
      }
    }
    if (data.spentUnits !== data.recent.reduce((n, r) => n + r.chargedUnits, 0)) fail('QUOTA_STATE_INVALID');
    for (const d of data.days) {
      if (!/^\d{8}$/.test(d.day) || !validUnits(d.used) || !validUnits(d.attempts)
        || d.attempts === 0 || d.attempts > POLICY.dailyAttempts || d.used + Number(active?.day === d.day) > POLICY.dailySuccess
        || d.attempts !== records.filter(r => r.day === d.day).length
        || d.used !== data.recent.filter(r => r.day === d.day && r.status === 'completed').length) fail('QUOTA_STATE_INVALID');
    }
  }
  return data;
}
function userState(data) {
  if (data.schemaVersion !== 3 || data.accounting !== undefined && !monetary(data)) fail('QUOTA_STATE_INVALID');
  windowState(data, data.active, monetary(data));
  if (!Array.isArray(data.previous) || data.previous.length > 2) fail('QUOTA_STATE_INVALID');
  const windows = [data, ...data.previous];
  for (let n = 1; n < windows.length; n++) {
    windowState(windows[n], null, monetary(data));
    if (windows[n].access.endsAt > windows[n - 1].access.startsAt) fail('QUOTA_STATE_INVALID');
  }
  if (new Set(windows.map(w => w.access.id)).size !== windows.length) fail('QUOTA_STATE_INVALID');
  // Includes current + two retained access windows and their bounded results.
  // Leave room for Firestore's document overhead below the 1 MiB hard limit.
  if (monetary(data) && Buffer.byteLength(JSON.stringify(data), 'utf8') > 700000) fail('QUOTA_STATE_INVALID');
  return data;
}
const userRefFor = (db, uid, money) => db.collection('_replay_coaching_users').doc(money ? `${ACCOUNTING}_${hash(uid)}` : hash(uid));
const refsFor = (db, uid, period, money = false) => ({ userRef: userRefFor(db, uid, money),
  globalRef: db.collection('_replay_coaching_months').doc(money ? `${ACCOUNTING}_${period}` : period) });
function existingRequest(old, requestId, digest, now) {
  for (const bucket of old ? [old, ...old.previous] : []) {
    const previous = bucket.recent.find(r => r.id === requestId);
    if (!previous) continue;
    if (previous.digest !== digest) fail('IDEMPOTENCY_CONFLICT', 409);
    if (previous.status !== 'completed') fail('PREVIOUS_ATTEMPT_FAILED', 409);
    return { duplicate: true, used: bucket.used, ...(previous.result ? { result: normalizeCoachingResult(previous.result) } : {}) };
  }
  if (old?.active) {
    if (old.active.id === requestId && old.active.digest !== digest) fail('IDEMPOTENCY_CONFLICT', 409);
    fail(now - old.active.startedAt > 60000 ? 'REQUEST_UNRESOLVED' : 'REQUEST_IN_PROGRESS', 409);
  }
  return null;
}
async function inspectCostedRequest(db, uid, requestId, digest, now, { requireEntitlement = false } = {}) {
  const { userRef } = refsFor(db, uid, periodAt(now), true);
  return db.runTransaction(async tx => {
    const [snapshot, control] = await Promise.all([tx.get(userRef), tx.get(controlRef(db))]);
    const old = snapshot.exists ? userState(snapshot.data()) : null;
    if (old && !monetary(old)) fail('QUOTA_STATE_INVALID');
    if (requireEntitlement) {
      const profile = await tx.get(entitlementRef(db, uid));
      validateReplayEntitlement(profile.exists ? profile.data() : null, uid, now, { allowExpired: true });
    }
    const existing = existingRequest(old, requestId, digest, now);
    if (existing) return existing;
    validateControl(control.exists ? control.data() : null, periodAt(now));
    return null;
  });
}

// Read-only lookup scoped exclusively by the verified caller UID. Never falls
// through to token counting, generation or a new reservation on a cache miss.
async function readCostedCoachingResult(db, uid, requestId, digest, now) {
  if (!nonempty(uid) || !/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(requestId) || !nonempty(digest) || !validUnits(now)) fail('INVALID_REQUEST', 400);
  return db.runTransaction(async tx => {
    const [snapshot, profile] = await Promise.all([tx.get(userRefFor(db, uid, true)), tx.get(entitlementRef(db, uid))]);
    validateReplayEntitlement(profile.exists ? profile.data() : null, uid, now, { allowExpired: true });
    if (!snapshot.exists) return null;
    const user = userState(snapshot.data());
    if (!monetary(user)) fail('QUOTA_STATE_INVALID');
    return existingRequest(user, requestId, digest, now);
  });
}
function fenced(user, global, expected) {
  const active = user.active;
  if (!active || !expected || ['id', 'digest', 'lease', 'period', 'accessId', 'units'].some(k => active[k] !== expected[k])
    || monetary(user) !== monetary(global) || monetary(user) && (!sameCostQuote(active.quote, expected.quote) || active.day !== expected.day)
    || global.heldCalls < 1 || global.heldUnits < active.units) fail('QUOTA_STATE_INVALID');
  return active;
}
function writeSettlement(tx, refs, user, global, active, { success, chargedUnits, costResolution, dispatched, status, outputTokens = null, result }) {
  const nextUser = { ...user, used: user.used + Number(success), held: 0, active: null,
    recent: [...user.recent, { id: active.id, digest: active.digest, lease: active.lease,
      status, chargedUnits, costResolution, ...(monetary(user) ? { quote: active.quote, day: active.day, outputTokens,
        ...(result ? { result } : {}) } : {}) }],
    ...(monetary(user) ? { spentUnits: user.spentUnits + chargedUnits,
      days: user.days.map(d => d.day === active.day ? { ...d, used: d.used + Number(success) } : d) } : {}) };
  const nextGlobal = { ...global, successfulCalls: global.successfulCalls + Number(success),
    usedCalls: global.usedCalls + Number(dispatched), heldCalls: global.heldCalls - 1,
    spentUnits: global.spentUnits + chargedUnits, heldUnits: global.heldUnits - active.units };
  userState(nextUser); globalState(nextGlobal);
  tx.set(refs.userRef, nextUser); tx.set(refs.globalRef, nextGlobal);
  return nextUser.used;
}

async function reserveCoachingQuota(db, uid, requestId, digest, limits, now) {
  if (!validUnits(now)) fail('COACHING_NOT_CONFIGURED');
  const period = periodAt(now);
  if (!/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(requestId)) fail('INVALID_REQUEST_ID', 400);
  if (!nonempty(uid) || !nonempty(digest) || !validUnits(now)
    || !limits || ['globalMonthly', 'globalUnits', 'unitsPerRequest'].some(k => !validUnits(limits[k]) || limits[k] === 0)
    || limits.unitsPerRequest > limits.globalUnits) fail('COACHING_NOT_CONFIGURED');
  const access = validateCoachingAccess(limits.access);
  const money = limits.accounting === ACCOUNTING;
  if (limits.requireEntitlement !== undefined && (limits.requireEntitlement !== true || !money)) fail('COACHING_NOT_CONFIGURED');
  if (limits.accounting !== undefined && !money) fail('COACHING_NOT_CONFIGURED');
  if (money) {
    validateCostQuote(limits.quote, now);
    if (limits.quote.rateVersion !== POLICY.rateVersion || limits.unitsPerRequest !== limits.quote.maxCostMicros || !validUnits(limits.userUnits) || limits.userUnits < 1
      || limits.userUnits > POLICY.maxUserMicros || limits.globalUnits > POLICY.maxGlobalMicros
      || limits.globalMonthly > 10000) fail('COACHING_NOT_CONFIGURED');
  }
  const refs = refsFor(db, uid, period, money);
  return db.runTransaction(async tx => {
    const [u, g, control] = await Promise.all([tx.get(refs.userRef), tx.get(refs.globalRef), money ? tx.get(controlRef(db)) : null]);
    const old = u.exists ? userState(u.data()) : null;
    if (old && monetary(old) !== money) fail('QUOTA_STATE_INVALID');
    const global = globalState(g.exists ? g.data() : null, money);
    if (limits.requireEntitlement) {
      const profile = await tx.get(entitlementRef(db, uid));
      validateReplayEntitlement(profile.exists ? profile.data() : null, uid, now, { expectedAccess: access });
    }
    const existing = existingRequest(old, requestId, digest, now);
    if (existing) return existing;
    if (old && (old.access.id === access.id ? !sameCoachingAccess(old.access, access)
      : access.startsAt < old.access.endsAt || old.previous.some(w => w.access.id === access.id))) fail('ACCESS_PERIOD_CONFLICT', 409);
    if (now < access.startsAt) fail('ACCESS_NOT_STARTED', 403);
    if (now >= access.endsAt) fail('ACCESS_EXPIRED', 403);
    if (!requestId.startsWith(`${period}-`)) fail('INVALID_REQUEST_ID', 400);
    const allocated = money ? validateControl(control.exists ? control.data() : null, period).allocatedMicros : limits.globalUnits;
    const previous = old && old.access.id !== access.id
      ? [{ access: old.access, used: old.used, held: 0, attempts: old.attempts, recent: old.recent,
        ...(money ? { spentUnits: old.spentUnits, days: old.days } : {}) }, ...old.previous].slice(0, 2)
      : old?.previous || [];
    const user = old?.access.id === access.id ? old
      : { schemaVersion: 3, access, used: 0, held: 0, attempts: 0, active: null, recent: [], previous,
        ...(money ? { accounting: ACCOUNTING, spentUnits: 0, days: [] } : {}) };
    if (user.attempts >= access.attemptLimit) fail('ATTEMPT_LIMIT', 429);
    if (user.used + user.held >= access.successLimit) fail('USER_LIMIT', 429);
    if (global.usedCalls + global.heldCalls >= limits.globalMonthly) fail('GLOBAL_LIMIT', 429);
    if (global.spentUnits + global.heldUnits + limits.unitsPerRequest > Math.min(limits.globalUnits, allocated)) fail('GLOBAL_BUDGET_LIMIT', 429);
    const day = dayAt(now), daily = money && user.days.find(d => d.day === day);
    if (money) {
      if (user.spentUnits + limits.unitsPerRequest > limits.userUnits) fail('USER_BUDGET_LIMIT', 429);
      if ((daily?.used || 0) >= POLICY.dailySuccess) fail('DAILY_USER_LIMIT', 429);
      if ((daily?.attempts || 0) >= POLICY.dailyAttempts) fail('DAILY_ATTEMPT_LIMIT', 429);
    }
    const active = { id: requestId, digest, lease: randomUUID(), period, accessId: access.id, stage: 'reserved',
      units: limits.unitsPerRequest, startedAt: now, ...(money ? { quote: { ...limits.quote }, day } : {}),
      ...(limits.requireEntitlement ? { entitlementRequired: true } : {}) };
    const nextUser = { ...user, held: 1, attempts: user.attempts + 1, active,
      ...(money ? { days: daily ? user.days.map(d => d.day === day ? { ...d, attempts: d.attempts + 1 } : d)
        : [...user.days, { day, used: 0, attempts: 1 }] } : {}) };
    const nextGlobal = { ...global, heldCalls: global.heldCalls + 1, heldUnits: global.heldUnits + active.units };
    userState(nextUser); globalState(nextGlobal);
    tx.set(refs.userRef, nextUser); tx.set(refs.globalRef, nextGlobal);
    return { ...refs, active, used: user.used, duplicate: false,
      ...(limits.requireEntitlement ? { entitlementUid: uid } : {}) };
  });
}

async function markCoachingDispatched(db, reservation, now) {
  return db.runTransaction(async tx => {
    const [u, g] = await Promise.all([tx.get(reservation.userRef), tx.get(reservation.globalRef)]);
    if (!u.exists || !g.exists) fail('QUOTA_STATE_INVALID');
    const user = userState(u.data()), global = globalState(g.data());
    const active = fenced(user, global, reservation.active);
    if (active.stage !== 'reserved' || !validUnits(now) || now < active.startedAt) fail('QUOTA_STATE_INVALID');
    let stopped = false;
    if (monetary(user)) {
      const control = await tx.get(controlRef(db));
      try {
        const cap = validateControl(control.exists ? control.data() : null, active.period);
        validateCostQuote(active.quote, now);
        // A reservation in the old cost month cannot dispatch in the new one.
        if (periodAt(now) !== active.period || global.spentUnits + global.heldUnits > cap.allocatedMicros) stopped = true;
      } catch { stopped = true; }
    }
    if (active.entitlementRequired) {
      const uid = reservation.entitlementUid;
      if (!nonempty(uid) || userRefFor(db, uid, true).path !== reservation.userRef.path) fail('QUOTA_STATE_INVALID');
      const profile = await tx.get(entitlementRef(db, uid));
      try { validateReplayEntitlement(profile.exists ? profile.data() : null, uid, now, { expectedAccess: user.access }); }
      catch { stopped = true; }
    }
    if (now >= user.access.endsAt || stopped) {
      writeSettlement(tx, reservation, user, global, active, { success: false, chargedUnits: 0,
        costResolution: 'not_dispatched', dispatched: false, status: 'cancelled' });
      return false;
    }
    // Commit BEFORE starting generation. A lost acknowledgement must not cause
    // another generation call; it leaves an explicitly ambiguous reservation.
    tx.set(reservation.userRef, { ...user, active: { ...active, stage: 'dispatching', dispatchedAt: now } });
    return true;
  });
}

async function finishCoachingQuota(db, reservation, { customerSuccess, chargedUnits, measured, result } = {}) {
  if (typeof customerSuccess !== 'boolean' || !validUnits(chargedUnits)) fail('INVALID_SETTLEMENT');
  const normalizedResult = result === undefined ? undefined : normalizeCoachingResult(result);
  return db.runTransaction(async tx => {
    const [u, g] = await Promise.all([tx.get(reservation.userRef), tx.get(reservation.globalRef)]);
    if (!u.exists || !g.exists) fail('QUOTA_STATE_INVALID');
    const user = userState(u.data()), global = globalState(g.data());
    const active = fenced(user, global, reservation.active);
    if (active.stage !== 'dispatching' || chargedUnits > active.units) fail('INVALID_SETTLEMENT');
    if (monetary(user) && usageCost(active.quote, measured) !== chargedUnits) fail('INVALID_SETTLEMENT');
    if (normalizedResult && (!monetary(user) || !customerSuccess)) fail('INVALID_SETTLEMENT');
    return writeSettlement(tx, reservation, user, global, active, { success: customerSuccess, chargedUnits,
      costResolution: 'known', dispatched: true, status: customerSuccess ? 'completed' : 'failed',
      ...(monetary(user) ? { outputTokens: measured.usage.output_tokens, result: normalizedResult } : {}) });
  });
}

// Trusted backend recovery primitive only: no HTTP endpoint or client privilege.
// Caller must read the live request+lease and explicitly choose a resolution.
async function recoverCoachingQuota(db, uid, { requestId, lease, resolution, accounting } = {}, now) {
  if (!nonempty(uid) || !nonempty(requestId) || !nonempty(lease) || !validUnits(now)
    || !['cancel_before_dispatch', 'close_max_cost'].includes(resolution)) fail('INVALID_RECOVERY', 400);
  if (accounting !== undefined && accounting !== ACCOUNTING) fail('INVALID_RECOVERY', 400);
  const money = accounting === ACCOUNTING;
  const userRef = userRefFor(db, uid, money);
  return db.runTransaction(async tx => {
    const u = await tx.get(userRef);
    if (!u.exists) fail('RECOVERY_CONFLICT', 409);
    const user = userState(u.data());
    if (monetary(user) !== money) fail('QUOTA_STATE_INVALID');
    for (const bucket of [user, ...user.previous]) {
      const previous = bucket.recent.find(r => r.id === requestId && r.lease === lease);
      if (previous) return { alreadySettled: true, used: bucket.used, status: previous.status, chargedUnits: previous.chargedUnits };
    }
    const active = user.active;
    if (!active || active.id !== requestId || active.lease !== lease) fail('RECOVERY_CONFLICT', 409);
    if (now - active.startedAt < 60000) fail('REQUEST_IN_PROGRESS', 409);
    const { globalRef } = refsFor(db, uid, active.period, money);
    const g = await tx.get(globalRef);
    if (!g.exists) fail('QUOTA_STATE_INVALID');
    const global = globalState(g.data()); fenced(user, global, active);
    const dispatched = active.stage === 'dispatching';
    if (dispatched !== (resolution === 'close_max_cost')) fail('RECOVERY_CONFLICT', 409);
    const chargedUnits = dispatched ? active.units : 0;
    const status = dispatched ? 'closed_unknown' : 'cancelled';
    const used = writeSettlement(tx, { userRef, globalRef }, user, global, active, { success: false, chargedUnits,
      costResolution: dispatched ? 'maximum' : 'not_dispatched', dispatched, status });
    return { alreadySettled: false, used, status, chargedUnits };
  });
}
module.exports = { reserveCoachingQuota, markCoachingDispatched, finishCoachingQuota, recoverCoachingQuota, inspectCostedRequest, readCostedCoachingResult, periodAt, hash };
