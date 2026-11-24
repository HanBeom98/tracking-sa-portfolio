import test from 'node:test';
import assert from 'node:assert/strict';
import quota from '../../cloud-functions/replay-coaching-quota.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { testAccess } from '../helpers/coaching-test-access.js';
const NOW = Date.parse('2026-10-25T00:00:00Z');
const id = n => `202610-settlement_case_${String(n).padStart(4, '0')}`;
const limits = { access: testAccess(), globalMonthly: 10, globalUnits: 20, unitsPerRequest: 5 };
const reserve = (db, n = 1, uid = 'tester', caps = limits, now = NOW) => quota.reserveCoachingQuota(db, uid, id(n), 'evidence-hash', caps, now);
const state = (db, r) => ({ user: db.data.get(r.userRef.path), global: db.data.get(r.globalRef.path) });
const recovery = (r, resolution = 'close_max_cost') => ({ requestId: r.active.id, lease: r.active.lease, resolution });
const snapshot = db => structuredClone([...db.data]);
const code = expected => error => error.code === expected;
async function dispatched(db, n = 1, uid = 'tester', caps = limits) {
  const r = await reserve(db, n, uid, caps); await quota.markCoachingDispatched(db, r, NOW); return r;
}

test('successful customer usage and known provider spend settle independently with unused budget released', async () => {
  const db = coachingMemoryDb(), r = await reserve(db);
  assert.equal(state(db, r).user.held, 1); assert.equal(state(db, r).user.used, 0);
  assert.equal(state(db, r).user.active.stage, 'reserved');
  await quota.markCoachingDispatched(db, r, NOW);
  assert.equal(state(db, r).user.active.stage, 'dispatching');
  assert.equal(await quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 3 }), 1);
  assert.deepEqual(state(db, r).global, { schemaVersion: 2, successfulCalls: 1, usedCalls: 1, heldCalls: 0, spentUnits: 3, heldUnits: 0 });
  assert.equal(state(db, r).user.held, 0); assert.equal(state(db, r).user.active, null);
  assert.equal((await reserve(db)).duplicate, true);
});
test('failed output restores customer usage but preserves real simulated expense and enforces remaining budget', async () => {
  const db = coachingMemoryDb(), caps = { ...limits, globalUnits: 7 }, r = await dispatched(db, 1, 'tester', caps);
  await quota.finishCoachingQuota(db, r, { customerSuccess: false, chargedUnits: 3 });
  const { user, global } = state(db, r);
  assert.equal(user.used, 0); assert.equal(user.held, 0); assert.equal(user.attempts, 1);
  assert.equal(global.spentUnits, 3); assert.equal(global.successfulCalls, 0); assert.equal(global.usedCalls, 1);
  await assert.rejects(reserve(db, 2, 'tester', caps), code('GLOBAL_BUDGET_LIMIT'));
  await assert.rejects(reserve(db), code('PREVIOUS_ATTEMPT_FAILED'));
  assert.equal(state(db, r).global.spentUnits, 3);
});
test('global attempt cap includes failed generations even when they cost zero', async () => {
  const db = coachingMemoryDb(), caps = { ...limits, globalMonthly: 1 }, r = await dispatched(db, 1, 'tester', caps);
  await quota.finishCoachingQuota(db, r, { customerSuccess: false, chargedUnits: 0 });
  await assert.rejects(reserve(db, 2, 'second', caps), code('GLOBAL_LIMIT'));
  assert.equal(state(db, r).user.used, 0); assert.equal(state(db, r).global.spentUnits, 0);
});
test('settlement cannot run before dispatch, twice, with invalid amounts or using another lease', async () => {
  const db = coachingMemoryDb(), r = await reserve(db), before = snapshot(db);
  await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 1 }), code('INVALID_SETTLEMENT'));
  assert.deepEqual(snapshot(db), before); await quota.markCoachingDispatched(db, r, NOW);
  for (const amount of [-1, 1.5, NaN, Infinity, 6, Number.MAX_SAFE_INTEGER]) {
    const start = snapshot(db);
    await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: false, chargedUnits: amount }), code('INVALID_SETTLEMENT'));
    assert.deepEqual(snapshot(db), start);
  }
  await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: 1, chargedUnits: 1 }), code('INVALID_SETTLEMENT'));
  await assert.rejects(quota.finishCoachingQuota(db, { ...r, active: { ...r.active, lease: 'other' } }, { customerSuccess: true, chargedUnits: 1 }), code('QUOTA_STATE_INVALID'));
  await quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 1 });
  const settled = snapshot(db);
  await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 1 }), code('QUOTA_STATE_INVALID'));
  assert.deepEqual(snapshot(db), settled);
});
test('dispatch is one-way and a repeated dispatch marker cannot authorize another call', async () => {
  const db = coachingMemoryDb(), r = await dispatched(db);
  await assert.rejects(quota.markCoachingDispatched(db, r, NOW), code('QUOTA_STATE_INVALID'));
  assert.equal(state(db, r).user.attempts, 1); assert.equal(state(db, r).global.heldUnits, 5);
});
test('stale unstarted work can be explicitly cancelled without expense and blocks a late dispatch', async () => {
  const db = coachingMemoryDb(), r = await reserve(db);
  await assert.rejects(quota.recoverCoachingQuota(db, 'tester', recovery(r, 'cancel_before_dispatch'), NOW), code('REQUEST_IN_PROGRESS'));
  await assert.rejects(quota.recoverCoachingQuota(db, 'tester', recovery(r), NOW + 61000), code('RECOVERY_CONFLICT'));
  const closed = await quota.recoverCoachingQuota(db, 'tester', recovery(r, 'cancel_before_dispatch'), NOW + 61000);
  assert.equal(closed.status, 'cancelled'); assert.equal(closed.chargedUnits, 0);
  assert.equal(state(db, r).global.usedCalls, 0); assert.equal(state(db, r).global.heldUnits, 0);
  await assert.rejects(quota.markCoachingDispatched(db, r, NOW + 61000), code('QUOTA_STATE_INVALID'));
  await assert.rejects(reserve(db), code('PREVIOUS_ATTEMPT_FAILED'));
});
test('unknown dispatched work keeps maximum cost on explicit closure and fences late settlement from newer work', async () => {
  const db = coachingMemoryDb(), r = await dispatched(db);
  await assert.rejects(quota.recoverCoachingQuota(db, 'tester', recovery(r, 'cancel_before_dispatch'), NOW + 61000), code('RECOVERY_CONFLICT'));
  const closed = await quota.recoverCoachingQuota(db, 'tester', recovery(r), NOW + 61000);
  assert.equal(closed.status, 'closed_unknown'); assert.equal(closed.used, 0); assert.equal(closed.chargedUnits, 5);
  assert.equal(state(db, r).global.spentUnits, 5); assert.equal(state(db, r).global.successfulCalls, 0);
  const next = await dispatched(db, 2), before = snapshot(db);
  await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 2 }), code('QUOTA_STATE_INVALID'));
  await assert.rejects(quota.markCoachingDispatched(db, r, NOW + 61000), code('QUOTA_STATE_INVALID'));
  assert.deepEqual(snapshot(db), before);
  assert.equal((await quota.recoverCoachingQuota(db, 'tester', recovery(r), NOW + 62000)).alreadySettled, true);
  assert.deepEqual(snapshot(db), before);
  await quota.finishCoachingQuota(db, next, { customerSuccess: true, chargedUnits: 2 });
  assert.equal(state(db, r).global.spentUnits, 7); assert.equal(state(db, r).user.used, 1);
});
test('wrong recovery lease cannot mutate state and a settled success is never refunded by recovery', async () => {
  const db = coachingMemoryDb(), r = await dispatched(db), before = snapshot(db);
  await assert.rejects(quota.recoverCoachingQuota(db, 'tester', { ...recovery(r), lease: 'stale' }, NOW + 61000), code('RECOVERY_CONFLICT'));
  assert.deepEqual(snapshot(db), before);
  await quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 3 });
  const settled = snapshot(db), result = await quota.recoverCoachingQuota(db, 'tester', recovery(r), NOW + 61000);
  assert.equal(result.alreadySettled, true); assert.equal(result.used, 1); assert.equal(result.chargedUnits, 3);
  assert.deepEqual(snapshot(db), settled);
});
test('concurrent recovery versus generation settlement has exactly one terminal accounting outcome', async () => {
  for (const recoveryFirst of [true, false]) {
    const db = coachingMemoryDb(), r = await dispatched(db);
    const recover = () => quota.recoverCoachingQuota(db, 'tester', recovery(r), NOW + 61000);
    const finish = () => quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 3 });
    await Promise.allSettled(recoveryFirst ? [recover(), finish()] : [finish(), recover()]);
    const { user, global } = state(db, r);
    assert.equal(user.recent.length, 1); assert.equal(user.held, 0); assert.equal(global.heldCalls, 0);
    assert.equal(global.usedCalls, 1); assert.equal(global.spentUnits, recoveryFirst ? 5 : 3);
    assert.equal(user.used, recoveryFirst ? 0 : 1);
  }
});
test('recovery across Korean month boundary settles the original cost pool without resetting the access period', async () => {
  const db = coachingMemoryDb(), r = await dispatched(db), nextMonth = Date.parse('2026-10-31T15:00:00Z');
  await quota.recoverCoachingQuota(db, 'tester', recovery(r), nextMonth);
  const next = await quota.reserveCoachingQuota(db, 'tester', '202611-settlement_next_month', 'evidence-hash', limits, nextMonth);
  assert.equal(state(db, r).global.spentUnits, 5); assert.equal(state(db, next).global.spentUnits, 0);
  assert.equal(state(db, next).user.used, 0); assert.equal(state(db, next).user.attempts, 2);
  assert.equal(state(db, next).user.access.id, limits.access.id);
});
test('legacy and corrupt ledger documents fail closed instead of being reset or silently migrated', async () => {
  for (const mutate of [s => { delete s.schemaVersion; }, s => { s.held = 0; }, s => { s.attempts = 0; }, s => { s.active.units = -1; }]) {
    const db = coachingMemoryDb(), r = await reserve(db); mutate(db.data.get(r.userRef.path)); const before = snapshot(db);
    await assert.rejects(reserve(db, 2), code('QUOTA_STATE_INVALID')); assert.deepEqual(snapshot(db), before);
  }
});
