import test from 'node:test';
import assert from 'node:assert/strict';
import toss from '../../cloud-functions/replay-coaching-tosspay.js';
const KEY = 'sk_test_12345678901234567890';
const expected = { orderNo: 'test_order_1', amountKRW: 3300, payToken: 'test_pay_token' };
const pay = { stepType: 'PAY', transactionId: 'pay_1', transactionAmount: 3300 };
const refund = (number = 'refund_1', amount = 660) => ({ stepType: 'REFUND', transactionId: `tx_${number}`, refundNo: number, transactionAmount: -amount });
const status = (extra = {}) => ({ code: 0, mode: 'TEST', orderNo: expected.orderNo, payToken: expected.payToken,
  amount: 3300, payStatus: 'PAY_COMPLETE', refundableAmount: 3300, paidAmount: 2800, discountedAmount: 500,
  amountTaxFree: 0, amountServiceFee: 0, disposableCupDeposit: 0, transactions: [pay], ...extra });
const response = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
function setup(replies, extra = {}) {
  const calls = [], queue = [...replies];
  const client = toss.createTossPayTestClient({ enabled: true, apiKey: KEY, timeoutMs: 1000,
    retUrl: 'http://127.0.0.1:4173/return', retCancelUrl: 'http://127.0.0.1:4173/cancel',
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body); calls.push({ url, options, body });
      assert.match(url, /^https:\/\/pay\.toss\.im\/api\/v2\/(payments|status|execute|refunds)$/);
      assert.equal(body.apiKey, KEY); assert.equal(options.redirect, 'error');
      assert.ok(queue.length, 'unexpected request/retry'); const next = queue.shift();
      if (next instanceof Error) throw next;
      return next instanceof Response ? next : response(next);
    }, ...extra });
  return { client, calls };
}
const created = () => ({ code: 0, payToken: expected.payToken, checkoutPage: `https://pay.toss.im/payfront/auth?payToken=${expected.payToken}` });

test('expired TEST amount zero is cancellation evidence only and cannot execute or refund', async () => {
  const cancelled = status({ payStatus: 'PAY_CANCEL', amount: 0, refundableAmount: 0, transactions: [] });
  const s = setup([cancelled]); assert.equal((await s.client.inspectPayment(expected)).payStatus, 'PAY_CANCEL');
  const a = setup([cancelled]); await assert.rejects(a.client.approvePayment(expected), /NOT_APPROVABLE/); assert.equal(a.calls.length, 1);
  const r = setup([cancelled]); await assert.rejects(r.client.refundPayment({ ...expected, refundNo: 'cancelled_refund', amountKRWToRefund: 66 }), /UNRESOLVED/); assert.equal(r.calls.length, 1);
  for (const override of [{ orderNo: 'other' }, { payToken: 'other' }, { mode: 'LIVE' }, { amount: 1 }, { transactions: [pay] }, { refundableAmount: 1 }, { payStatus: 'PAY_COMPLETE' }]) {
    await assert.rejects(setup([{ ...cancelled, ...override }]).client.inspectPayment(expected));
  }
});

