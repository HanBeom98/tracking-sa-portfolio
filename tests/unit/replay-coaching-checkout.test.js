import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../cloud-functions/replay-coaching-credits.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import bindings from '../../cloud-functions/replay-coaching-tosspay-store.js';
import flow from '../../cloud-functions/replay-coaching-checkout.js';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const NOW = Date.parse('2026-10-26T00:00:00Z'), ORDER = 'checkout_order_000001';
const product = { id: core.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'test_only', expiresAt: null };
async function setup({ wrapDb, providerExtra = {} } = {}) {
  const memory = coachingMemoryDb(), calls = { create: 0, inspect: 0, approve: 0 }, clock = { value: NOW };
  for (const uid of ['alice', 'bob']) memory.data.set(`users/${uid}`, { uid });
  const db = wrapDb ? wrapDb(memory) : memory;
  let current;
  const provider = { mode: 'LIVE',
    async createPayment(expected) {
      calls.create++; current = { ...expected, mode: 'LIVE', payToken: 'local_synthetic_token', payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [] };
      return { ...current, checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=local_synthetic_token' };
    },
    async inspectPayment(expected) {
      calls.inspect++; assert.equal(expected.orderNo, current.orderNo); assert.equal(expected.payToken, current.payToken);
      assert.equal(expected.amountKRW, 3300); return structuredClone(current);
    },
    async approvePayment(expected) {
      calls.approve++; assert.equal(expected.payToken, current.payToken);
      current.payStatus = 'PAY_COMPLETE'; current.transactions = [{ kind: 'PAY', reference: 'local_synthetic_tx', amountKRW: 3300 }];
      return { untrustedApprovalBody: true };
    }, ...providerExtra };
  const options = { db, enabled: true, provider, productDesc: '로컬 AI 분석 검증', now: () => clock.value };
  const manager = orders.createCreditOrderManager({ ...options, product, reserveCapacity: true });
  await manager.createOrder('alice', ORDER);
  const store = bindings.createTossPayBindingStore({ ...options, mode: 'LIVE' });
  const coordinator = flow.createReplayCheckout(options);
  const order = () => memory.data.get(core.orderRef(db, 'alice', ORDER).path);
  const wallet = () => memory.data.get(core.walletRef(db, 'alice').path);
  const cap = () => memory.data.get(`_replay_coaching_users/credit_purchase_capacity_v1_${core.owner('alice')}`);
  return { db, memory, calls, clock, options, manager, store, coordinator, order, wallet, cap, provider,
    payment: () => current, ready: async () => { await coordinator.start('alice', ORDER); current.payStatus = 'PAY_APPROVED'; } };
}
function callHandler(s, extra = {}) {
  const handler = service.createReplayPurchaseHandler({ ...s.options, product, verifyToken: async token => ({ uid: token }), ...extra });
  return async (action, { uid = 'alice', fields = {} } = {}) => {
    const req = { method: 'POST', headers: { authorization: `Bearer ${uid}`, 'content-type': 'application/json', origin: 'https://trackingsa.com' },
      rawBody: Buffer.from(JSON.stringify({ action, orderId: ORDER, ...fields })) };
    const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; } };
    await handler(req, res); return res;
  };
}

test('checkout defaults disabled and requires an explicit LIVE provider before any DB or provider access', async () => {
  const s = await setup(), before = s.memory.transactions;
  await assert.rejects(flow.createReplayCheckout({ ...s.options, enabled: false }).start('alice', ORDER), /DISABLED/);
  for (const provider of [undefined, { ...s.provider, mode: 'TEST' }, { ...s.provider, approvePayment: undefined }]) {
    const c = flow.createReplayCheckout({ ...s.options, provider });
    await assert.rejects(c.start('alice', ORDER), /NOT_CONFIGURED/); await assert.rejects(c.complete('alice', ORDER), /NOT_CONFIGURED/);
  }
  assert.equal(s.memory.transactions, before); assert.deepEqual(s.calls, { create: 0, inspect: 0, approve: 0 });
});

