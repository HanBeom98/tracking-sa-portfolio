import test from 'node:test';
import assert from 'node:assert/strict';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import runner from '../../cloud-functions/replay-coaching-credit-runner.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import offer from '../../cloud-functions/replay-coaching-merchant-product.cjs';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { creditRuntime } from '../helpers/coaching-credit-fixture.js';
const NOW = Date.parse('2026-10-26T00:00:00Z');
test('20-use offer funds only 20 credits and refunds unused units at 165KRW while legacy orders retain 66KRW', async () => {
  const s = setup({ product: offer, verifyPayment: async r => ({ ...r, mode: 'LIVE', status: 'settled', paidAt: NOW }) });
  await s.buy('new_pack'); await s.run();
  assert.equal(s.wallet().purchased, 20); assert.equal(s.wallet().available, 19);
  const refund = await s.manager.reserveRefund('alice', 'new_pack', 'unused', 19);
  assert.equal(refund.amountKRW, 3135);
  await s.manager.confirmRefund('alice', 'new_pack', 'unused', 'refund_new');
  await s.manager.confirmRefund('alice', 'new_pack', 'unused', 'refund_new');
  assert.equal(s.wallet().refunded, 19); assert.equal(s.wallet().used, 1);

  const legacy = setup(); await legacy.buy('old_pack');
  const newer = orders.createCreditOrderManager({ ...legacy.options, product: offer });
  assert.equal((await newer.reserveRefund('alice', 'old_pack', 'old_unused', 1)).amountKRW, 66);
  assert.equal(legacy.db.data.get(credits.orderRef(legacy.db, 'alice', 'old_pack').path).quantity, 50);
});
function setup(extra = {}) {
  const db = coachingMemoryDb(), runtime = creditRuntime(), clock = { value: NOW };
  for (const uid of ['alice', 'bob']) db.data.set(`users/${uid}`, { uid, subscription: { status: 'free' } });
  db.data.set(cost.controlRef(db).path, { schemaVersion: 1, enabled: true, period: '202610', allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  const options = { db, enabled: true, product: { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'test_terms_only', expiresAt: null },
    now: () => clock.value, verifyPayment: async request => ({ ...request, status: 'settled' }), verifyRefund: async request => ({ ...request, status: 'settled' }), ...extra };
  const manager = orders.createCreditOrderManager(options);
  const buy = async (id = 'buy_order', uid = 'alice', payment = `bank_${uid}_${id}`) => { await manager.createOrder(uid, id); return manager.confirmPayment(uid, id, payment); };
  const wallet = (uid = 'alice') => db.data.get(credits.walletRef(db, uid).path);
  const run = (id = '202610-order_test_request01', overrides = {}) => runner.runCreditCoaching({ ...runtime.options, db, now: () => clock.value, uid: 'alice', requestId: id, evidence: runtime.evidence, ...overrides });
  return { db, options, manager, buy, wallet, run, clock };
}

test('purchase manager is disabled by default and requires explicit product/expiry policy and external proof', async () => {
  const s = setup(), off = orders.createCreditOrderManager({ db: s.db });
  await assert.rejects(off.createOrder('alice', 'order'), /DISABLED/); assert.equal(s.db.transactions, 0);
  const { expiresAt, ...missing } = s.options.product;
  await assert.rejects(orders.createCreditOrderManager({ ...s.options, product: missing }).createOrder('alice', 'order'), /NOT_CONFIGURED/);
  await s.manager.createOrder('alice', 'order'); assert.equal(s.wallet(), undefined);
  await assert.rejects(orders.createCreditOrderManager({ ...s.options, verifyPayment: undefined }).confirmPayment('alice', 'order', 'bank_1'), /VERIFICATION_REQUIRED/);
  await assert.rejects(s.manager.createOrder('missing', 'order'), /ACCOUNT_UNAVAILABLE/);
});

test('concurrent repeated order/payment confirmation funds exactly once; the same bank transaction cannot fund another user', async () => {
  const s = setup(); await Promise.all([s.manager.createOrder('alice', 'order'), s.manager.createOrder('alice', 'order')]);
  const results = await Promise.all([s.manager.confirmPayment('alice', 'order', 'bank_one'), s.manager.confirmPayment('alice', 'order', 'bank_one')]);
  assert.equal(results.filter(r => !r.duplicate).length, 1); assert.equal(s.wallet().available, 50); assert.equal(s.wallet().purchased, 50);
  assert.deepEqual(s.db.data.get('users/alice').subscription, { status: 'free' });
  await s.manager.createOrder('bob', 'other_order'); await assert.rejects(s.manager.confirmPayment('bob', 'other_order', 'bank_one'), /ALREADY_APPLIED/);
  assert.equal(s.wallet('bob'), undefined);
  await assert.rejects(s.manager.confirmPayment('alice', 'order', 'bank_other'), /ALREADY_APPLIED/); assert.equal(s.wallet().available, 50);
});

test('payment proof must match account, order, currency, exact amount and transaction, with no funding on uncertainty', async () => {
  for (const mutate of [v => { v.status = 'pending'; }, v => { v.amountKRW = 3299; }, v => { v.currency = 'USD'; },
    v => { v.uid = 'bob'; }, v => { v.orderId = 'other'; }, v => { v.paymentReference = 'other'; }]) {
    const s = setup({ verifyPayment: async request => { const result = { ...request, status: 'settled' }; mutate(result); return result; } });
    await s.manager.createOrder('alice', 'order'); await assert.rejects(s.manager.confirmPayment('alice', 'order', 'bank_one'), /UNCONFIRMED/);
    assert.equal(s.wallet(), undefined); assert.equal(s.db.data.get(credits.orderRef(s.db, 'alice', 'order').path).status, 'pending');
  }
});

test('explicit TEST or unknown provider modes can never fund or refund the operational credit ledger', async () => {
  for (const mode of ['TEST', 'UNKNOWN', null]) {
    const s = setup({ verifyPayment: async request => ({ ...request, mode, status: 'settled' }) });
    await s.manager.createOrder('alice', 'order');
    await assert.rejects(s.manager.confirmPayment('alice', 'order', 'test_pay'), /UNCONFIRMED/); assert.equal(s.wallet(), undefined);
    const t = setup({ verifyRefund: async request => ({ ...request, mode, status: 'settled' }) });
    await t.buy('order'); await t.manager.reserveRefund('alice', 'order', 'refund', 1);
    await assert.rejects(t.manager.confirmRefund('alice', 'order', 'refund', 'test_refund'), /UNCONFIRMED/);
    assert.equal(t.wallet().refundHeld, 1); assert.equal(t.wallet().refunded, 0);
  }
});

test('additional purchases add remaining units without resetting consumed units or monthly budgets', async () => {
  const s = setup(); await s.buy('order_a'); await s.run(); const before = structuredClone(s.wallet());
  await s.buy('order_b'); assert.equal(s.wallet().purchased, 100); assert.equal(s.wallet().available, 99); assert.equal(s.wallet().used, 1);
  assert.equal(before.used, s.wallet().used); assert.equal(s.db.data.get('_replay_coaching_months/usd_micro_v1_202610').spentUnits, 200);
  await s.manager.confirmPayment('alice', 'order_b', 'bank_alice_order_b'); assert.equal(s.wallet().available, 99);
});

test('unused refund units are locked before money moves, mismatches leave locks, confirmed duplicate refunds never remove twice', async () => {
  const s = setup(); await s.buy('order'); await s.run();
  const r = await s.manager.reserveRefund('alice', 'order', 'refund_a', 20); assert.equal(r.amountKRW, 1320);
  assert.equal(s.wallet().available, 29); assert.equal(s.wallet().refundHeld, 20);
  await s.manager.reserveRefund('alice', 'order', 'refund_a', 20); assert.equal(s.wallet().refundHeld, 20);
  await assert.rejects(s.manager.reserveRefund('alice', 'order', 'refund_a', 19), /CONFLICT/);
  const uncertain = orders.createCreditOrderManager({ ...s.options, verifyRefund: async () => ({ status: 'pending' }) });
  await assert.rejects(uncertain.confirmRefund('alice', 'order', 'refund_a', 'refund_bank_a'), /UNCONFIRMED/); assert.equal(s.wallet().refundHeld, 20);
  await Promise.all([s.manager.confirmRefund('alice', 'order', 'refund_a', 'refund_bank_a'), s.manager.confirmRefund('alice', 'order', 'refund_a', 'refund_bank_a')]);
  assert.equal(s.wallet().refundHeld, 0); assert.equal(s.wallet().refunded, 20); assert.equal(s.wallet().available, 29); assert.equal(s.wallet().used, 1);
  await assert.rejects(s.manager.reserveRefund('alice', 'order', 'refund_b', 30), /EXCEEDS_UNUSED/);
});

test('full refund cannot reactivate a paid order, and one bank refund cannot settle two refund requests', async () => {
  const s = setup(); await s.buy('order'); await s.manager.reserveRefund('alice', 'order', 'a', 50);
  await s.manager.confirmRefund('alice', 'order', 'a', 'bank_refund'); assert.equal(s.wallet().available, 0); assert.equal(s.wallet().refunded, 50); assert.equal(s.wallet().lots.length, 0);
  await s.manager.confirmPayment('alice', 'order', 'bank_alice_order'); assert.equal(s.wallet().available, 0);
  const t = setup(); await t.buy('order'); await t.manager.reserveRefund('alice', 'order', 'a', 1); await t.manager.reserveRefund('alice', 'order', 'b', 1);
  await t.manager.confirmRefund('alice', 'order', 'a', 'same_refund'); await assert.rejects(t.manager.confirmRefund('alice', 'order', 'b', 'same_refund'), /ALREADY_APPLIED/);
  assert.equal(t.wallet().refunded, 1); assert.equal(t.wallet().refundHeld, 1);
});

test('generation and refund cannot spend the same purchased units, and in-flight order refunds are rejected', async () => {
  const s = setup(); await s.buy('order');
  const outcomes = await Promise.allSettled([s.run(), s.manager.reserveRefund('alice', 'order', 'all', 50)]);
  const w = s.wallet(); credits.validateWallet(w, 'alice');
  assert.equal(w.purchased, w.available + w.used + w.held + w.refundHeld + w.refunded);
  assert.ok(outcomes.some(o => o.status === 'rejected')); assert.ok(!(w.used && w.refundHeld === 50));
  const t = setup(); await t.buy('order'); let release;
  const wait = new Promise(resolve => { release = resolve; }), generate = creditRuntime().options.generate;
  const pending = t.run('202610-order_held_request01', { generate: async (...args) => { await wait; return generate(...args); } });
  while (!t.wallet().held) await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(t.manager.reserveRefund('alice', 'order', 'held_refund', 1), /REQUEST_IN_PROGRESS/); release(); await pending;
  assert.equal(t.wallet().used, 1);
});

test('expiry does not erase/refund purchased units automatically and pending refunds cannot be spent', async () => {
  const s = setup({ product: { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'test_terms_only', expiresAt: NOW + 86400000 } });
  await s.buy('order'); s.clock.value += 86400000;
  assert.deepEqual(credits.creditView(s.wallet(), s.clock.value), { remaining: 0, held: 0 }); assert.equal(s.wallet().available, 50);
  await s.manager.reserveRefund('alice', 'order', 'expired_refund', 50); await s.manager.confirmRefund('alice', 'order', 'expired_refund', 'expired_bank');
  assert.equal(s.wallet().refunded, 50); assert.equal(s.wallet().available, 0);
});

test('order policy conflicts and excessive active lots fail closed without deleting paid history', async () => {
  const s = setup(); await s.manager.createOrder('alice', 'order');
  await assert.rejects(orders.createCreditOrderManager({ ...s.options, product: { ...s.options.product, quantity: 25 } }).createOrder('alice', 'order'), /CONFLICT/);
  for (let i = 0; i < 50; i++) await s.buy(`lot_${i}`);
  await assert.rejects(s.buy('lot_51'), /CAPACITY/); assert.equal(s.wallet().lots.length, 50); assert.equal(s.wallet().purchased, 2500);
});