test('Toss Pay adapter is disabled by default and refuses live keys before making any request', async () => {
  await assert.rejects(toss.createTossPayTestClient().inspectPayment(expected), /DISABLED/);
  for (const apiKey of ['sk_live_12345678901234567890', '', undefined]) {
    const s = setup([], { apiKey }); await assert.rejects(s.client.inspectPayment(expected), /TEST_KEY_REQUIRED/); assert.equal(s.calls.length, 0);
  }
});
test('creation fixes manual approval, tax-free zero and trusted return URLs; checkout must belong to Toss and the same token', async () => {
  const s = setup([created()]); const value = await s.client.createPayment({ ...expected, productDesc: 'AI 분석 테스트', autoExecute: true, apiKey: 'client_key', retUrl: 'https://evil.test/' });
  assert.equal(value.mode, 'TEST'); assert.equal(s.calls.length, 1);
  assert.deepEqual(s.calls[0].body, { apiKey: KEY, orderNo: expected.orderNo, amount: 3300, amountTaxFree: 0,
    productDesc: 'AI 분석 테스트', retUrl: 'http://127.0.0.1:4173/return', retCancelUrl: 'http://127.0.0.1:4173/cancel', autoExecute: false });
  for (const checkoutPage of ['https://evil.test/?payToken=test_pay_token', 'https://pay.toss.im/payfront/auth?payToken=other',
    'https://demo-06357c70@example.com/payfront/auth?payToken=test_pay_token', 'https://pay.toss.im/payfront/auth?payToken=test_pay_token&payToken=test_pay_token']) {
    await assert.rejects(setup([{ ...created(), checkoutPage }]).client.createPayment({ ...expected, productDesc: 'test' }), /INVALID_RESPONSE/);
  }
});
test('invalid order, amount, product text and private callback are rejected before creation', async () => {
  for (const overrides of [{ orderNo: '../bad' }, { amountKRW: 1.5 }, { amountKRW: 0 }, { productDesc: 'bad"text' }, { productDesc: ' ' }]) {
    const s = setup([]); await assert.rejects(s.client.createPayment({ ...expected, productDesc: 'test', ...overrides }), /INVALID_REQUEST/); assert.equal(s.calls.length, 0);
  }
  const s = setup([], { resultCallback: 'http://127.0.0.1:4173/callback' });
  await assert.rejects(s.client.createPayment({ ...expected, productDesc: 'test' }), /INVALID_URL/); assert.equal(s.calls.length, 0);
});
test('status validates TEST mode and original amount without mistaking a Toss discount for underpayment; private fields are discarded', async () => {
  const s = setup([status({ accountNumber: 'private', cardNumber: 'private', futureField: { value: 1 } })]);
  const value = await s.client.inspectPayment(expected);
  assert.equal(value.amountKRW, 3300); assert.equal(value.transactions[0].reference, 'pay_1');
  assert.doesNotMatch(JSON.stringify(value), /private|accountNumber|cardNumber|paidAmount|apiKey|futureField/);
  for (const override of [{ mode: 'LIVE' }, { orderNo: 'other' }, { payToken: 'other' }, { amount: 3299 },
    { refundableAmount: 3301 }, { transactions: [pay, pay] }, { transactions: [refund(), refund()] }, { transactions: null }]) {
    await assert.rejects(setup([status(override)]).client.inspectPayment(expected), /MISMATCH|INVALID_RESPONSE/);
  }
});
test('approval requires buyer-authenticated state and confirms again through status instead of trusting the approval response', async () => {
  for (const payStatus of ['PAY_STANDBY', 'PAY_CANCEL', 'PAY_PROGRESS', 'NEW_FUTURE_STATE']) {
    const s = setup([status({ payStatus, ...(payStatus === 'PAY_CANCEL' ? {amount:0,refundableAmount:0,transactions:[]} : {}) })]); await assert.rejects(s.client.approvePayment(expected), /NOT_APPROVABLE/); assert.equal(s.calls.length, 1);
  }
  const s = setup([status({ payStatus: 'PAY_APPROVED' }), { code: 0 }, status()]);
  assert.equal((await s.client.approvePayment(expected)).payStatus, 'PAY_COMPLETE');
  assert.deepEqual(s.calls.map(c => c.url.split('/').at(-1)), ['status', 'execute', 'status']);
  assert.deepEqual(s.calls[1].body, { apiKey: KEY, orderNo: expected.orderNo, payToken: expected.payToken });
  const duplicate = setup([status()]); await duplicate.client.approvePayment(expected); assert.equal(duplicate.calls.length, 1);
  const unresolved = setup([status({ payStatus: 'PAY_APPROVED' }), { code: 0 }, status({ payStatus: 'PAY_PROGRESS' })]);
  await assert.rejects(unresolved.client.approvePayment(expected), /PAYMENT_UNRESOLVED/);
});
test('partial refund always sends an explicit amount and stable idempotent refund number, confirmed against a negative refund transaction', async () => {
  const after = status({ payStatus: 'REFUND_SUCCESS', refundableAmount: 2640, transactions: [pay, refund()] });
  const s = setup([status(), { code: 0, payToken: expected.payToken, refundNo: 'refund_1', refundedAmount: 660, transactionId: 'tx_refund_1' }, after]);
  const value = await s.client.refundPayment({ ...expected, refundNo: 'refund_1', amountKRWToRefund: 660 });
  assert.equal(value.reference, 'tx_refund_1'); assert.equal(value.amountKRW, 660); assert.equal(value.mode, 'TEST');
  assert.deepEqual(s.calls[1].body, { apiKey: KEY, payToken: expected.payToken, orderNo: expected.orderNo, refundNo: 'refund_1', amount: 660, amountTaxFree: 0, idempotent: true });
  const duplicate = setup([after]); await duplicate.client.refundPayment({ ...expected, refundNo: 'refund_1', amountKRWToRefund: 660 });
  assert.equal(duplicate.calls.length, 1);
  await assert.rejects(setup([after]).client.refundPayment({ ...expected, refundNo: 'refund_1', amountKRWToRefund: 1320 }), /CONFLICT/);
});
test('observed TEST refund shape accepts negative refundedAmount and missing refundNo in status, using the exact returned transaction ID', async () => {
  const tx = refund(); delete tx.refundNo;
  const after = status({ payStatus: 'REFUND_SUCCESS', refundableAmount: 2640, transactions: [pay, tx] });
  const s = setup([status(), { code: 0, payToken: expected.payToken, refundNo: 'refund_1', refundedAmount: -660, transactionId: tx.transactionId }, after]);
  const request = { ...expected, refundNo: 'refund_1', amountKRWToRefund: 660 };
  assert.equal((await s.client.refundPayment(request)).reference, tx.transactionId);
  const duplicate = setup([after]); await duplicate.client.refundPayment({ ...request, refundReference: tx.transactionId });
  assert.equal(duplicate.calls.length, 1);
  const wrong = setup([status(), { code: 0, payToken: expected.payToken, refundNo: 'refund_1', refundedAmount: -660, transactionId: 'unrelated' }, after]);
  await assert.rejects(wrong.client.refundPayment(request), /UNRESOLVED/);
});
test('refund omission, insufficient balance, mixed tax and in-progress refunds cannot trigger a new refund', async () => {
  const invalid = setup([]); await assert.rejects(invalid.client.refundPayment({ ...expected, refundNo: 'refund_1' }), /INVALID_REQUEST/); assert.equal(invalid.calls.length, 0);
  for (const override of [{ refundableAmount: 1 }, { amountTaxFree: 100 }, { payStatus: 'REFUND_PROGRESS' }]) {
    const s = setup([status(override)]);
    await assert.rejects(s.client.refundPayment({ ...expected, refundNo: 'refund_1', amountKRWToRefund: 660 }), /BALANCE|TAX_POLICY|UNRESOLVED/);
    assert.equal(s.calls.length, 1);
  }
});
test('lost refund acknowledgement never retries; its exact refund is recovered by reading status on the next manual attempt', async () => {
  const after = status({ payStatus: 'REFUND_SUCCESS', refundableAmount: 2640, transactions: [pay, refund()] });
  const s = setup([status(), Error(`private ${KEY}`), after]);
  const request = { ...expected, refundNo: 'refund_1', amountKRWToRefund: 660 };
  await assert.rejects(s.client.refundPayment(request), e => e.code === 'TOSSPAY_REQUEST_UNCERTAIN' && !e.message.includes(KEY));
  assert.equal(s.calls.length, 2); await s.client.refundPayment(request);
  assert.deepEqual(s.calls.map(c => c.url.split('/').at(-1)), ['status', 'refunds', 'status']);
});
test('HTTP/JSON/size/timeout failures are bounded, sanitized and never retried', async () => {
  const bad = [new Response('private', { status: 302, headers: { location: 'https://evil.test' } }),
    new Response('bad', { headers: { 'content-type': 'application/json' } }),
    response({ code: -1, msg: KEY }),
    new Response('x', { headers: { 'content-type': 'application/json', 'content-length': '65537' } }),
    new Response(' '.repeat(65537), { headers: { 'content-type': 'application/json' } }),
    new Response('{}', { headers: { 'content-type': 'text/html' } })];
  for (const reply of bad) { const s = setup([reply]);
    await assert.rejects(s.client.inspectPayment(expected), e => /^TOSSPAY_/.test(e.message) && !e.message.includes(KEY)); assert.equal(s.calls.length, 1);
  }
  let calls = 0;
  const s = setup([], { timeoutMs: 10, fetchImpl: async () => { calls++; return new Promise(() => {}); } });
  await assert.rejects(s.client.inspectPayment(expected), /REQUEST_UNCERTAIN/); assert.equal(calls, 1);
});
