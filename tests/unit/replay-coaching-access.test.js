import test from 'node:test';
import assert from 'node:assert/strict';
import quota from '../../cloud-functions/replay-coaching-quota.js';
import accessModule from '../../cloud-functions/replay-coaching-access.js';
import service from '../../cloud-functions/replay-coaching-service.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { testAccess, testAccessEnv } from '../helpers/coaching-test-access.js';
const NOW = Date.parse('2026-10-25T00:00:00Z');
const code = value => error => error.code === value;
const id = (now, n) => `${quota.periodAt(now)}-access_request_${String(n).padStart(5, '0')}`;
const limits = access => ({ access, globalMonthly: 1000, globalUnits: 10000, unitsPerRequest: 5 });
const reserve = (db, now, n, access = testAccess()) => quota.reserveCoachingQuota(db, 'tester', id(now, n), 'same-evidence', limits(access), now);
const state = (db, r) => db.data.get(r.userRef.path);
async function complete(db, now, n, access, success = true) {
  const r = await reserve(db, now, n, access); await quota.markCoachingDispatched(db, r, now);
  await quota.finishCoachingQuota(db, r, { customerSuccess: success, chargedUnits: success ? 1 : 0 }); return r;
}
const env = () => ({ REPLAY_COACHING_TEST_UIDS: 'tester', ...testAccessEnv(),
  REPLAY_COACHING_GLOBAL_MONTHLY: '1000', REPLAY_COACHING_GLOBAL_UNITS: '10000', REPLAY_COACHING_UNITS_PER_REQUEST: '5' });