test('one server order creates one checkout under concurrency and repeated handoffs reuse the saved Toss URL', async () => {
  const s = await setup();
  const results = await Promise.allSettled([s.coordinator.start('alice', ORDER), s.coordinator.start('alice', ORDER)]);
  assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal(s.calls.create, 1);
  const repeated = await s.coordinator.start('alice', ORDER);
  assert.equal(repeated.outcome, 'checkout_ready'); assert.match(repeated.checkoutPage, /^https:\/\/pay\.toss\.im\/payfront\//);
  assert.equal(s.calls.create, 1); assert.equal(s.wallet(), undefined); assert.equal(s.cap().reservations.length, 1);
  await assert.rejects(s.manager.cancelUnstartedOrder('alice', ORDER), /UNRESOLVED/);
});

test('provider calls stay outside Firestore retry callbacks; buyer approval is rechecked and credits are applied once', async () => {
  const s = await setup({ wrapDb: memory => ({ collection: memory.collection, runTransaction: fn => memory.runTransaction(async tx => {
    await fn(tx); return fn(tx); // Simulate callback retry without committing the first attempt.
  }) }) });
  await s.ready();
  assert.deepEqual(await s.coordinator.complete('alice', ORDER), { outcome: 'funded' });
  assert.deepEqual(s.calls, { create: 1, inspect: 2, approve: 1 });
  assert.equal(s.wallet().available, 50); assert.equal(s.cap().reservations.length, 0);
  assert.equal(s.order().checkout.approvalRequestedAt, NOW);
  const before = { ...s.calls };
  assert.deepEqual(await s.coordinator.complete('alice', ORDER), { outcome: 'already_funded' });
  assert.deepEqual(await s.coordinator.start('alice', ORDER), { outcome: 'already_funded' });
  assert.deepEqual(s.calls, before); assert.equal(s.wallet().purchased, 50);
});

test('lost creation response never creates a new payment or frees the reservation on another request', async () => {
  const s = await setup(); const create = s.provider.createPayment;
  s.provider.createPayment = async value => { await create(value); throw new Error('response lost'); };
  await assert.rejects(s.coordinator.start('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  assert.equal(s.order().checkout.state, 'uncertain'); assert.equal(s.cap().reservations.length, 1);
  await assert.rejects(s.coordinator.start('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  await assert.rejects(s.coordinator.complete('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  assert.equal(s.calls.create, 1); assert.equal(s.calls.approve, 0); assert.equal(s.wallet(), undefined);
});

test('token persistence failure after creation stays unresolved and cannot trigger another create', async () => {
  let rejectReady = true;
  const s = await setup({ wrapDb: memory => ({ collection: memory.collection, runTransaction: fn => memory.runTransaction(tx => fn({
    get: tx.get, set(ref, value) { if (rejectReady && value.stage === 'ready') throw new Error('DB unavailable'); tx.set(ref, value); },
  })) }) });
  await assert.rejects(s.coordinator.start('alice', ORDER), /CHECKOUT_UNRESOLVED/); rejectReady = false;
  await assert.rejects(s.coordinator.start('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  assert.equal(s.calls.create, 1); assert.equal(s.cap().reservations.length, 1); assert.equal(s.wallet(), undefined);
});

test('invalid checkout mode, amount and URL fail closed after the dispatch claim', async () => {
  for (const mutate of [p => { p.mode = 'TEST'; }, p => { p.amountKRW = 1; }, p => { p.orderNo = 'other'; },
    p => { p.checkoutPage = 'https://evil.example/'; }]) {
    const s = await setup(), create = s.provider.createPayment;
    s.provider.createPayment = async value => { const p = await create(value); mutate(p); return p; };
    await assert.rejects(s.coordinator.start('alice', ORDER), /CHECKOUT_UNRESOLVED/);
    assert.equal(s.order().checkout.state, 'uncertain'); assert.equal(s.wallet(), undefined); assert.equal(s.calls.approve, 0);
  }
});

test('an approval response alone is never proof and a pending/uncertain approval is never sent twice', async () => {
  const s = await setup(); await s.ready();
  s.provider.approvePayment = async () => { s.calls.approve++; return { payStatus: 'PAY_COMPLETE' }; };
  await assert.rejects(s.coordinator.complete('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  await assert.rejects(s.coordinator.complete('alice', ORDER), /UNRESOLVED/);
  assert.equal(s.calls.approve, 1); assert.equal(s.wallet(), undefined); assert.equal(s.cap().reservations.length, 1);
});

test('lost approval response recovers by status inspection without sending approval again', async () => {
  const s = await setup(); await s.ready(); const approve = s.provider.approvePayment;
  s.provider.approvePayment = async value => { await approve(value); throw new Error('response lost'); };
  await assert.rejects(s.coordinator.complete('alice', ORDER), /CHECKOUT_UNRESOLVED/);
  assert.equal(s.order().checkout.state, 'uncertain'); assert.equal(s.wallet(), undefined);
  assert.deepEqual(await s.coordinator.complete('alice', ORDER), { outcome: 'funded' });
  assert.equal(s.calls.approve, 1); assert.equal(s.wallet().available, 50);
});

test('concurrent completion claims approval once and never applies the same payment twice', async () => {
  const s = await setup(); await s.ready();
  const results = await Promise.allSettled([s.coordinator.complete('alice', ORDER), s.coordinator.complete('alice', ORDER)]);
  assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal(s.calls.approve, 1);
  assert.equal(s.wallet().purchased, 50); assert.equal(s.cap().reservations.length, 0);
});

test('paid provider status with failed DB fulfillment retains its hold, then recovers without another charge', async () => {
  let rejectPaid = true;
  const s = await setup({ wrapDb: memory => ({ collection: memory.collection, runTransaction: fn => memory.runTransaction(tx => fn({
    get: tx.get, set(ref, value) { if (rejectPaid && value.status === 'paid') throw new Error('DB unavailable'); tx.set(ref, value); },
  })) }) });
  await s.ready(); await assert.rejects(s.coordinator.complete('alice', ORDER), /PAYMENT_FULFILLMENT_UNRESOLVED/);
  assert.equal(s.order().checkout.state, 'uncertain'); assert.equal(s.cap().reservations.length, 1); assert.equal(s.wallet(), undefined);
  rejectPaid = false; assert.equal((await s.coordinator.complete('alice', ORDER)).outcome, 'funded');
  assert.equal(s.calls.approve, 1); assert.equal(s.wallet().available, 50);
});

test('lost fulfillment commit acknowledgement does not grant again on retry', async () => {
  let loseReply = true;
  const s = await setup({ wrapDb: memory => ({ collection: memory.collection, async runTransaction(fn) {
    const result = await memory.runTransaction(fn);
    if (loseReply && result?.credits && result.duplicate === false) { loseReply = false; throw new Error('commit acknowledgement lost'); }
    return result;
  } }) });
  await s.ready(); await assert.rejects(s.coordinator.complete('alice', ORDER), /PAYMENT_FULFILLMENT_UNRESOLVED/);
  assert.equal(s.wallet().available, 50); assert.equal((await s.coordinator.complete('alice', ORDER)).outcome, 'already_funded');
  assert.equal(s.wallet().purchased, 50); assert.equal(s.calls.approve, 1);
});

test('status mismatches, TEST status and refunds never authorize approval or payment funding', async () => {
  for (const mutate of [p => { p.mode = 'TEST'; }, p => { p.orderNo = 'other'; }, p => { p.amountKRW--; },
    p => { p.payToken = 'other'; }, p => { p.refundableAmount = 0; },
    p => { p.transactions = [{ kind: 'PAY', reference: 'partial_tx', amountKRW: 100 }]; },
    p => { p.transactions = [{ kind: 'REFUND', reference: 'refund_tx', amountKRW: -66 }]; }]) {
    const s = await setup(); await s.ready(); mutate(s.payment());
    await assert.rejects(s.coordinator.complete('alice', ORDER), /PAYMENT_UNCONFIRMED/);
    assert.equal(s.calls.approve, 0); assert.equal(s.wallet(), undefined);
  }
  const s = await setup(); await s.ready(); await s.provider.approvePayment(s.payment());
  s.payment().refundableAmount = 3234; s.payment().transactions.push({ kind: 'REFUND', reference: 'refund_tx', amountKRW: -66 });
  await assert.rejects(s.coordinator.complete('alice', ORDER), /FULFILLMENT_UNRESOLVED/);
  assert.equal(s.wallet(), undefined);
});

test('waiting, cancelled and unknown states do not approve; blocking the account before approval prevents a charge', async () => {
  const s = await setup(); await s.coordinator.start('alice', ORDER);
  for (const [status, outcome] of [['PAY_STANDBY', 'awaiting_buyer'], ['PAY_PROGRESS', 'payment_pending']]) {
    s.payment().payStatus = status; assert.equal((await s.coordinator.complete('alice', ORDER)).outcome, outcome);
  }
  for (const status of ['PAY_CANCEL', 'UNRECOGNIZED']) {
    s.payment().payStatus = status; await assert.rejects(s.coordinator.complete('alice', ORDER), /UNCONFIRMED/);
  }
  s.payment().payStatus = 'PAY_APPROVED'; const w = core.emptyWallet('alice'); w.status = 'blocked';
  s.memory.data.set(core.walletRef(s.db, 'alice').path, w);
  await assert.rejects(s.coordinator.complete('alice', ORDER), /ACCOUNT_UNAVAILABLE/); assert.equal(s.calls.approve, 0);
});

test('authenticated HTTP checkout has a separate opt-in, uses only the owner ID and returns no raw ledger fields', async () => {
  const s = await setup(), off = callHandler(s), before = s.memory.transactions;
  assert.equal((await off('checkout')).body.error, 'CHECKOUT_DISABLED'); assert.equal(s.memory.transactions, before);
  const call = callHandler(s, { checkoutEnabled: true });
  assert.equal((await call('checkout', { uid: 'bob' })).code, 404); assert.equal(s.calls.create, 0);
  for (const field of ['uid', 'amountKRW', 'payToken', 'paymentReference', 'checkoutPage']) {
    assert.equal((await call('checkout', { fields: { [field]: 'injected' } })).code, 400);
  }
  const handoff = await call('checkout'); assert.equal(handoff.code, 200); assert.equal(handoff.body.order.paymentEnabled, true);
  assert.match(handoff.body.checkoutPage, /^https:\/\/pay\.toss\.im\//); // URL contains the token; owner-only and no-store.
  assert.equal(handoff.headers['Cache-Control'], 'no-store'); assert.equal(Object.hasOwn(handoff.body, 'payToken'), false);
  s.payment().payStatus = 'PAY_APPROVED'; const completed = await call('complete');
  assert.equal(completed.code, 200); assert.equal(completed.body.outcome, 'funded');
  assert.doesNotMatch(JSON.stringify(completed.body), /local_synthetic_token|local_synthetic_tx|ownerHash|paymentHash|approvalRequestedAt/);
  const beforeGet = { ...s.calls }; assert.equal((await call('get')).code, 200); assert.deepEqual(s.calls, beforeGet);
});

test('a repeated completion after full refund never restores purchased counts', async () => {
  const s = await setup(); await s.ready(); await s.coordinator.complete('alice', ORDER);
  const manager = orders.createCreditOrderManager({ db: s.db, enabled: true, now: () => NOW,
    verifyRefund: async r => ({ ...r, mode: 'LIVE', status: 'settled' }) });
  await manager.reserveRefund('alice', ORDER, 'full_refund', 50);
  await manager.confirmRefund('alice', ORDER, 'full_refund', 'local_full_refund');
  const calls = { ...s.calls }; assert.equal((await s.coordinator.complete('alice', ORDER)).outcome, 'already_funded');
  assert.deepEqual(s.calls, calls); assert.equal(s.wallet().available, 0); assert.equal(s.wallet().refunded, 50);
});
