import test from 'node:test';
import assert from 'node:assert/strict';
import storeModule from '../../cloud-functions/replay-coaching-tosspay-store.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import verifiers from '../../cloud-functions/replay-coaching-tosspay-verifiers.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const NOW = Date.parse('2026-10-26T00:00:00Z');
const product = { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'unit_test_only', expiresAt: null };
const paymentRef = 'tosspay:payment_tx';
async function setup(mode = 'LIVE') {
  const db = coachingMemoryDb();
  for (const uid of ['alice', 'bob']) db.data.set(`users/${uid}`, { uid });
  const manager = orders.createCreditOrderManager({ db, enabled: true, product, now: () => NOW,
    verifyPayment: async request => ({ ...request, status: 'settled', mode: 'LIVE' }),
    verifyRefund: async request => ({ ...request, status: 'settled', mode: 'LIVE' }) });
  const store = storeModule.createTossPayBindingStore({ db, mode, enabled: true, now: () => NOW });
  const order = (uid = 'alice', id = 'order_1') => structuredClone(db.data.get(credits.orderRef(db, uid, id).path));
  async function create(uid = 'alice', id = 'order_1', payToken = `token_${uid}_${id}`) {
    await manager.createOrder(uid, id); const saved = await store.saveOrder(uid, id, order(uid, id));
    await store.markPaymentDispatched(uid, id);
    const payment = { mode, orderNo: saved.orderNo, amountKRW: 3300, payToken, checkoutPage: `https://pay.toss.im/payfront/auth?payToken=${payToken}` };
    await store.attachPayment(uid, id, payment); return payment;
  }
  return { db, manager, store, order, create };
}
test('binding store requires explicit enable/mode; missing reads do not write, product source is checked against the LIVE order', async () => {
  const s = await setup();
  await assert.rejects(storeModule.createTossPayBindingStore({ db: s.db }).loadBinding('alice', 'order_1'), /DISABLED/);
  await assert.rejects(storeModule.createTossPayBindingStore({ db: s.db, enabled: true }).loadBinding('alice', 'order_1'), /INVALID/);
  const before = s.db.data.size; assert.equal(await s.store.loadBinding('alice', 'missing'), null); assert.equal(s.db.data.size, before);
  await s.manager.createOrder('alice', 'order_1');
  await assert.rejects(s.store.saveOrder('alice', 'order_1', { ...s.order(), amountKRW: 6600 }), /CONFLICT/);
  await assert.rejects(s.store.saveOrder('bob', 'order_1', s.order()), /STATE_INVALID/);
});
test('saved order snapshots and external IDs survive restarts, duplicate operations do not rewrite, and only one caller may dispatch', async () => {
  const s = await setup(); await s.manager.createOrder('alice', 'order_1');
  const [first, repeat] = await Promise.all([s.store.saveOrder('alice', 'order_1', s.order()), s.store.saveOrder('alice', 'order_1', s.order())]);
  assert.equal(first.orderNo, repeat.orderNo); assert.ok(first.orderNo.length <= 50);
  assert.equal([first, repeat].filter(r => !r.duplicate).length, 1);
  const restarted = storeModule.createTossPayBindingStore({ db: s.db, enabled: true, mode: 'LIVE', now: () => NOW });
  assert.equal((await restarted.saveOrder('alice', 'order_1', s.order())).orderNo, first.orderNo);
  const sends = await Promise.allSettled([s.store.markPaymentDispatched('alice', 'order_1'), restarted.markPaymentDispatched('alice', 'order_1')]);
  assert.equal(sends.filter(r => r.status === 'fulfilled').length, 1);
  await s.store.markPaymentUncertain('alice', 'order_1');
  await assert.rejects(restarted.markPaymentDispatched('alice', 'order_1'), /UNRESOLVED/);
  await assert.rejects(restarted.loadBinding('alice', 'order_1'), /UNRESOLVED/);
  const ref = storeModule.childRef(s.db, 'LIVE', 'alice', 'payments', 'order_1');
  assert.equal(s.db.data.get(ref.path).stage, 'uncertain');
});
test('payment token cannot bind another order or owner; mismatched mode/token/order/amount never replaces a ready binding', async () => {
  const s = await setup(); const p = await s.create();
  assert.deepEqual(await s.store.attachPayment('alice', 'order_1', p), { duplicate: true });
  assert.equal((await s.store.loadBinding('alice', 'order_1')).uid, 'alice');
  for (const change of [{ mode: 'TEST' }, { amountKRW: 3299 }, { orderNo: 'other' }, { payToken: 'other' }, { checkoutPage: 'https://evil.test/' }]) {
    await assert.rejects(s.store.attachPayment('alice', 'order_1', { ...p, ...change }), /CONFLICT|INVALID/);
  }
  await s.manager.createOrder('bob', 'order_1');
  const bob = await s.store.saveOrder('bob', 'order_1', s.order('bob')); await s.store.markPaymentDispatched('bob', 'order_1');
  await assert.rejects(s.store.attachPayment('bob', 'order_1', { ...p, orderNo: bob.orderNo }), /ALREADY_BOUND/);
  assert.equal(s.db.data.get(credits.walletRef(s.db, 'alice').path), undefined);
});
test('TEST and LIVE bindings use different paths and external IDs; TEST operations never write the operating ledger', async () => {
  const s = await setup(); await s.manager.createOrder('alice', 'order_1'); const order = s.order();
  const testDb = coachingMemoryDb(), testStore = storeModule.createTossPayBindingStore({ db: testDb, enabled: true, mode: 'TEST', now: () => NOW });
  const testOrder = await testStore.saveOrder('alice', 'order_1', order);
  const liveOrder = await s.store.saveOrder('alice', 'order_1', order); assert.notEqual(testOrder.orderNo, liveOrder.orderNo);
  await testStore.markPaymentDispatched('alice', 'order_1');
  await testStore.attachPayment('alice', 'order_1', { mode: 'TEST', orderNo: testOrder.orderNo, amountKRW: 3300, payToken: 'test_token', checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=test_token' });
  assert.ok([...testDb.data.keys()].every(path => path.startsWith('_replay_coaching_users/tosspay_test_')));
  const ports = verifiers.createTossPayCreditVerifiers({ enabled: true, loadBinding: testStore.loadBinding, inspectPayment: () => { throw Error('must reject before provider'); } });
  await assert.rejects(ports.verifyPayment({ uid: 'alice', orderId: 'order_1', currency: 'KRW', amountKRW: 3300, paymentReference: paymentRef }), /UNCONFIRMED/);
  assert.equal(await s.store.loadRefundBinding('alice', 'order_1', 'missing'), null);
});
test('LIVE refund binding requires an existing reserved unused-unit refund and the original paid payment hash', async () => {
  const s = await setup(); await s.create(); await s.manager.confirmPayment('alice', 'order_1', paymentRef);
  const reservation = { schemaVersion: 1, ownerHash: credits.owner('alice'), orderId: 'order_1', refundId: 'refund_1', status: 'reserved', quantity: 10, amountKRW: 660 };
  await assert.rejects(s.store.saveRefund('alice', 'order_1', 'refund_1', reservation, paymentRef), /NOT_RESERVED/);
  await s.manager.reserveRefund('alice', 'order_1', 'refund_1', 10);
  await assert.rejects(s.store.saveRefund('alice', 'order_1', 'refund_1', reservation, 'tosspay:other'), /NOT_RESERVED/);
  const first = await s.store.saveRefund('alice', 'order_1', 'refund_1', reservation, paymentRef);
  assert.ok(first.refundNo.length <= 36); assert.equal(first.amountKRW, 660);
  await assert.rejects(s.store.saveRefund('alice', 'order_1', 'refund_1', { ...reservation, amountKRW: 1320 }, paymentRef), /INVALID/);
});
test('reserved refund dispatch is single-winner; unknown results stay unresolved until exact transaction recovery; duplicate finalization survives settled ledger', async () => {
  const s = await setup(); await s.create(); await s.manager.confirmPayment('alice', 'order_1', paymentRef);
  await s.manager.reserveRefund('alice', 'order_1', 'refund_1', 10);
  const reservation = s.db.data.get(credits.refundRef(s.db, 'alice', 'refund_1').path);
  const draft = await s.store.saveRefund('alice', 'order_1', 'refund_1', reservation, paymentRef);
  const sends = await Promise.allSettled([s.store.markRefundDispatched('alice', 'order_1', 'refund_1'), s.store.markRefundDispatched('alice', 'order_1', 'refund_1')]);
  assert.equal(sends.filter(r => r.status === 'fulfilled').length, 1);
  await s.store.markRefundUncertain('alice', 'order_1', 'refund_1');
  await assert.rejects(s.store.markRefundDispatched('alice', 'order_1', 'refund_1'), /UNRESOLVED/);
  await assert.rejects(s.store.loadRefundBinding('alice', 'order_1', 'refund_1'), /UNRESOLVED/);
  const result = { mode: 'LIVE', refundNo: draft.refundNo, amountKRW: 660, reference: 'refund_tx_1' };
  const attached = await Promise.all([s.store.attachRefund('alice', 'order_1', 'refund_1', result), s.store.attachRefund('alice', 'order_1', 'refund_1', result)]);
  assert.equal(attached.filter(r => !r.duplicate).length, 1);
  assert.equal((await s.store.loadRefundBinding('alice', 'order_1', 'refund_1')).transactionReference, 'refund_tx_1');
  await s.manager.confirmRefund('alice', 'order_1', 'refund_1', 'tosspay:refund_tx_1');
  const settled = s.db.data.get(credits.refundRef(s.db, 'alice', 'refund_1').path);
  assert.equal((await s.store.saveRefund('alice', 'order_1', 'refund_1', settled, paymentRef)).duplicate, true);
  assert.equal((await s.store.attachRefund('alice', 'order_1', 'refund_1', result)).duplicate, true);
  assert.equal(s.db.data.get(credits.walletRef(s.db, 'alice').path).refunded, 10);
});
test('refund transaction cannot be reused for another refund even when amount matches', async () => {
  const s = await setup(); await s.create(); await s.manager.confirmPayment('alice', 'order_1', paymentRef);
  for (const refundId of ['first', 'second']) {
    await s.manager.reserveRefund('alice', 'order_1', refundId, 1);
    const r = s.db.data.get(credits.refundRef(s.db, 'alice', refundId).path);
    const draft = await s.store.saveRefund('alice', 'order_1', refundId, r, paymentRef);
    await s.store.markRefundDispatched('alice', 'order_1', refundId);
    const call = s.store.attachRefund('alice', 'order_1', refundId, { mode: 'LIVE', refundNo: draft.refundNo, amountKRW: 66, reference: 'same_tx' });
    if (refundId === 'first') await call; else await assert.rejects(call, /ALREADY_BOUND/);
  }
});

test('stored bindings feed the real payment/refund verifiers and ledger without trusting the callback body', async () => {
  const s = await setup(); const p = await s.create();
  const status = { mode: 'LIVE', orderNo: p.orderNo, payToken: p.payToken, amountKRW: 3300,
    payStatus: 'PAY_COMPLETE', refundableAmount: 3300, transactions: [{ kind: 'PAY', reference: 'payment_tx', amountKRW: 3300 }] };
  const ports = verifiers.createTossPayCreditVerifiers({ enabled: true, loadBinding: s.store.loadBinding,
    loadRefundBinding: s.store.loadRefundBinding, inspectPayment: async expected => {
      assert.deepEqual(expected, { orderNo: p.orderNo, payToken: p.payToken, amountKRW: 3300 }); return structuredClone(status);
    } });
  const manager = orders.createCreditOrderManager({ db: s.db, enabled: true, product, now: () => NOW, ...ports });
  await manager.confirmPayment('alice', 'order_1', paymentRef); await manager.reserveRefund('alice', 'order_1', 'refund', 10);
  const reservation = s.db.data.get(credits.refundRef(s.db, 'alice', 'refund').path);
  const refund = await s.store.saveRefund('alice', 'order_1', 'refund', reservation, paymentRef);
  await s.store.markRefundDispatched('alice', 'order_1', 'refund');
  await s.store.attachRefund('alice', 'order_1', 'refund', { mode: 'LIVE', refundNo: refund.refundNo, amountKRW: 660, reference: 'refund_tx' });
  status.payStatus = 'REFUND_SUCCESS'; status.refundableAmount = 2640;
  status.transactions.push({ kind: 'REFUND', reference: 'refund_tx', amountKRW: -660 });
  await manager.confirmRefund('alice', 'order_1', 'refund', 'tosspay:refund_tx');
  const wallet = s.db.data.get(credits.walletRef(s.db, 'alice').path);
  assert.equal(wallet.purchased, 50); assert.equal(wallet.available, 40); assert.equal(wallet.refunded, 10); assert.equal(wallet.refundHeld, 0);
  credits.validateWallet(wallet, 'alice');
});