test('explicit server period and 50/70 bounds are required; old monthly config cannot silently enable access', () => {
  const config = { ...env(), REPLAY_COACHING_USER_LIMIT: '50', REPLAY_COACHING_ATTEMPT_LIMIT: '70' };
  assert.equal(service.readConfig(config).limits.access.successLimit, 50);
  assert.equal(service.readConfig(config).limits.access.attemptLimit, 70);
  for (const mutate of [e => { delete e.REPLAY_COACHING_TEST_PERIOD_ID; }, e => { delete e.REPLAY_COACHING_ATTEMPT_LIMIT; },
    e => { e.REPLAY_COACHING_USER_LIMIT = '51'; }, e => { e.REPLAY_COACHING_ATTEMPT_LIMIT = '71'; },
    e => { e.REPLAY_COACHING_ATTEMPT_LIMIT = '49'; }, e => { e.REPLAY_COACHING_TEST_PERIOD_START = '2026-10-25'; },
    e => { e.REPLAY_COACHING_TEST_PERIOD_END = '2026-10-26T00:00:00.000Z'; }, e => { e.REPLAY_COACHING_TEST_PERIOD_ID = '../oops'; }]) {
    const next = { ...config }; mutate(next); assert.throws(() => service.readConfig(next), code('COACHING_NOT_CONFIGURED'));
  }
});
test('50 completed analyses consume the success limit and earliest receipt is retained beyond 20', async () => {
  const db = coachingMemoryDb(), access = testAccess({ successLimit: 50, attemptLimit: 70 }); let r;
  for (let n = 1; n <= 50; n++) r = await complete(db, NOW, n, access);
  assert.equal(state(db, r).used, 50); assert.equal(state(db, r).recent.length, 50);
  await assert.rejects(reserve(db, NOW, 51, access), code('USER_LIMIT'));
  const before = structuredClone([...db.data]); assert.equal((await reserve(db, NOW, 1, access)).duplicate, true);
  assert.deepEqual([...db.data], before);
});
test('20 failures plus 50 successes fit 70 attempts with full duplicate history and no failed-success charge', async () => {
  const db = coachingMemoryDb(), access = testAccess({ successLimit: 50, attemptLimit: 70 }); let r;
  for (let n = 1; n <= 70; n++) r = await complete(db, NOW, n, access, n > 20);
  assert.equal(state(db, r).used, 50); assert.equal(state(db, r).attempts, 70); assert.equal(state(db, r).recent.length, 70);
  assert.equal(db.data.get(r.globalRef.path).usedCalls, 70); assert.equal(db.data.get(r.globalRef.path).spentUnits, 50);
  await assert.rejects(reserve(db, NOW, 71, access), code('ATTEMPT_LIMIT'));
  await assert.rejects(reserve(db, NOW, 1, access), code('PREVIOUS_ATTEMPT_FAILED'));
  assert.equal((await reserve(db, NOW, 21, access)).duplicate, true);
});
test('access starts inclusively and expires exclusively; fresh calls outside it make no writes', async () => {
  const access = testAccess(), db = coachingMemoryDb();
  for (const [time, expected] of [[access.startsAt - 1, 'ACCESS_NOT_STARTED'], [access.endsAt, 'ACCESS_EXPIRED']]) {
    await assert.rejects(reserve(db, time, 1, access), code(expected)); assert.equal(db.data.size, 0);
  }
  const r = await complete(db, access.startsAt, 1, access);
  const atEnd = await quota.reserveCoachingQuota(db, 'tester', id(access.startsAt, 1), 'same-evidence', limits(access), access.endsAt);
  assert.equal(atEnd.duplicate, true); assert.equal(state(db, r).used, 1);
});
test('calendar month crossing changes only the global pool and never grants a fresh customer quota', async () => {
  const db = coachingMemoryDb(), access = testAccess(), beforeMonth = Date.parse('2026-10-31T14:59:59Z'), afterMonth = beforeMonth + 1000;
  const first = await complete(db, beforeMonth, 1, access), second = await complete(db, afterMonth, 2, access);
  assert.equal(state(db, second).used, 2); assert.equal(state(db, second).attempts, 2);
  assert.notEqual(first.globalRef.path, second.globalRef.path);
  assert.equal(db.data.get(first.globalRef.path).spentUnits, 1); assert.equal(db.data.get(second.globalRef.path).spentUnits, 1);
  await assert.rejects(reserve(db, afterMonth, 3, access), code('USER_LIMIT'));
  assert.equal((await quota.reserveCoachingQuota(db, 'tester', id(beforeMonth, 1), 'same-evidence', limits(access), afterMonth)).duplicate, true);
});
test('renewal applies once, retains prior receipts and rejects overlapping, edited or stale period grants', async () => {
  const db = coachingMemoryDb(), firstAccess = testAccess(), first = await complete(db, NOW, 1, firstAccess);
  await complete(db, NOW, 2, firstAccess);
  const nextAccess = testAccess({ id: 'test-nov25-dec25', startsAt: firstAccess.endsAt, endsAt: Date.parse('2026-12-25T00:00:00Z') });
  const next = await complete(db, nextAccess.startsAt, 3, nextAccess);
  assert.equal(state(db, next).used, 1); assert.equal(state(db, next).previous[0].used, 2);
  const oldReceipt = await quota.reserveCoachingQuota(db, 'tester', id(NOW, 1), 'same-evidence', limits(nextAccess), nextAccess.startsAt);
  assert.equal(oldReceipt.duplicate, true); assert.equal(oldReceipt.used, 2); assert.equal(state(db, next).used, 1);
  assert.equal((await quota.recoverCoachingQuota(db, 'tester', { requestId: first.active.id, lease: first.active.lease,
    resolution: 'close_max_cost' }, nextAccess.startsAt)).used, 2);
  for (const wrong of [firstAccess, { ...nextAccess, endsAt: nextAccess.endsAt + 86400000 },
    { ...nextAccess, successLimit: 3 }, { ...nextAccess, id: 'overlap', startsAt: nextAccess.startsAt - 86400000 }]) {
    await assert.rejects(reserve(db, nextAccess.startsAt, 4, wrong), code('ACCESS_PERIOD_CONFLICT'));
  }
  await complete(db, nextAccess.startsAt, 4, nextAccess);
  await assert.rejects(reserve(db, nextAccess.startsAt, 5, nextAccess), code('USER_LIMIT'));
  assert.equal(state(db, next).used, 2);
});
test('renewal cannot bypass an unresolved prior period; recovery keeps spend in its original month', async () => {
  const db = coachingMemoryDb(), access = testAccess({ id: 'oct01-nov01', startsAt: Date.parse('2026-10-01T00:00:00Z'), endsAt: Date.parse('2026-11-01T00:00:00Z') });
  const time = Date.parse('2026-10-31T14:00:00Z'), r = await reserve(db, time, 1, access);
  await quota.markCoachingDispatched(db, r, time);
  const next = testAccess({ id: 'nov01-dec01', startsAt: access.endsAt, endsAt: Date.parse('2026-12-01T00:00:00Z') });
  await assert.rejects(reserve(db, next.startsAt, 2, next), code('REQUEST_UNRESOLVED'));
  await quota.recoverCoachingQuota(db, 'tester', { requestId: r.active.id, lease: r.active.lease, resolution: 'close_max_cost' }, next.startsAt);
  const after = await complete(db, next.startsAt, 2, next);
  assert.equal(state(db, after).used, 1); assert.equal(state(db, after).previous[0].used, 0);
  assert.equal(db.data.get(r.globalRef.path).spentUnits, 5); assert.equal(db.data.get(after.globalRef.path).spentUnits, 1);
  await assert.rejects(quota.finishCoachingQuota(db, r, { customerSuccess: true, chargedUnits: 2 }), code('QUOTA_STATE_INVALID'));
});
test('expiry between reservation and dispatch cancels without generation expense; started work can settle after expiry', async () => {
  const access = testAccess(), db = coachingMemoryDb(), time = access.endsAt - 1;
  const expired = await reserve(db, time, 1, access);
  assert.equal(await quota.markCoachingDispatched(db, expired, access.endsAt), false);
  assert.equal(state(db, expired).held, 0); assert.equal(state(db, expired).recent[0].status, 'cancelled');
  assert.equal(db.data.get(expired.globalRef.path).usedCalls, 0); assert.equal(db.data.get(expired.globalRef.path).spentUnits, 0);
  const allowed = await reserve(db, time, 2, access); assert.equal(await quota.markCoachingDispatched(db, allowed, time), true);
  assert.equal(await quota.finishCoachingQuota(db, allowed, { customerSuccess: true, chargedUnits: 2 }), 1);
});
test('concurrent renewal reservations cannot each reset the period or reserve two customer slots', async () => {
  const db = coachingMemoryDb(), access = testAccess(); await complete(db, NOW, 1, access);
  const next = testAccess({ id: 'next', startsAt: access.endsAt, endsAt: Date.parse('2026-12-25T00:00:00Z') });
  const results = await Promise.allSettled([reserve(db, next.startsAt, 2, next), reserve(db, next.startsAt, 3, next)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'REQUEST_IN_PROGRESS');
  const r = results.find(r => r.status === 'fulfilled').value;
  assert.equal(state(db, r).attempts, 1); assert.equal(state(db, r).held, 1); assert.equal(state(db, r).previous[0].used, 1);
});
test('history is bounded to three windows and evicted requests are too old to become fresh generations', async () => {
  const db = coachingMemoryDb(); let access = testAccess(); const originalId = id(NOW, 1);
  await complete(db, NOW, 1, access);
  for (let n = 2; n <= 4; n++) {
    const start = access.endsAt; access = { ...access, id: `period-${n}`, startsAt: start, endsAt: start + 30 * 86400000 };
    await complete(db, start, n, access);
  }
  const before = structuredClone([...db.data]);
  await assert.rejects(quota.reserveCoachingQuota(db, 'tester', originalId, 'same-evidence', limits(access), access.startsAt), code('INVALID_REQUEST_ID'));
  assert.deepEqual([...db.data], before);
});
test('two previous windows preserve late-month receipts across consecutive 28-day cycles', async () => {
  const db = coachingMemoryDb(), day = 86400000;
  let access = testAccess({ id: 'feb02-mar02', startsAt: Date.parse('2026-02-02T00:00:00Z'), endsAt: Date.parse('2026-03-02T00:00:00Z') });
  const late = Date.parse('2026-03-01T12:00:00Z'); await complete(db, late, 1, access);
  for (let n = 2; n <= 3; n++) {
    const start = access.endsAt; access = { ...access, id: `short-month-${n}`, startsAt: start, endsAt: start + 28 * day };
    await complete(db, start, n, access);
  }
  assert.equal(quota.periodAt(late), quota.periodAt(access.startsAt));
  const before = structuredClone([...db.data]);
  const result = await quota.reserveCoachingQuota(db, 'tester', id(late, 1), 'same-evidence', limits(access), access.startsAt);
  assert.equal(result.duplicate, true); assert.deepEqual([...db.data], before);
});
