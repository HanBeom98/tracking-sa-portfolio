import test from 'node:test';
import assert from 'node:assert/strict';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import runner from '../../cloud-functions/replay-coaching-credit-runner.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import provider from '../../cloud-functions/replay-coaching-openai.js';
import { creditRuntime, creditFixtureEntries } from '../helpers/coaching-credit-fixture.js';
const id = n => `202610-credit_unit_request_${String(n).padStart(4, '0')}`;
const run = (s, n = 1) => runner.runCreditCoaching({ ...s.options, uid: 'alice', requestId: id(n), evidence: s.evidence });
const request = (s, n = 1) => s.db.data.get(credits.refsFor(s.db, 'alice', id(n), '202610').requestRef.path);
async function reserved(s) {
  const { evidence, request: input } = preflight.buildCoachingRequest(s.evidence), quote = cost.makeCostQuote(1000, input, s.clock.value);
  const reservation = await credits.reserveCredit(s.db, 'alice', id(1), credits.hash(JSON.stringify(evidence)), quote, s.options.config, s.clock.value);
  return { input, quote, reservation };
}

test('purchased balance persists across cost-month changes, and old receipts do not get re-created or charged again', async () => {
  const s = creditRuntime({ quantity: 50 }); await run(s); s.clock.value = Date.parse('2026-12-01T00:00:00Z');
  s.db.data.set(cost.controlRef(s.db).path, { schemaVersion: 1, enabled: true, period: '202612', allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  const before = structuredClone([...s.db.data]); const duplicate = await run(s); assert.equal(duplicate.outcome, 'already_completed');
  assert.deepEqual([...s.db.data], before); assert.equal(s.calls.generate, 1);
  await runner.runCreditCoaching({ ...s.options, uid: 'alice', requestId: '202612-new_month_request01', evidence: s.evidence });
  assert.equal(s.wallet().available, 48); assert.equal(s.wallet().used, 2); assert.equal(s.wallet().purchased, 50);
});

test('additional packs can exceed fifty successful uses in one month without a subscription reset', async () => {
  const s = creditRuntime({ quantity: 50 }), start = Date.parse('2026-10-01T00:00:00Z'); s.clock.value = start;
  const firstOrder = s.db.data.get(credits.orderRef(s.db, 'alice', 'fixture_order').path);
  firstOrder.createdAt = start - 1000; firstOrder.paidAt = start - 500;
  const [, , second] = creditFixtureEntries('alice', { quantity: 50, now: start, orderId: 'second_pack' });
  s.db.data.set(...second); const wallet = s.wallet(); wallet.purchased += 50; wallet.available += 50;
  wallet.lots.push({ orderId: 'second_pack', remaining: 50, held: 0, refundHeld: 0, expiresAt: null });
  for (let n = 1; n <= 51; n++) { s.clock.value = start + Math.floor((n - 1) / 5) * 86400000; await run(s, n); }
  assert.equal(s.wallet().used, 51); assert.equal(s.wallet().available, 49); assert.equal(s.wallet().purchased, 100);
});

test('earliest-expiring purchased lot is used first; expired lots stay refundable and are never silently cleared', async () => {
  const s = creditRuntime({ quantity: 2 }); const wallet = s.wallet(), orderId = 'expires_first';
  const seed = creditRuntime({ quantity: 1, expiresAt: s.clock.value + 1000 });
  const o = structuredClone(seed.db.data.get(credits.orderRef(seed.db, 'alice', 'fixture_order').path)); o.orderId = orderId;
  s.db.data.set(credits.orderRef(s.db, 'alice', orderId).path, o);
  wallet.lots.push({ orderId, remaining: 1, held: 0, refundHeld: 0, expiresAt: o.expiresAt }); wallet.available++; wallet.purchased++;
  await run(s); assert.equal(request(s).reservation.orderId, orderId); assert.equal(s.wallet().available, 2); assert.equal(s.wallet().lots.length, 1);
});

test('expiry/global month change after reservation cancels before dispatch without consuming credits or provider budget', async () => {
  for (const mode of ['expiry', 'month']) {
    const s = creditRuntime({ expiresAt: Date.parse('2026-10-26T00:00:01Z') }); const { reservation } = await reserved(s);
    s.clock.value = mode === 'expiry' ? s.clock.value + 1000 : Date.parse('2026-11-01T00:00:00Z');
    assert.equal(await credits.markCreditDispatched(s.db, reservation, s.clock.value), false);
    assert.equal(s.wallet().available, 2); assert.equal(s.wallet().held, 0); assert.equal(s.global().spentUnits, 0); assert.equal(s.global().heldUnits, 0);
    assert.equal(request(s).status, 'cancelled');
  }
});

test('settlement acknowledgement retries are idempotent and altered settlement/lease cannot consume again', async () => {
  const s = creditRuntime(), { reservation, quote, input } = await reserved(s);
  await credits.markCreditDispatched(s.db, reservation, s.clock.value);
  const decoded = await provider.decodeOpenAIResponse(await s.options.generate(input, quote), quote, s.evidence);
  const outcome = { customerSuccess: true, chargedUnits: decoded.chargedUnits, measured: decoded.measured, result: decoded.result };
  await credits.finishCredit(s.db, reservation, outcome, s.clock.value); const before = structuredClone([...s.db.data]);
  const again = await credits.finishCredit(s.db, reservation, outcome, s.clock.value); assert.equal(again.duplicate, true); assert.deepEqual([...s.db.data], before);
  await assert.rejects(credits.finishCredit(s.db, { ...reservation, active: { ...reservation.active, lease: 'other' } }, outcome, s.clock.value), /INVALID/);
  assert.equal(s.wallet().used, 1);
});

test('explicit unknown-cost recovery restores customer unit, preserves worst-case provider expense, and late success is fenced out', async () => {
  const s = creditRuntime(), { reservation, quote, input } = await reserved(s); await credits.markCreditDispatched(s.db, reservation, s.clock.value);
  await assert.rejects(credits.recoverCredit(s.db, 'alice', id(1), reservation.active.lease, 'close_max_cost', s.clock.value), /IN_PROGRESS/);
  s.clock.value += 60000;
  await assert.rejects(credits.recoverCredit(s.db, 'alice', id(1), reservation.active.lease, 'cancel_before_dispatch', s.clock.value), /CONFLICT/);
  await credits.recoverCredit(s.db, 'alice', id(1), reservation.active.lease, 'close_max_cost', s.clock.value);
  assert.equal(s.wallet().available, 2); assert.equal(s.wallet().used, 0); assert.equal(s.global().spentUnits, quote.maxCostMicros); assert.equal(request(s).status, 'closed_unknown');
  const before = structuredClone([...s.db.data]); await credits.recoverCredit(s.db, 'alice', id(1), reservation.active.lease, 'close_max_cost', s.clock.value); assert.deepEqual([...s.db.data], before);
  const decoded = await provider.decodeOpenAIResponse(await s.options.generate(input, quote), quote, s.evidence);
  await assert.rejects(credits.finishCredit(s.db, reservation, { customerSuccess: true, chargedUnits: decoded.chargedUnits, measured: decoded.measured, result: decoded.result }, s.clock.value), /INVALID_SETTLEMENT/);
});

test('concurrent different requests cannot overspend the last unit; daily attempt limits survive failed output', async () => {
  const s = creditRuntime({ quantity: 1 }); const outcomes = await Promise.allSettled([run(s), run(s, 2)]);
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1); assert.equal(s.calls.generate, 1); assert.equal(s.wallet().used, 1); assert.equal(s.wallet().available, 0);
  const t = creditRuntime(), generate = t.options.generate; t.options.generate = async (...args) => { const raw = await generate(...args); raw.status = 'incomplete'; return raw; };
  for (let n = 1; n <= 10; n++) await assert.rejects(run(t, n), /OUTPUT_UNUSABLE/);
  await assert.rejects(run(t, 11), /DAILY_ATTEMPT_LIMIT/); assert.equal(t.wallet().available, 2); assert.equal(t.calls.generate, 10);
});

test('malformed balance/order state fails closed and no monthly ledger is migrated or reset into paid credits', async () => {
  for (const mutate of [w => { w.available++; }, w => { w.purchased++; }, w => { w.lots[0].remaining++; }, w => { w.held = 1; }, w => { w.ownerHash = credits.owner('bob'); }]) {
    const s = creditRuntime(); mutate(s.wallet()); await assert.rejects(run(s), /CREDIT_STATE_INVALID/); assert.equal(s.calls.generate, 0);
  }
  const s = creditRuntime(); s.db.data.get(credits.orderRef(s.db, 'alice', 'fixture_order').path).remaining = 1;
  await assert.rejects(run(s), /CREDIT_STATE_INVALID/); assert.equal(s.wallet().held, 0);
  const t = creditRuntime(); t.db.data.delete(credits.walletRef(t.db, 'alice').path); t.db.data.set(`_replay_coaching_users/${cost.ACCOUNTING}_${credits.hash('alice')}`, { used: 0, access: { successLimit: 50 } });
  await assert.rejects(run(t), /AI_CREDITS_REQUIRED/); assert.equal(t.calls.tokens, 0);
});
