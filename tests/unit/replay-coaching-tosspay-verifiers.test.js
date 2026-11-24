import test from 'node:test';
import assert from 'node:assert/strict';
import verifier from '../../cloud-functions/replay-coaching-tosspay-verifiers.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const request = { uid: 'alice', orderId: 'order_1', amountKRW: 3300, currency: 'KRW', paymentReference: 'tosspay:pay_1' };
const binding = { provider: 'tosspay', mode: 'LIVE', uid: 'alice', orderId: 'order_1', amountKRW: 3300, orderNo: 'private_order_1', payToken: 'private_token_1' };
const payment = () => ({ mode: 'LIVE', orderNo: binding.orderNo, payToken: binding.payToken, amountKRW: 3300,
  refundableAmount: 3300, payStatus: 'PAY_COMPLETE', transactions: [{ kind: 'PAY', reference: 'pay_1', amountKRW: 3300 }] });
function setup(extra = {}) {
  const state = { binding: structuredClone(binding), payment: payment(), refund: null }, calls = [];
  const ports = verifier.createTossPayCreditVerifiers({ enabled: true, loadBinding: async (uid, orderId) => {
    calls.push({ uid, orderId }); return structuredClone(state.binding);
  }, loadRefundBinding: async () => structuredClone(state.refund), inspectPayment: async expected => {
    assert.deepEqual(expected, { orderNo: binding.orderNo, payToken: binding.payToken, amountKRW: 3300 });
    return structuredClone(state.payment);
  }, ...extra });
  return { ports, state, calls };
}
const refundRequest = { uid: 'alice', orderId: 'order_1', refundId: 'refund_1', amountKRW: 660, currency: 'KRW',
  paymentHash: credits.hash('tosspay:pay_1'), refundReference: 'tosspay:tx_refund_1' };
function setRefund(state) {
  state.refund = { uid: 'alice', orderId: 'order_1', refundId: 'refund_1', refundNo: 'stable_refund_1',
    mode: 'LIVE', paymentReference: 'tosspay:pay_1', amountKRW: 660, transactionReference: 'tx_refund_1' };
  state.payment.payStatus = 'REFUND_SUCCESS'; state.payment.refundableAmount = 2640;
  state.payment.transactions.push({ kind: 'REFUND', refundNo: 'stable_refund_1', reference: 'tx_refund_1', amountKRW: -660 });
}
test('credit verification ports are disabled by default and reject TEST evidence, wrong owner, amount, token, status or transaction', async () => {
  await assert.rejects(verifier.createTossPayCreditVerifiers().verifyPayment(request), /DISABLED/);
  for (const mutate of [s => { s.binding.mode = 'TEST'; }, s => { s.payment.mode = 'TEST'; },
    s => { s.binding.uid = 'bob'; }, s => { s.binding.orderId = 'other'; }, s => { s.binding.amountKRW = 3299; },
    s => { s.payment.amountKRW = 3299; }, s => { s.payment.payToken = 'other'; }, s => { s.payment.orderNo = 'other'; },
    s => { s.payment.payStatus = 'PAY_APPROVED'; }, s => { s.payment.refundableAmount = 3200; },
    s => { s.payment.transactions[0].reference = 'other'; }, s => { s.payment.transactions.push(s.payment.transactions[0]); }]) {
    const s = setup(); mutate(s.state); await assert.rejects(s.ports.verifyPayment(request), /PROOF_UNCONFIRMED/);
  }
  assert.deepEqual(await setup().ports.verifyPayment(request), { ...request, mode: 'LIVE', status: 'settled' });
});

test('payment time comes only from the trusted provider observation, never extra request fields', async () => {
  const s = setup(), supplied = { ...request, paidAt: 123, validDays: 1 };
  assert.deepEqual(await s.ports.verifyPayment(supplied), { ...request, mode: 'LIVE', status: 'settled' });
  s.state.payment.paidAt = Date.parse('2026-10-27T00:00:00Z');
  assert.equal((await s.ports.verifyPayment(supplied)).paidAt, s.state.payment.paidAt);
  for (const invalid of [null, '2026-10-27T00:00:00Z', -1, Number.MAX_SAFE_INTEGER]) {
    s.state.payment.paidAt = invalid; await assert.rejects(s.ports.verifyPayment(supplied), /PROOF_UNCONFIRMED/);
  }
});
test('refund proof binds original payment, saved refund number, negative transaction amount and exact provider reference', async () => {
  const s = setup(); setRefund(s.state);
  assert.deepEqual(await s.ports.verifyRefund(refundRequest), { ...refundRequest, mode: 'LIVE', status: 'settled' });
  assert.equal(s.calls.length, 1);
  delete s.state.payment.transactions[1].refundNo;
  assert.equal((await s.ports.verifyRefund(refundRequest)).status, 'settled');
  for (const mutate of [s => { s.payment.mode = 'TEST'; }, s => { s.payment.payStatus = 'REFUND_PROGRESS'; },
    s => { s.refund.uid = 'bob'; }, s => { s.refund.refundId = 'other'; }, s => { s.refund.refundNo = 'other'; },
    s => { s.refund.amountKRW = 1320; }, s => { s.refund.paymentReference = 'tosspay:other'; },
    s => { s.refund.transactionReference = 'other'; },
    s => { s.payment.transactions[1].amountKRW = 660; }, s => { s.payment.transactions[1].amountKRW = -1320; },
    s => { s.payment.transactions[1].reference = 'other'; }, s => { s.payment.transactions.push(s.payment.transactions[1]); }]) {
    const t = setup(); setRefund(t.state); mutate(t.state); await assert.rejects(t.ports.verifyRefund(refundRequest), /PROOF_UNCONFIRMED/);
  }
  await assert.rejects(s.ports.verifyRefund({ ...refundRequest, paymentHash: credits.hash('other') }), /PROOF_UNCONFIRMED/);
});
test('provider-derived proofs plug into the real order manager: concurrent callbacks credit once and unused partial refunds settle once', async () => {
  const s = setup(), db = coachingMemoryDb(); db.data.set('users/alice', { uid: 'alice' });
  const manager = orders.createCreditOrderManager({ db, enabled: true, product: {
    id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'unit_test_only', expiresAt: null },
  now: () => Date.parse('2026-10-26T00:00:00Z'), ...s.ports });
  await manager.createOrder('alice', 'order_1');
  const paid = await Promise.all([manager.confirmPayment('alice', 'order_1', 'tosspay:pay_1'), manager.confirmPayment('alice', 'order_1', 'tosspay:pay_1')]);
  assert.equal(paid.filter(r => !r.duplicate).length, 1);
  const view = () => db.data.get(credits.walletRef(db, 'alice').path);
  assert.equal(view().available, 50);
  await manager.reserveRefund('alice', 'order_1', 'refund_1', 10); assert.equal(view().available, 40); assert.equal(view().refundHeld, 10);
  // Synthetic provider failure: leave units held until a matching refund exists.
  await assert.rejects(manager.confirmRefund('alice', 'order_1', 'refund_1', 'tosspay:tx_refund_1'), /UNCONFIRMED/);
  assert.equal(view().refundHeld, 10); setRefund(s.state);
  const refunded = await Promise.all([manager.confirmRefund('alice', 'order_1', 'refund_1', 'tosspay:tx_refund_1'),
    manager.confirmRefund('alice', 'order_1', 'refund_1', 'tosspay:tx_refund_1')]);
  assert.equal(refunded.filter(r => !r.duplicate).length, 1);
  assert.equal(view().available, 40); assert.equal(view().refunded, 10); assert.equal(view().refundHeld, 0);
  credits.validateWallet(view(), 'alice');
});
