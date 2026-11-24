import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayPurchaseSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-purchase-session.js';
import { createLocalReplayPurchaseClient } from '../../src/domains/stats/sudden-attack/replay/infra/replay-purchase-client.js';
import { validatePurchaseEnvelope } from '../../src/domains/stats/sudden-attack/replay/domain/replay-purchase-response.js';
import { isLocalPurchaseFlow } from '../../src/domains/stats/sudden-attack/replay/ui/replay-purchase-flow.js';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import core from '../../cloud-functions/replay-coaching-credits.js';
import ack from '../../cloud-functions/replay-coaching-acknowledgement.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const ORIGIN = 'http://127.0.0.1:4173', NOW = Date.parse('2026-10-26T00:00:00Z'), ID = 'local_ui_order_000001';
const product = { id: core.PRODUCT, quantity: 50, amountKRW: 3300, currency: 'KRW', termsVersion: 'local_only', expiresAt: null };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup({ checkoutEnabled = true, policy = product } = {}) {
  const db = coachingMemoryDb(), pointers = new Map(), calls = [], payment = {}, counters = { create: 0, approve: 0, inspect: 0 };
  for (const uid of ['alice', 'bob']) db.data.set(`users/${uid}`, { uid });
  const provider = { mode: 'LIVE', async createPayment(expected) { counters.create++;
    Object.assign(payment, expected, { mode: 'LIVE', payToken: 'synthetic_ui_token', payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [] });
    return { ...payment, checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=synthetic_ui_token' }; },
    async inspectPayment() { counters.inspect++; return structuredClone(payment); },
    async approvePayment() { counters.approve++; payment.payStatus = 'PAY_COMPLETE'; payment.paidAt = NOW;
      payment.transactions = [{ kind: 'PAY', reference: 'synthetic_ui_tx', amountKRW: 3300 }]; } };
  const handler = service.createReplayPurchaseHandler({ db, enabled: true, checkoutEnabled, provider, productDesc: 'Local only', product: policy, now: () => NOW,
    verifyToken: async token => { if (!['alice', 'bob'].includes(token)) throw Error(); return { uid: token }; } });
  const send = createLocalReplayPurchaseClient({ origin: ORIGIN, fetchImpl: async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) }); const result = { status: 200 };
    const res = { set() {}, status(v) { result.status = v; return this; }, json(v) { result.body = v; return this; } };
    await handler({ method: 'POST', headers: { authorization: init.headers.Authorization, origin: 'https://trackingsa.com', 'content-type': 'application/json' }, rawBody: Buffer.from(init.body) }, res);
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } });
  } });
  const auth = { user: { uid: 'alice', getIdToken: async () => 'alice' } };
  const options = { getUser: () => auth.user, send, uuid: () => ID, readPointer: uid => pointers.get(uid) || null,
    writePointer: (uid, id) => pointers.set(uid, id), clearPointer: uid => pointers.delete(uid) };
  return { db, pointers, calls, payment, counters, options, auth, session: extra => createReplayPurchaseSession({ ...options, ...extra }) };
}
const prepare = async s => { await s.request('product'); s.accept(true); await s.request('create'); };

test('relative validity survives the real handler/client/session chain and malformed duration responses are rejected', async () => {
  const s = setup({ policy: { ...product, validDays: 365 } }), session = s.session();
  await prepare(session);
  const pending = structuredClone(session.view().order);
  assert.equal(pending.validDays, 365); assert.equal(pending.expiresAt, null); assert.equal(pending.paidAt, null);
  await session.request('checkout'); s.payment.payStatus = 'PAY_APPROVED'; await session.request('complete');
  const paid = session.view().order;
  assert.equal(session.view().state, 'funded'); assert.equal(paid.paidAt, NOW);
  assert.equal(paid.expiresAt, NOW + 365 * 86400000);
  for (const change of [{ validDays: 0 }, { validDays: 366 }, { paidAt: null }, { paidAt: NOW - 1 },
    { expiresAt: null }, { expiresAt: paid.expiresAt + 1 }]) {
    assert.throws(() => validatePurchaseEnvelope({ order: { ...paid, ...change } }, 'get', ID), /INVALID_PURCHASE_RESPONSE/);
  }
  assert.throws(() => validatePurchaseEnvelope({ order: { ...pending, expiresAt: paid.expiresAt } }, 'get', ID), /INVALID_PURCHASE_RESPONSE/);
  for (const change of [{ validDays: undefined }, { validDays: 366 }, { expiresAt: NOW }]) {
    assert.throws(() => validatePurchaseEnvelope({ product: { ...product, validDays: 365, ...change }, paymentEnabled: true }, 'product'), /INVALID_PURCHASE_RESPONSE/);
  }
  for (const fields of [{ validDays: 1 }, { paidAt: NOW }, { expiresAt: NOW + 86400000 }]) {
    const rejected = await s.options.send({ action: 'create', orderId: ID, termsVersion: product.termsVersion, ...fields }, 'alice');
    assert.equal(rejected.status, 400); assert.equal(rejected.body.error, 'INVALID_REQUEST');
  }
});

