import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { merchantFixture, ACCESS, SESSION, ORDER, NOW, uidFor } from '../helpers/merchant-test-fixture.js';
import service from '../../cloud-functions/replay-coaching-merchant-test.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import { onRequest } from '../../functions/api/replay-purchase-test.js';
const ref = f => service.orderRef(f.db, uidFor(SESSION), ORDER).path;
const control = f => service.controlRef(f.db).path;
test('new TEST records snapshot the 20-use offer and reject altered snapshots', async () => {
  const f = merchantFixture();
  assert.equal((await f.call()).body.order.quantity, 20);
  const record = f.db.data.get(ref(f));
  assert.equal(record.schemaVersion, 2);
  assert.deepEqual(record.product, service.PRODUCT);
  record.product.quantity = 50;
  const before = structuredClone(f.db.data.get(control(f)));
  assert.equal((await f.call('get')).body.error, 'REVIEW_STATE_INVALID');
  assert.deepEqual(f.db.data.get(control(f)), before);
  assert.equal(f.counts.create, 0);
});

test('pre-snapshot 50-use TEST orders retain their offer across lookup, checkout and confirmation', async () => {
  const f = merchantFixture(), uid = uidFor(SESSION);
  f.db.data.set(ref(f), { schemaVersion: 1, mode: 'TEST', ownerHash: credits.owner(uid), orderId: ORDER, createdAt: NOW,
    state: 'created', approvalRequestedAt: null, confirmedAt: null, demoExpiresAt: null });
  const original = structuredClone(f.db.data.get(ref(f)));
  assert.equal((await f.call('get')).body.order.quantity, 50);
  assert.deepEqual(f.db.data.get(ref(f)), original);
  assert.equal((await f.call('create')).body.order.quantity, 50);
  assert.equal((await f.call('checkout')).status, 200);
  assert.match(f.payment().productDesc, /50회/);
  f.payment().payStatus = 'PAY_APPROVED';
  assert.equal((await f.call('complete')).body.order.quantity, 50);
  assert.equal((await f.call('get')).body.order.quantity, 50);
  assert.equal(f.counts.create, 1); assert.equal(f.counts.approve, 1);
  const fresh = await f.call('create', { orderId: 'synthetic_order_02' });
  assert.equal(fresh.body.order.quantity, 20);
  isolated(f);
});
async function checkout(f) { assert.equal((await f.call()).status, 200); assert.equal((await f.call('checkout')).status, 200); }
function isolated(f) {
  for (const [path, value] of f.db.data) {
    assert.match(path, /^_replay_coaching_users\/tosspay_(test_|review_control)/);
    assert.doesNotMatch(path, /\/wallet|\/credit_orders|^users\//);
    assert.equal(JSON.stringify(value).includes(ACCESS), false); assert.equal(JSON.stringify(value).includes(SESSION), false);
  }
}

test('merchant TEST gates reject disabled/LIVE/unconfigured/auth/origin/shape before DB', async () => {
  for (const config of [{ enabled: false }, { accessKey: '' }, { provider: { mode: 'LIVE' } }]) {
    const f = merchantFixture(config); assert.equal((await f.call()).status, 503); assert.equal(f.db.transactions, 0);
  }
  for (const request of [{ headers: { authorization: 'Bearer wrong' } }, { session: 'short' }, { headers: { origin: 'https://evil.example' } },
    { headers: { 'content-type': 'text/plain' } }, { method: 'GET' }, { body: { action: 'create', orderId: ORDER, amountKRW: 1 } },
    { orderId: '../not-a-valid-order' }, { body: { action: 'refund', orderId: ORDER } }]) {
    const f = merchantFixture(); assert.ok((await f.call('create', request)).status >= 400); assert.equal(f.db.transactions, 0);
  }
});
test('create/checkout/approve is TEST only, idempotent and supplies a demo expiry, never operating credits', async () => {
  const f = merchantFixture(); await checkout(f);
  const url = (await f.call('checkout')).body.checkoutPage; assert.match(url, /^https:\/\/pay.toss.im\/payfront\//); assert.equal(f.counts.create, 1);
  assert.equal((await f.call('complete')).body.order.state, 'dispatching'); assert.equal(f.counts.approve, 0);
  f.payment().payStatus = 'PAY_APPROVED'; const r = await f.call('complete'); assert.equal(r.status, 200);
  assert.deepEqual(r.body, { mode: 'TEST', demoOnly: true, operationalCreditsGranted: false, order: {
    orderId: ORDER, state: 'confirmed', quantity: 20, amountKRW: 3300, validDays: 365, confirmedAt: NOW, demoExpiresAt: NOW + 365 * 86400000 } });
  const before = { ...f.counts }; await f.call('complete'); await f.call('checkout'); await f.call(); assert.deepEqual(f.counts, before);
  isolated(f);
});
test('concurrent TEST checkout and approval each dispatch one provider write', async () => {
  const f = merchantFixture(); await f.call();
  const created = await Promise.all([f.call('checkout'), f.call('checkout')]); assert.ok(created.some(r => r.status === 200)); assert.equal(f.counts.create, 1);
  f.payment().payStatus = 'PAY_APPROVED';
  const completed = await Promise.all([f.call('complete'), f.call('complete')]); assert.ok(completed.some(r => r.body.order?.state === 'confirmed')); assert.equal(f.counts.approve, 1); isolated(f);
});
test('transaction callback retries never repeat provider calls', async () => {
  const f = merchantFixture(), run = f.db.runTransaction.bind(f.db);
  f.db.runTransaction = fn => run(async tx => { await fn({ ...tx, set() {} }); return fn(tx); });
  await checkout(f); f.payment().payStatus = 'PAY_APPROVED'; assert.equal((await f.call('complete')).status, 200);
  assert.equal(f.counts.create, 1); assert.equal(f.counts.approve, 1); isolated(f);
});
test('lost create response and attach failure retain fences and never recreate a payment', async () => {
  for (const kind of ['response', 'attach']) {
    const f = merchantFixture(), create = f.provider.createPayment;
    f.provider.createPayment = async expected => { const p = await create(expected); if (kind === 'response') throw Error('private detail'); return { ...p, mode: 'LIVE' }; };
    await f.call(); assert.equal((await f.call('checkout')).body.error, 'REVIEW_UNRESOLVED');
    assert.equal((await f.call('checkout')).body.error, 'REVIEW_UNRESOLVED'); assert.equal(f.counts.create, 1);
    assert.equal(f.db.data.get(ref(f)).state, 'uncertain'); isolated(f);
  }
});
test('lost approval acknowledgement recovers paid status without second approval', async () => {
  const f = merchantFixture(); await checkout(f); f.payment().payStatus = 'PAY_APPROVED'; const approve = f.provider.approvePayment;
  f.provider.approvePayment = async p => { await approve(p); throw Error('lost'); };
  assert.equal((await f.call('complete')).body.error, 'REVIEW_UNRESOLVED');
  assert.equal((await f.call('complete')).body.order.state, 'confirmed'); assert.equal(f.counts.approve, 1); isolated(f);
});

test('explicit lookup or completion records verified terminal cancellation without approval or credit', async () => {
  for (const action of ['get', 'complete']) {
    const f = merchantFixture(); await checkout(f);
    Object.assign(f.payment(), { payStatus: 'PAY_CANCEL', amountKRW: 0, refundableAmount: 0 });
    const r = await f.call(action); assert.equal(r.status, 200); assert.equal(r.body.order.state, 'cancelled');
    assert.equal(r.body.order.confirmedAt, null); assert.equal(r.body.order.demoExpiresAt, null);
    for (const next of ['get', 'complete', 'checkout']) assert.equal((await f.call(next)).body.order.state, 'cancelled');
    assert.equal(f.counts.create, 1); assert.equal(f.counts.approve, 0); isolated(f);
    assert.equal((await f.call('get', { session: 'd'.repeat(64) })).status, 404);
  }
});

test('cancel status with wrong binding, refundable money or transactions never closes or confirms an order', async () => {
  for (const edit of [p => p.mode = 'LIVE', p => p.orderNo = 'other', p => p.payToken = 'other', p => p.amountKRW = 1,
    p => p.refundableAmount = 1, p => p.transactions = [{kind:'PAY',reference:'wrong_tx',amountKRW:3300}]]) {
    const f = merchantFixture(); await checkout(f); Object.assign(f.payment(), {payStatus:'PAY_CANCEL',amountKRW:0,refundableAmount:0}); edit(f.payment());
    assert.equal((await f.call('get')).status, 409); assert.equal(f.counts.approve, 0); assert.equal(f.db.data.get(ref(f)).state, 'dispatching');
  }
});
test('approval failure with still-approved status is never resent', async () => {
  const f = merchantFixture(); await checkout(f); f.payment().payStatus = 'PAY_APPROVED';
  f.provider.approvePayment = async () => { f.counts.approve++; throw Error(); };
  assert.equal((await f.call('complete')).status, 409); assert.equal((await f.call('complete')).status, 409); assert.equal(f.counts.approve, 1);
});
test('post-approval DB commit failure recovers on explicit complete', async () => {
  const f = merchantFixture(); await checkout(f); f.payment().payStatus = 'PAY_APPROVED'; const run = f.db.runTransaction.bind(f.db); let lost = false;
  f.db.runTransaction = fn => run(tx => fn({ ...tx, set(r, v) { if (!lost && v.state === 'confirmed') { lost = true; throw Error('db failure'); } tx.set(r, v); } }));
  assert.equal((await f.call('complete')).status, 503); assert.equal((await f.call('complete')).body.order.state, 'confirmed'); assert.equal(f.counts.approve, 1);
});
test('other sessions cannot read/checkout/approve a known TEST order; misses consume daily budget', async () => {
  const f = merchantFixture(); await checkout(f);
  for (const action of ['get', 'checkout', 'complete']) assert.equal((await f.call(action, { session: 'c'.repeat(64) })).status, 404);
  assert.equal(f.db.data.get(control(f)).requests, 5); assert.equal(f.counts.create, 1); assert.equal(f.counts.approve, 0); isolated(f);
});
test('TEST mode/order/token/amount/payment/refund proofs fail closed', async () => {
  for (const edit of [p => p.mode = 'LIVE', p => p.orderNo = 'other', p => p.payToken = 'other', p => p.amountKRW = 1,
    p => p.refundableAmount = 1, p => p.transactions = [], p => p.transactions[0].amountKRW = 1,
    p => p.transactions.push({ kind: 'UNKNOWN', reference: 'other_01', amountKRW: 1 }),
    p => p.transactions.push({ kind: 'REFUND', amountKRW: -66, reference: 'refund_01' }), p => p.payStatus = 'PAY_CANCEL']) {
    const f = merchantFixture(); await checkout(f); await f.provider.approvePayment(f.payment()); edit(f.payment());
    const r = await f.call('complete'); assert.equal(r.status, 409); assert.notEqual(f.db.data.get(ref(f)).state, 'confirmed'); isolated(f);
  }
});
test('untrusted checkout URLs and wrong TEST amount never produce a navigation link', async () => {
  for (const edit of [p => p.checkoutPage = 'https://evil.example/payfront/auth', p => p.amountKRW = 1,
    p => p.checkoutPage += '&payToken=second', p => p.checkoutPage = 'javascript:alert(1)']) {
    const f = merchantFixture(), create = f.provider.createPayment; f.provider.createPayment = async e => { const p = await create(e); edit(p); return p; };
    await f.call(); const r = await f.call('checkout'); assert.equal(r.status, 409); assert.equal(r.body.checkoutPage, undefined);
  }
});
test('raising the daily cap preserves counters and admits orders beyond ten lifetime orders', async () => {
  const f = merchantFixture();
  const day = new Date(NOW + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
  f.db.data.set(control(f), { schemaVersion: 1, day, requests: 16, created: 4, total: 5 });
  const results = await Promise.all(Array.from({length: 6}, (_,i) => f.call('create', {orderId: 'synthetic_extra_' + String(i).padStart(2,'0')})));
  assert.deepEqual(results.map(r => r.status).sort(), [200,200,200,200,200,200]);
  assert.deepEqual(f.db.data.get(control(f)), { schemaVersion: 1, day, requests: 22, created: 10, total: 11 });
  assert.equal((await f.call('create', {orderId:'synthetic_extra_06'})).status, 429);
  assert.deepEqual(service.LIMITS, { dailyRequests: 100, dailyOrders: 10 });
  assert.deepEqual(f.counts, { create: 0, approve: 0, inspect: 0 });
  isolated(f);
});

test('daily requests, ten daily new orders, next-day recovery and date rollback are bounded', async () => {
  const f = merchantFixture(); await f.call(); await f.call();
  assert.equal(f.db.data.get(control(f)).total, 1);
  for (let i = 2; i <= 10; i++) assert.equal((await f.call('create', {orderId: 'synthetic_order_' + String(i).padStart(2,'0')})).status, 200);
  assert.equal((await f.call('create', {orderId: 'synthetic_order_11'})).status, 429);
  for (let i = 11; i < service.LIMITS.dailyRequests; i++) assert.equal((await f.call('get')).status, 200);
  assert.equal((await f.call('get')).status, 429);
  const next = merchantFixture({ db: f.db, now: () => NOW + 86400000 }); assert.equal((await next.call('get')).status, 200);
  assert.equal(f.db.data.get(control(f)).total, 10); assert.equal(f.db.data.get(control(f)).created, 0);
  assert.equal((await next.call('create', {orderId: 'synthetic_order_11'})).status, 200);
  assert.equal(f.db.data.get(control(f)).total, 11);
  assert.equal((await f.call('get')).body.error, 'REVIEW_STATE_INVALID');
});

const env = { TOSSPAY_REVIEW_ENABLED: 'true', TOSSPAY_REVIEW_ACCESS_KEY: ACCESS };
const request = (body = { action: 'create', orderId: ORDER }, headers = {}) => new Request('https://trackingsa.com/api/replay-purchase-test', {
  method: 'POST', headers: { Authorization: `Bearer ${ACCESS}`, 'x-review-session': SESSION, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
test('edge proxy stops disabled/invalid origins, credentials, body and session before upstream', async () => {
  let calls = 0; const fetch = async () => { calls++; throw Error(); };
  for (const ctx of [{ request: request(), env: {} }, { request: request({}, { Origin: 'https://evil.example' }), env },
    { request: request({}, { Authorization: 'Bearer nope' }), env }, { request: request({}, { 'x-review-session': 'short' }), env },
    { request: request({ action: 'create', orderId: ORDER, amountKRW: 1 }), env }, { request: request('x'.repeat(2000)), env }]) {
    assert.ok((await onRequest(ctx, fetch)).status >= 400);
  }
  assert.equal(calls, 0);
});
test('edge proxy pins upstream, forwards only TEST credentials and drops unknown errors/oversized/LIVE responses', async () => {
  for (const payload of [{ mode: 'LIVE', demoOnly: true, operationalCreditsGranted: false }, { error: ACCESS }, 'x'.repeat(5000)]) {
    const r = await onRequest({ request: request(), env }, async (url, options) => {
      assert.equal(url, 'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchaseTest');
      assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit'); assert.equal(options.headers.Cookie, undefined);
      return Response.json(payload, { status: payload?.error ? 409 : 200, headers: { 'Set-Cookie': 'private' } });
    });
    assert.equal(r.headers.get('Set-Cookie'), null); assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.equal(JSON.stringify(await r.json()).includes(ACCESS), false); assert.ok(r.status >= 400);
  }
});
test('product draft conditions match the server product and dormant function never joins routine deploy', () => {
  const html = readFileSync('src/domains/ai-replay-pass/index.html', 'utf8');
  assert.equal(service.PRODUCT.quantity, 20); assert.equal(service.PRODUCT.amountKRW, 3300); assert.equal(service.PRODUCT.validDays, 365);
  for (const text of ['AI 분석 20회', '3,300원', '결제 완료일부터 365일', '판매자 귀책', '7일', '실제 판매는 시작하지 않았습니다']) assert.ok(html.includes(text));
  assert.doesNotMatch(readFileSync('.github/workflows/functions-deploy.yml', 'utf8'), /functions:replayPurchaseTest/);
});

test('edge rejects every redirect without a follow-up request or leaking an upstream location', async () => {
  for (const code of [301, 302, 303, 307, 308]) {
    let calls = 0;
    const response = await onRequest({ request: request(), env }, async (url, options) => {
      calls++; assert.equal(options.redirect, 'manual');
      return new Response(null, { status: code, headers: { Location: `https://evil.example/${ACCESS}` } });
    });
    assert.equal(response.status, 503); assert.equal(calls, 1); assert.equal(response.headers.get('Location'), null);
    assert.equal(JSON.stringify(await response.json()).includes(ACCESS), false);
  }
});
