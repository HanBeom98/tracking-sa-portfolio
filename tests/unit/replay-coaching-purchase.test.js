import test from 'node:test';
import assert from 'node:assert/strict';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import capacity from '../../cloud-functions/replay-coaching-purchase-capacity.js';
import bindings from '../../cloud-functions/replay-coaching-tosspay-store.js';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import ack from '../../cloud-functions/replay-coaching-acknowledgement.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
const NOW = Date.parse('2026-10-26T00:00:00Z');
const product = { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'test_terms_only', expiresAt: null };
const ORDER = 'test_order_00000001';
const confirmation = p => { const d = ack.previewDisclosure(p); return { accepted: true, version: d.version, digest: d.digest }; };
function setup(extra = {}) {
  const db = coachingMemoryDb(), clock = { value: NOW };
  for (const uid of ['alice', 'bob']) db.data.set(`users/${uid}`, { uid });
  const options = { db, enabled: true, product, reserveCapacity: true, now: () => clock.value,
    verifyPayment: async r => ({ ...r, mode: 'LIVE', status: 'settled' }), ...extra };
  const manager = orders.createCreditOrderManager(options);
  const cap = () => db.data.get(capacity.capacityRef(db, 'alice').path);
  const order = (id = ORDER) => db.data.get(credits.orderRef(db, 'alice', id).path);
  const wallet = () => db.data.get(credits.walletRef(db, 'alice').path);
  const seedLots = (n = 49) => {
    const w = credits.emptyWallet('alice'); w.purchased = n; w.available = n;
    w.lots = Array.from({ length: n }, (_, i) => ({ orderId: `seed_${i}`, remaining: 1, held: 0, refundHeld: 0, expiresAt: null }));
    db.data.set(credits.walletRef(db, 'alice').path, w);
  };
  const store = bindings.createTossPayBindingStore({ db, enabled: true, mode: 'LIVE', now: options.now });
  return { db, clock, options, manager, cap, order, wallet, seedLots, store };
}
function http(s, extra = {}) {
  const handler = service.createReplayPurchaseHandler({ ...s.options, verifyToken: async token => {
    if (!['alice', 'bob'].includes(token)) throw new Error('bad token'); return { uid: token };
  }, ...extra });
  return async (body = { action: 'create', orderId: ORDER, termsVersion: product.termsVersion, acknowledgement: confirmation(product) }, reqExtra = {}) => {
    const req = { method: 'POST', headers: { authorization: 'Bearer alice', 'content-type': 'application/json', origin: 'https://trackingsa.com' },
      rawBody: Buffer.from(JSON.stringify(body)), ...reqExtra };
    const res = { headers: {}, code: 200, body: undefined,
      set(k, v) { this.headers[k] = v; return this; }, status(v) { this.code = v; return this; },
      json(v) { this.body = v; return this; }, send(v) { this.body = v; return this; } };
    await handler(req, res); return res;
  };
}