test('purchase transport and UI entry only accept explicit loopback flags; production cannot make a request', async () => {
  let calls = 0;
  for (const origin of ['https://trackingsa.com', 'https://evil.test', 'http://localhost:4173']) {
    await assert.rejects(createLocalReplayPurchaseClient({ origin, fetchImpl: () => { calls++; } })({ action: 'product' }, 'alice'), /DISABLED/);
    assert.equal(isLocalPurchaseFlow({ origin, search: '?coaching=review&transport=api&purchase=flow' }), false);
  }
  assert.equal(calls, 0); assert.equal(isLocalPurchaseFlow({ origin: ORIGIN, search: '?coaching=review&transport=api&purchase=flow' }), true);
  assert.equal(isLocalPurchaseFlow({ origin: ORIGIN, search: '?coaching=review&transport=api' }), false);
});

test('server product is authenticated, fixed and read without DB operations; disabled checkout cannot create through the session', async () => {
  const s = setup({ checkoutEnabled: false }), session = s.session();
  assert.equal(s.calls.length, 0); await session.request('product');
  assert.equal(s.db.transactions, 0); assert.equal(session.view().state, 'disabled');
  assert.deepEqual(session.view().product, { ...product, disclosure: ack.previewDisclosure(product) });
  session.accept(true); await session.request('create'); assert.equal(s.calls.length, 1); assert.equal(s.pointers.size, 0);
  assert.deepEqual(s.calls[0].body, { action: 'product' });
});

