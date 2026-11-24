import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../cloud-functions/replay-coaching-credits.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import bindings from '../../cloud-functions/replay-coaching-tosspay-store.js';
import flow from '../../cloud-functions/replay-coaching-checkout.js';
import validity from '../../cloud-functions/replay-coaching-validity.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const NOW = Date.parse('2026-10-27T00:00:00Z'), DAY = validity.DAY_MS, ORDER = 'relative_order_000001';
const product = { id: core.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'local_duration_v1', validDays: 365 };
async function setup() {
  const db = coachingMemoryDb(), clock = { value: NOW }, payment = {}, calls = { create: 0, approve: 0 };
  db.data.set('users/alice', { uid: 'alice' });
  const provider = { mode: 'LIVE',
    async createPayment(expected) {
      calls.create++; Object.assign(payment, expected, { mode: 'LIVE', payToken: 'local_duration_token', payStatus: 'PAY_STANDBY',
        refundableAmount: expected.amountKRW, transactions: [] });
      return { ...payment, checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=local_duration_token' };
    },
    async inspectPayment() { return structuredClone(payment); },
    async approvePayment() { calls.approve++; settle(clock.value); },
  };
  function settle(paidAt) {
    Object.assign(payment, { payStatus: 'PAY_COMPLETE', paidAt,
      transactions: [{ kind: 'PAY', reference: 'local_duration_tx', amountKRW: payment.amountKRW }] });
  }
  const options = { db, enabled: true, product, reserveCapacity: true, provider, productDesc: 'Local duration test', now: () => clock.value };
  const manager = orders.createCreditOrderManager(options), coordinator = flow.createReplayCheckout(options);
  const store = bindings.createTossPayBindingStore({ ...options, mode: 'LIVE' });
  await manager.createOrder('alice', ORDER);
  return { db, clock, payment, provider, manager, coordinator, store, settle, calls, options,
    order: () => db.data.get(core.orderRef(db, 'alice', ORDER).path),
    wallet: () => db.data.get(core.walletRef(db, 'alice').path),
    start: () => coordinator.start('alice', ORDER), complete: () => coordinator.complete('alice', ORDER) };
}

test('relative product requires explicit bounded days and rejects ambiguous absolute expiry', async () => {
  const s = await setup();
  assert.deepEqual(s.manager.readProduct(), { ...product, currency: 'KRW', expiresAt: null });
  assert.equal(s.order().expiresAt, null); assert.equal(s.order().validDays, 365); assert.equal(s.wallet(), undefined);
  for (const change of [{ validDays: 0 }, { validDays: 366 }, { validDays: 1.5 }, { validDays: null },
    { expiresAt: NOW + DAY }, { validDays: undefined }]) {
    assert.throws(() => orders.createCreditOrderManager({ ...s.options, product: { ...product, ...change } }).readProduct(), /NOT_CONFIGURED/);
  }
});

test('delayed payment/fulfillment starts 365 days at trusted completion, and repeated confirmations never extend it', async () => {
  const s = await setup(); await s.start();
  s.settle(NOW + 2 * DAY); s.clock.value = NOW + 5 * DAY;
  assert.deepEqual(await s.complete(), { outcome: 'funded' });
  const saved = structuredClone(s.order()), expiry = NOW + 367 * DAY;
  assert.equal(saved.paidAt, NOW + 2 * DAY); assert.equal(saved.expiresAt, expiry);
  assert.equal(saved.checkout.updatedAt, NOW + 5 * DAY); assert.equal(s.wallet().lots[0].expiresAt, expiry);
  s.clock.value += DAY; assert.deepEqual(await s.complete(), { outcome: 'already_funded' });
  assert.deepEqual(s.order(), saved); assert.equal(s.wallet().purchased, 50); assert.equal(s.calls.approve, 0);
  assert.equal(core.creditView(s.wallet(), expiry - 1).remaining, 50);
  assert.equal(core.creditView(s.wallet(), expiry).remaining, 0);
  assert.equal(core.creditView(s.wallet(), expiry + 1).remaining, 0);
  const before = structuredClone(s.wallet());
  await assert.rejects(core.inspectCreditRequest(s.db, 'alice', '202710-expired_validity_request01', core.hash('expired'), expiry,
    { userMicros: 1, globalMonthly: 1 }), /CREDITS_EXHAUSTED/);
  assert.deepEqual(s.wallet(), before); // No consumption or automatic refund/deletion on expiry.
  assert.equal((await s.store.saveOrder('alice', ORDER, s.order())).duplicate, true);
});

test('a lost approval response preserves the original payment date when recovered days later', async () => {
  const s = await setup(); await s.start(); s.payment.payStatus = 'PAY_APPROVED'; s.clock.value = NOW + DAY;
  const approve = s.provider.approvePayment;
  s.provider.approvePayment = async () => { await approve(); throw Error('lost acknowledgement'); };
  await assert.rejects(s.complete(), /CHECKOUT_UNRESOLVED/); assert.equal(s.wallet(), undefined);
  s.clock.value += 4 * DAY;
  assert.deepEqual(await s.complete(), { outcome: 'funded' });
  assert.equal(s.calls.approve, 1); assert.equal(s.order().paidAt, NOW + DAY);
  assert.equal(s.order().expiresAt, NOW + 366 * DAY);
});

test('missing, malformed, future or pre-order provider payment time never funds relative credits', async () => {
  for (const paidAt of [undefined, null, '2026-10-27T00:00:00Z', NOW - 1, NOW + 1, Number.MAX_SAFE_INTEGER]) {
    const s = await setup(); await s.start(); s.settle(paidAt);
    await assert.rejects(s.complete(), /FULFILLMENT_UNRESOLVED/);
    assert.equal(s.order().status, 'pending'); assert.equal(s.order().expiresAt, null); assert.equal(s.wallet(), undefined);
    assert.equal(s.calls.approve, 0);
  }
});

test('relative orders require LIVE proof and valid calendar arithmetic, including concurrent confirmations', async () => {
  const s = await setup(); await s.start();
  const proof = request => ({ ...request, mode: 'LIVE', status: 'settled', paidAt: NOW });
  for (const mode of [undefined, 'TEST']) {
    const manager = orders.createCreditOrderManager({ ...s.options, verifyPayment: async r => ({ ...proof(r), mode }) });
    await assert.rejects(manager.confirmPayment('alice', ORDER, 'proof_tx'), /UNCONFIRMED/);
  }
  const manager = orders.createCreditOrderManager({ ...s.options, verifyPayment: async r => proof(r) });
  const results = await Promise.all([manager.confirmPayment('alice', ORDER, 'proof_tx'), manager.confirmPayment('alice', ORDER, 'proof_tx')]);
  assert.equal(results.filter(v => !v.duplicate).length, 1); assert.equal(s.wallet().purchased, 50);
  const expiry = s.order().expiresAt; s.clock.value += DAY;
  await manager.confirmPayment('alice', ORDER, 'proof_tx'); assert.equal(s.order().expiresAt, expiry);
  const changed = orders.createCreditOrderManager({ ...s.options, verifyPayment: async r => ({ ...proof(r), paidAt: NOW + 1 }) });
  await assert.rejects(changed.confirmPayment('alice', ORDER, 'proof_tx'), /UNCONFIRMED/);
  assert.equal(validity.expiryFromPayment(8640000000000000 - DAY, 365), null);
});

test('later price, quantity and validity changes affect new orders while old settlement/refunds use purchased terms', async () => {
  const s = await setup(); await s.start();
  const later = orders.createCreditOrderManager({ ...s.options, product: { ...product, quantity: 30, amountKRW: 3900,
    termsVersion: 'local_duration_v2', validDays: 180 } });
  await later.createOrder('alice', 'new_relative_order');
  await assert.rejects(later.createOrder('alice', ORDER), /ORDER_CONFLICT/);
  const recent = await later.readOrder('alice', 'new_relative_order');
  assert.equal(recent.quantity, 30); assert.equal(recent.amountKRW, 3900); assert.equal(recent.validDays, 180);
  s.settle(NOW); await s.complete();
  assert.equal(s.order().quantity, 50); assert.equal(s.order().amountKRW, 3300); assert.equal(s.order().expiresAt, NOW + 365 * DAY);
  const refund = await later.reserveRefund('alice', ORDER, 'unused_49', 49);
  assert.equal(refund.amountKRW, 3234); assert.equal(s.wallet().refundHeld, 49);
  const savedRefund = s.db.data.get(core.refundRef(s.db, 'alice', 'unused_49').path);
  const bound = await s.store.saveRefund('alice', ORDER, 'unused_49', savedRefund, 'tosspay:local_duration_tx');
  assert.equal(bound.amountKRW, 3234);
  assert.equal((await s.complete()).outcome, 'already_funded'); assert.equal(s.wallet().available, 1);
});

test('corrupted duration, derived expiry and private binding terms fail closed', async () => {
  const s = await setup(); await s.start(); s.settle(NOW); await s.complete();
  for (const change of [{ validDays: 180 }, { expiresAt: NOW + DAY }, { paidAt: NOW - 1 },
    { checkout: { ...s.order().checkout, updatedAt: NOW - 1 } }]) {
    assert.throws(() => core.validateOrder({ ...s.order(), ...change }, 'alice', ORDER), /CREDIT_STATE_INVALID/);
  }
  const corrupt = { ...s.order(), validDays: 180, expiresAt: NOW + 180 * DAY };
  s.db.data.set(core.orderRef(s.db, 'alice', ORDER).path, corrupt);
  await assert.rejects(s.store.saveOrder('alice', ORDER, corrupt), /ORDER_CONFLICT/);
  assert.equal(s.wallet().lots[0].expiresAt, NOW + 365 * DAY);
});
