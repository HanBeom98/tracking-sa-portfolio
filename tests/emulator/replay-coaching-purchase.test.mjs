import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { default: credits } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credits.js')));
const { default: orders } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credit-orders.js')));
const { default: capacity } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-purchase-capacity.js')));
const { default: bindings } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-tosspay-store.js')));
const NOW = Date.parse('2026-10-26T00:00:00Z');
const product = { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'emulator_only', expiresAt: null };
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') } }); });
after(async () => { await env?.cleanup(); });
const read = async (db, ref) => (await getDoc(doc(db, ref.path))).data();
const managerFor = (db, extra = {}) => orders.createCreditOrderManager({ db, enabled: true, product, reserveCapacity: true, now: () => NOW,
  verifyPayment: async r => ({ ...r, mode: 'LIVE', status: 'settled' }), ...extra });

test('Firestore contention reserves the last lot once and legacy fulfillment cannot take the reserved slot', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'purchase-last-slot'; await setDoc(doc(db, 'users', uid), { uid });
    const w = credits.emptyWallet(uid); w.purchased = 49; w.available = 49;
    w.lots = Array.from({ length: 49 }, (_, i) => ({ orderId: `seed_${i}`, remaining: 1, held: 0, refundHeld: 0, expiresAt: null }));
    await setDoc(doc(db, credits.walletRef(db, uid).path), w);
    const manager = managerFor(db);
    const results = await Promise.allSettled([manager.createOrder(uid, 'last_a'), manager.createOrder(uid, 'last_b')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'CREDIT_CAPACITY');
    const cRef = capacity.capacityRef(db, uid), held = (await read(db, cRef)).reservations[0].orderId;
    const legacy = managerFor(db, { reserveCapacity: false }); await legacy.createOrder(uid, 'legacy');
    await assert.rejects(legacy.confirmPayment(uid, 'legacy', 'emulator_legacy_reserved'), /CREDIT_CAPACITY/);
    await manager.beginCheckout(uid, held);
    const paid = await Promise.all([manager.confirmPayment(uid, held, 'emulator_capacity_paid'), manager.confirmPayment(uid, held, 'emulator_capacity_paid')]);
    assert.equal(paid.filter(r => !r.duplicate).length, 1);
    const funded = await read(db, credits.walletRef(db, uid)); credits.validateWallet(funded, uid);
    assert.equal(funded.lots.length, 50); assert.equal(funded.available, 99);
    assert.equal((await read(db, cRef)).reservations.length, 0);
  });
});

test('Firestore duplicate create and begin/cancel races preserve one reservation and one irreversible winner', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'purchase-race'; await setDoc(doc(db, 'users', uid), { uid });
    const manager = managerFor(db), store = bindings.createTossPayBindingStore({ db, enabled: true, mode: 'LIVE', now: () => NOW });
    const created = await Promise.all([manager.createOrder(uid, 'order'), manager.createOrder(uid, 'order')]);
    assert.equal(created.filter(r => !r.duplicate).length, 1);
    assert.equal((await read(db, capacity.capacityRef(db, uid))).created, 1);
    await store.saveOrder(uid, 'order', await manager.readOrder(uid, 'order'));
    await assert.rejects(store.markPaymentDispatched(uid, 'order'), /UNRESOLVED/);
    const race = await Promise.allSettled([manager.cancelUnstartedOrder(uid, 'order'), manager.beginCheckout(uid, 'order')]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    const o = await manager.readOrder(uid, 'order'), c = await read(db, capacity.capacityRef(db, uid));
    if (o.checkout.state === 'closed') {
      assert.equal(c.reservations.length, 0); await assert.rejects(store.markPaymentDispatched(uid, 'order'), /UNRESOLVED/);
      await assert.rejects(manager.confirmPayment(uid, 'order', 'emulator_closed_payment'), /UNRESOLVED/);
    } else {
      assert.equal(o.checkout.state, 'dispatching'); assert.equal(c.reservations.length, 1);
      await store.markPaymentDispatched(uid, 'order'); await manager.markCheckoutUncertain(uid, 'order');
      await assert.rejects(manager.cancelUnstartedOrder(uid, 'order'), /UNRESOLVED/);
      assert.equal((await read(db, capacity.capacityRef(db, uid))).reservations.length, 1);
    }
  });
});

test('Firestore concurrent requests enforce the per-account open-order bound without queries', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'purchase-open-bound'; await setDoc(doc(db, 'users', uid), { uid });
    const manager = managerFor(db);
    const results = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => manager.createOrder(uid, `open_${i}`)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'ORDER_OPEN_LIMIT');
    assert.equal((await read(db, capacity.capacityRef(db, uid))).reservations.length, 3);
  });
});

test('capacity, orders and reservations stay private to the server for anonymous, owner and site-admin clients', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'purchase-private-owner', admin = 'purchase-private-admin';
    await setDoc(doc(db, 'users', uid), { uid }); await setDoc(doc(db, 'users', admin), { uid: admin, role: 'admin' });
    const manager = managerFor(db); await manager.createOrder(uid, 'private_order');
    const paths = [capacity.capacityRef(db, uid).path, credits.orderRef(db, uid, 'private_order').path];
    for (const client of [env.unauthenticatedContext().firestore(), env.authenticatedContext(uid).firestore(), env.authenticatedContext(admin, { role: 'admin' }).firestore()]) {
      for (const path of paths) {
        await assertFails(getDoc(doc(client, path))); await assertFails(setDoc(doc(client, path), { reservations: [], status: 'paid' }));
      }
    }
  });
});