test('client/session/real handler chain prepares, hands off and manually confirms one order; get performs no external lookup', async () => {
  const s = setup(), session = s.session(); await prepare(session);
  assert.equal(session.view().state, 'order_created'); assert.equal(s.pointers.get('alice'), ID);
  assert.equal(session.view().order.amountKRW, 3300); await session.request('checkout');
  assert.equal(session.view().state, 'checkout_ready'); assert.match(session.view().checkoutPage, /^https:\/\/pay\.toss\.im\//);
  s.payment.payStatus = 'PAY_APPROVED'; await session.request('complete'); assert.equal(session.view().state, 'funded');
  assert.deepEqual(s.counters, { create: 1, approve: 1, inspect: 2 });
  await session.request('complete'); assert.equal(s.counters.approve, 1);
  await session.request('get'); assert.equal(s.counters.inspect, 2);
  assert.equal(s.db.data.get(core.walletRef(s.db, 'alice').path).available, 50);
  for (const call of s.calls) {
    assert.equal(call.url, ORIGIN + '/api/replay-coaching-purchase');
    assert.equal(call.init.headers.Authorization, 'Bearer alice');
    for (const [k, v] of Object.entries({ credentials: 'omit', cache: 'no-store', redirect: 'error', mode: 'same-origin', referrerPolicy: 'no-referrer' })) assert.equal(call.init[k], v);
    assert.doesNotMatch(call.init.body, /"uid"|"amountKRW"|"quantity"|"payToken"|"checkoutPage"|"paymentReference"/);
  }
  assert.deepEqual([...s.pointers.values()], [ID]); // No token, price, URL or consent storage.
});

test('unknown create keeps the same pointer across remounts and an explicit same-ID retry cannot create another order', async () => {
  const s = setup(); let lost = true;
  const session = s.session({ send: async (...args) => { const response = await s.options.send(...args); if (lost && args[0].action === 'create') { lost = false; throw Error(); } return response; } });
  await prepare(session); assert.equal(session.view().state, 'unknown'); assert.equal(s.pointers.get('alice'), ID);
  await session.request('create'); assert.equal(s.calls.filter(c => c.body.action === 'create').length, 2);
  assert.ok(s.calls.filter(c => c.body.action === 'create').every(c => c.body.orderId === ID));
  session.dispose(); const next = s.session(); assert.equal(next.view().state, 'restore');
  assert.equal(s.calls.length, 3); await next.request('get'); assert.equal(next.view().order.orderId, ID);
  assert.equal(s.db.data.get(`_replay_coaching_users/credit_purchase_capacity_v1_${core.owner('alice')}`).created, 1);
});

test('return URL is only an order hint; it never creates, approves or grants without explicit authenticated requests', async () => {
  const s = setup(), session = s.session(); await prepare(session); await session.request('checkout'); session.dispose();
  const count = s.calls.length, next = s.session({ returnOrderId: ID });
  assert.equal(s.calls.length, count); assert.equal(next.view().canCreate, false); assert.equal(next.view().canComplete, false);
  await next.request('create'); await next.request('complete'); assert.equal(s.calls.length, count);
  await next.request('get'); assert.equal(next.view().canComplete, true); assert.equal(s.counters.approve, 0);
  s.payment.payStatus = 'PAY_APPROVED'; await next.request('complete'); assert.equal(next.view().state, 'funded');
  const invalid = s.session({ invalidReturn: true }); await invalid.request('create'); await invalid.request('get');
  assert.equal(invalid.view().state, 'invalid_return'); assert.equal(invalid.view().canReset, true);
});

test('cross-account return hints cannot reveal orders or fund another account', async () => {
  const s = setup(); await prepare(s.session()); s.auth.user = { uid: 'bob', getIdToken: async () => 'bob' };
  const other = s.session({ returnOrderId: ID }); await other.request('get');
  assert.equal(other.view().state, 'not_found'); assert.equal(other.view().order, null); assert.equal(other.view().canComplete, false);
  assert.equal(s.counters.create, 0); assert.equal(s.pointers.has('bob'), false);
});

test('a checkout return without its saved pointer cannot fall back to creating another purchase', async () => {
  const s = setup(), session = s.session({ returning: true });
  assert.equal(session.view().state, 'missing_return'); session.accept(true);
  for (const action of ['product', 'create', 'checkout', 'complete', 'get']) await session.request(action);
  assert.equal(s.calls.length, 0); assert.equal(session.view().canCreate, false);
});

test('lost completion acknowledgement recovers the paid ledger without another approval or purchase', async () => {
  const s = setup(), session = s.session(); await prepare(session); await session.request('checkout'); session.dispose();
  s.payment.payStatus = 'PAY_APPROVED'; let lost = true;
  const current = s.session({ send: async (...args) => {
    const result = await s.options.send(...args);
    if (lost && args[0].action === 'complete') { lost = false; throw Error('lost acknowledgement'); } return result;
  } });
  await current.request('get'); await current.request('complete'); assert.equal(current.view().state, 'unknown');
  assert.equal(s.counters.approve, 1); current.dispose();
  const restored = s.session(); await restored.request('get'); assert.equal(restored.view().state, 'funded');
  assert.equal(s.counters.approve, 1); assert.equal(s.counters.create, 1);
  assert.equal(s.db.data.get(core.walletRef(s.db, 'alice').path).purchased, 50);
});

test('duplicate clicks and token delays issue one request; account changes discard delayed responses and URLs', async () => {
  const s = setup(), session = s.session(); await prepare(session);
  const wait = deferred(); s.auth.user.getIdToken = () => wait.promise;
  const first = session.request('checkout'); await session.request('checkout');
  s.auth.user = { uid: 'bob', getIdToken: async () => 'bob' }; session.authChanged(); wait.resolve('alice'); await first;
  assert.equal(s.counters.create, 0); assert.equal(session.view().order, null); assert.equal(session.view().checkoutPage, null);
  s.auth.user = { uid: 'alice', getIdToken: async () => 'alice' }; session.authChanged(); await session.request('get');
  const gate = deferred(), delayed = s.session({ send: async (...args) => { const value = await s.options.send(...args); await gate.promise; return value; } });
  const pending = delayed.request('get'); while (s.calls.length < 4) await new Promise(r => setImmediate(r));
  delayed.dispose(); gate.resolve(); await pending; assert.equal(delayed.view().order, null);
});

test('storage failure stops mutation before sending and no new ID is generated to escape an unknown outcome', async () => {
  const s = setup(), session = s.session({ writePointer: () => { throw Error('quota'); } });
  await prepare(session); assert.equal(session.view().state, 'storage_unavailable'); assert.equal(s.calls.length, 1);
  assert.equal(s.db.transactions, 0); assert.equal(session.view().canCreate, false);
  const invalid = s.session({ readPointer: () => 'corrupt' }); await invalid.request('product'); invalid.accept(true);
  await invalid.request('create'); assert.equal(s.db.transactions, 0);
});

test('untrusted responses and checkout links never become a navigation target or a paid state', async () => {
  const s = setup(), session = s.session(); await prepare(session);
  const o = { ...session.view().order, checkoutState: 'dispatching', paymentEnabled: true };
  for (const checkoutPage of ['https://evil.test/', 'https://pay.toss.im@evil.test/',
    'https://pay.toss.im/payfront/auth?payToken=a&payToken=b', 'javascript:alert(1)']) {
    assert.throws(() => validatePurchaseEnvelope({ order: o, outcome: 'checkout_ready', checkoutPage }, 'checkout', ID), /INVALID/);
  }
  assert.throws(() => validatePurchaseEnvelope({ order: o, outcome: 'funded' }, 'complete', ID), /INVALID/);
  assert.throws(() => validatePurchaseEnvelope({ order: { ...o, orderId: 'other_order_00001' } }, 'get', ID), /INVALID/);
  const bad = s.session({ send: async () => ({ status: 200, body: { ...product, checkoutPage: 'https://evil.test' } }) });
  await bad.request('get'); assert.equal(bad.view().order, null); assert.equal(bad.view().checkoutPage, null);
});

test('bounded transport rejects malformed, oversized and redirected responses without retries', async () => {
  for (const response of [new Response('{', { headers: { 'content-type': 'application/json' } }),
    new Response('{}', { headers: { 'content-type': 'text/html' } }),
    new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '4097' } }),
    new Response('x'.repeat(4097), { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0; const send = createLocalReplayPurchaseClient({ origin: ORIGIN, fetchImpl: async () => { calls++; return response; } });
    await assert.rejects(send({ action: 'product' }, 'alice'), /UNKNOWN/); assert.equal(calls, 1);
  }
});