test('capacity reservation is atomic at the last lot and legacy fulfillment cannot consume it', async () => {
  const s = setup(); s.seedLots();
  const results = await Promise.allSettled([s.manager.createOrder('alice', 'last_a'), s.manager.createOrder('alice', 'last_b')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CREDIT_CAPACITY');
  const held = s.cap().reservations[0].orderId;
  const legacy = orders.createCreditOrderManager({ ...s.options, reserveCapacity: false });
  await legacy.createOrder('alice', 'legacy');
  await assert.rejects(legacy.confirmPayment('alice', 'legacy', 'legacy_payment'), /CREDIT_CAPACITY/);
  assert.equal(s.wallet().available, 49); assert.equal(s.cap().reservations.length, 1);
  await s.manager.beginCheckout('alice', held);
  const paid = await Promise.all([s.manager.confirmPayment('alice', held, 'reserved_payment'), s.manager.confirmPayment('alice', held, 'reserved_payment')]);
  assert.equal(paid.filter(r => !r.duplicate).length, 1); assert.equal(s.wallet().available, 99);
  assert.equal(s.wallet().lots.length, 50); assert.equal(s.cap().reservations.length, 0);
  credits.validateOrder(s.order(held), 'alice', held);
});

test('three open orders and ten new orders per KST day bound growth; retries and day rollover preserve reservations', async () => {
  const s = setup();
  for (const id of ['a', 'b', 'c']) await s.manager.createOrder('alice', id);
  await assert.rejects(s.manager.createOrder('alice', 'd'), /OPEN_LIMIT/);
  await s.manager.createOrder('alice', 'a'); assert.equal(s.cap().created, 3);
  await s.manager.cancelUnstartedOrder('alice', 'b'); await s.manager.cancelUnstartedOrder('alice', 'c');
  for (let i = 3; i < 10; i++) {
    await s.manager.createOrder('alice', `daily_${i}`); await s.manager.cancelUnstartedOrder('alice', `daily_${i}`);
  }
  await assert.rejects(s.manager.createOrder('alice', 'overflow'), /DAILY_LIMIT/);
  s.clock.value = Date.parse('2026-10-26T15:00:00Z');
  await s.manager.createOrder('alice', 'next_day');
  assert.equal(s.cap().day, '20261027'); assert.equal(s.cap().created, 1);
  assert.deepEqual(s.cap().reservations.map(r => r.orderId), ['a', 'next_day']);
});

test('cancel versus begin has one winner, closed orders never reopen, uncertainty keeps the hold', async () => {
  for (const cancelFirst of [true, false]) {
    const s = setup(); await s.manager.createOrder('alice', ORDER);
    const cancel = () => s.manager.cancelUnstartedOrder('alice', ORDER), begin = () => s.manager.beginCheckout('alice', ORDER);
    const results = await Promise.allSettled((cancelFirst ? [cancel, begin] : [begin, cancel]).map(f => f()));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    if (cancelFirst) {
      assert.equal(s.order().checkout.state, 'closed'); assert.equal(s.cap().reservations.length, 0);
      assert.equal((await cancel()).duplicate, true);
      await assert.rejects(s.manager.createOrder('alice', ORDER), /CONFLICT/);
      await assert.rejects(s.manager.confirmPayment('alice', ORDER, 'closed_payment'), /UNRESOLVED/);
    } else {
      await s.manager.markCheckoutUncertain('alice', ORDER); s.clock.value += 7 * 86400000;
      await assert.rejects(cancel(), /UNRESOLVED/); await assert.rejects(begin(), /UNRESOLVED/);
      assert.equal(s.cap().reservations.length, 1);
      await s.manager.confirmPayment('alice', ORDER, 'recovered_payment');
      assert.equal(s.wallet().available, 50); assert.equal(s.cap().reservations.length, 0);
    }
  }
});

test('LIVE binding dispatch requires the order fence and cannot dispatch a cancelled reservation', async () => {
  const s = setup(); await s.manager.createOrder('alice', ORDER);
  const draft = await s.store.saveOrder('alice', ORDER, s.order());
  await assert.rejects(s.store.markPaymentDispatched('alice', ORDER), /UNRESOLVED/);
  await s.manager.beginCheckout('alice', ORDER); await s.store.markPaymentDispatched('alice', ORDER);
  await assert.rejects(s.manager.cancelUnstartedOrder('alice', ORDER), /UNRESOLVED/);
  const p = { mode: 'LIVE', orderNo: draft.orderNo, amountKRW: 3300, payToken: 'unit_capacity_token',
    checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=unit_capacity_token' };
  await s.store.attachPayment('alice', ORDER, p);
  await s.manager.confirmPayment('alice', ORDER, 'binding_payment');
  assert.equal((await s.store.attachPayment('alice', ORDER, p)).duplicate, true);
  await s.manager.createOrder('alice', 'closed'); await s.store.saveOrder('alice', 'closed', s.order('closed'));
  await s.manager.cancelUnstartedOrder('alice', 'closed');
  await assert.rejects(s.store.markPaymentDispatched('alice', 'closed'), /UNRESOLVED/);
});

test('blocked accounts, expired products, legacy pending orders and inconsistent holds cannot start a new checkout', async () => {
  const s = setup(); s.seedLots(1); s.wallet().status = 'blocked';
  await assert.rejects(s.manager.createOrder('alice', ORDER), /ACCOUNT_UNAVAILABLE/);
  assert.equal(s.cap(), undefined);
  s.wallet().status = 'active';
  const legacy = orders.createCreditOrderManager({ ...s.options, reserveCapacity: false });
  await legacy.createOrder('alice', ORDER); await assert.rejects(s.manager.createOrder('alice', ORDER), /CONFLICT/);
  const expired = setup({ product: { ...product, expiresAt: NOW } });
  await assert.rejects(expired.manager.createOrder('alice', ORDER), /NOT_CONFIGURED/);
  const t = setup(); await t.manager.createOrder('alice', ORDER); t.cap().reservations[0].quantity = 49;
  await assert.rejects(t.manager.beginCheckout('alice', ORDER), /STATE_INVALID/);
  await assert.rejects(t.manager.createOrder('alice', ORDER), /STATE_INVALID/);
  const expiring = setup({ product: { ...product, expiresAt: NOW + 1000 } });
  await expiring.manager.createOrder('alice', ORDER); expiring.clock.value += 1000;
  await assert.rejects(expiring.manager.beginCheckout('alice', ORDER), /EXPIRED/);
  await expiring.manager.cancelUnstartedOrder('alice', ORDER);
});

test('unstarted order cannot be paid and TEST proof cannot release or fund a reservation', async () => {
  const s = setup(); await s.manager.createOrder('alice', ORDER);
  await assert.rejects(s.manager.confirmPayment('alice', ORDER, 'early_payment'), /UNRESOLVED/);
  await s.manager.beginCheckout('alice', ORDER);
  const testManager = orders.createCreditOrderManager({ ...s.options, verifyPayment: async r => ({ ...r, status: 'settled', mode: 'TEST' }) });
  await assert.rejects(testManager.confirmPayment('alice', ORDER, 'test_payment'), /UNCONFIRMED/);
  assert.equal(s.cap().reservations.length, 1); assert.equal(s.wallet(), undefined);
});

test('invalid capacity and checkout metadata fail closed', async () => {
  for (const mutate of [c => { c.created = 11; }, c => { c.reservations[0].createdAt = NOW + 1; },
    c => { c.reservations.push({ ...c.reservations[0] }); }, c => { c.extra = true; }, c => { c.ownerHash = 'bob'; }]) {
    const s = setup(); await s.manager.createOrder('alice', ORDER); mutate(s.cap());
    await assert.rejects(s.manager.beginCheckout('alice', ORDER), /STATE_INVALID/);
  }
  for (const mutate of [c => { c.state = 'funded'; }, c => { c.reservedAt--; }, c => { c.updatedAt = -1; }, c => { c.extra = true; }]) {
    const s = setup(); await s.manager.createOrder('alice', ORDER); mutate(s.order().checkout);
    await assert.rejects(s.manager.beginCheckout('alice', ORDER), /STATE_INVALID/);
  }
});

test('order handler stays disabled by default, gates origin/method/auth before DB and handles preflight', async () => {
  const s = setup(), off = http(s, { enabled: false });
  assert.equal((await off()).code, 503); assert.equal(s.db.transactions, 0);
  const call = http(s);
  assert.equal((await call(undefined, { headers: { origin: 'https://other.example' } })).code, 403);
  assert.equal((await call(undefined, { method: 'GET' })).code, 405);
  assert.equal((await call(undefined, { method: 'OPTIONS' })).code, 204);
  for (const token of ['', 'Bearer invalid', 'Bearer alice bad']) {
    assert.equal((await call(undefined, { headers: { authorization: token } })).code, 401);
  }
  assert.equal((await http(s, { verifyToken: async () => ({ uid: 'a/b' }) })()).code, 401);
  assert.equal(s.db.transactions, 0);
});

test('order handler accepts only bounded JSON with fixed server pricing and current terms version', async () => {
  const s = setup(), call = http(s), body = { action: 'create', orderId: ORDER, termsVersion: product.termsVersion, acknowledgement: confirmation(product) };
  for (const field of ['uid', 'amountKRW', 'quantity', 'payToken', 'paymentReference']) {
    assert.equal((await call({ ...body, [field]: 'injection' })).code, 400);
  }
  for (const input of [null, [], 1, 'bad', { ...body, orderId: '../unsafe' }, { ...body, action: 'confirm' }]) assert.equal((await call(input)).code, 400);
  assert.equal((await call({ ...body, termsVersion: 'old' })).code, 409);
  assert.equal((await call(body, { headers: { authorization: 'Bearer alice', 'content-type': 'text/plain' } })).code, 415);
  assert.equal((await call(body, { rawBody: Buffer.alloc(2049) })).code, 413);
  assert.equal((await call(body, { rawBody: Buffer.from('{') })).code, 400);
  assert.equal((await call(body, { rawBody: Buffer.from([0xff]) })).code, 400);
  assert.equal(s.db.transactions, 0);
});

test('authenticated create is idempotent, returns safe fields and prepares no payment or wallet', async () => {
  const s = setup(), call = http(s);
  const results = await Promise.all([call(), call()]);
  assert.ok(results.every(r => r.code === 200)); assert.equal(results.filter(r => !r.body.duplicate).length, 1);
  assert.equal(s.cap().created, 1); assert.equal(s.cap().reservations.length, 1); assert.equal(s.wallet(), undefined);
  const response = results[0];
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(response.body.order, { orderId: ORDER, product: product.id, quantity: 50, amountKRW: 3300, currency: 'KRW',
    termsVersion: product.termsVersion, expiresAt: null, createdAt: NOW, status: 'pending', checkoutState: 'reserved', paymentEnabled: false,
    acknowledgement: ack.acknowledgement(product, ack.previewDisclosure(product), NOW) });
  assert.equal(await s.store.loadBinding('bob', ORDER), null);
  const prepared = s.db.data.get(bindings.childRef(s.db, 'LIVE', 'alice', 'payments', ORDER).path);
  assert.equal(prepared.stage, 'prepared'); assert.equal(prepared.payToken, null);
  const before = structuredClone([...s.db.data]);
  assert.equal((await call({ action: 'get', orderId: ORDER })).code, 200);
  assert.deepEqual([...s.db.data], before);
});

test('owned get/cancel reject another account, cancellation is idempotent and preserves daily creation count', async () => {
  const s = setup(), call = http(s); await call();
  for (const action of ['get', 'cancel']) {
    const r = await call({ action, orderId: ORDER }, { headers: { authorization: 'Bearer bob', 'content-type': 'application/json' } });
    assert.equal(r.code, 404); assert.equal(s.cap().reservations.length, 1);
  }
  assert.equal((await call({ action: 'cancel', orderId: ORDER })).body.order.checkoutState, 'closed');
  assert.equal((await call({ action: 'cancel', orderId: ORDER })).body.duplicate, true);
  assert.equal(s.cap().reservations.length, 0); assert.equal(s.cap().created, 1);
  assert.equal((await call()).code, 409);
});

test('binding persistence failure can be retried with the same order without a second hold', async () => {
  const s = setup(); let attempts = 0;
  const db = { collection: s.db.collection, runTransaction: fn => {
    if (++attempts === 3) throw Object.assign(new Error('private DB details'), { code: 'UNKNOWN_PRIVATE_ERROR' });
    return s.db.runTransaction(fn);
  } };
  const call = http(s, { db });
  const first = await call(); assert.equal(first.code, 503); assert.deepEqual(first.body, { error: 'PURCHASE_UNAVAILABLE' });
  assert.equal(s.cap().reservations.length, 1);
  const retry = await call(); assert.equal(retry.code, 200); assert.equal(retry.body.duplicate, true);
  assert.equal(s.cap().created, 1); assert.equal(s.cap().reservations.length, 1);
});
