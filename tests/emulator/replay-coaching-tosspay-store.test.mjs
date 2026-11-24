import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { default: bindings } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-tosspay-store.js')));
const { default: credits } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credits.js')));
const { default: orders } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credit-orders.js')));
const NOW = Date.parse('2026-10-26T00:00:00Z');
const product = { id: credits.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'emulator_only', expiresAt: null };
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') } }); });
after(async () => { await env?.cleanup(); });

test('real Firestore binding dispatch and provider token binding are atomic; owner/admin clients cannot read or change them', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'tosspay-store-owner', admin = 'tosspay-store-admin';
    await setDoc(doc(db, 'users', uid), { uid }); await setDoc(doc(db, 'users', admin), { uid: admin, role: 'admin' });
    const manager = orders.createCreditOrderManager({ db, enabled: true, product, now: () => NOW });
    const store = bindings.createTossPayBindingStore({ db, enabled: true, mode: 'LIVE', now: () => NOW });
    await manager.createOrder(uid, 'order'); const o = (await getDoc(doc(db, credits.orderRef(db, uid, 'order').path))).data();
    const saved = await store.saveOrder(uid, 'order', o);
    const dispatched = await Promise.allSettled([store.markPaymentDispatched(uid, 'order'), store.markPaymentDispatched(uid, 'order')]);
    assert.equal(dispatched.filter(r => r.status === 'fulfilled').length, 1);
    const payment = { mode: 'LIVE', orderNo: saved.orderNo, amountKRW: 3300, payToken: 'emulator_payment_token',
      checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=emulator_payment_token' };
    const attached = await Promise.all([store.attachPayment(uid, 'order', payment), store.attachPayment(uid, 'order', payment)]);
    assert.equal(attached.filter(r => !r.duplicate).length, 1);
    assert.equal((await store.loadBinding(uid, 'order')).payToken, payment.payToken);
    assert.equal((await getDoc(doc(db, credits.walletRef(db, uid).path))).exists(), false);
    const path = bindings.childRef(db, 'LIVE', uid, 'payments', 'order').path;
    for (const client of [env.unauthenticatedContext().firestore(), env.authenticatedContext(uid).firestore(), env.authenticatedContext(admin, { role: 'admin' }).firestore()]) {
      await assertFails(getDoc(doc(client, path))); await assertFails(setDoc(doc(client, path), { stage: 'ready' }));
    }
  });
});
test('real Firestore refund bindings keep the unused-unit lock through uncertainty and persist the exact transaction once', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), uid = 'tosspay-refund-owner', paymentReference = 'tosspay:emulator_payment_tx';
    await setDoc(doc(db, 'users', uid), { uid });
    const manager = orders.createCreditOrderManager({ db, enabled: true, product, now: () => NOW,
      verifyPayment: async request => ({ ...request, mode: 'LIVE', status: 'settled' }) });
    const store = bindings.createTossPayBindingStore({ db, enabled: true, mode: 'LIVE', now: () => NOW });
    await manager.createOrder(uid, 'order'); const order = (await getDoc(doc(db, credits.orderRef(db, uid, 'order').path))).data();
    const saved = await store.saveOrder(uid, 'order', order); await store.markPaymentDispatched(uid, 'order');
    await store.attachPayment(uid, 'order', { mode: 'LIVE', orderNo: saved.orderNo, amountKRW: 3300, payToken: 'emulator_refund_token',
      checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=emulator_refund_token' });
    await manager.confirmPayment(uid, 'order', paymentReference); await manager.reserveRefund(uid, 'order', 'refund', 10);
    const reservation = (await getDoc(doc(db, credits.refundRef(db, uid, 'refund').path))).data();
    const refund = await store.saveRefund(uid, 'order', 'refund', reservation, paymentReference);
    const dispatched = await Promise.allSettled([store.markRefundDispatched(uid, 'order', 'refund'), store.markRefundDispatched(uid, 'order', 'refund')]);
    assert.equal(dispatched.filter(r => r.status === 'fulfilled').length, 1);
    await store.markRefundUncertain(uid, 'order', 'refund');
    await assert.rejects(store.markRefundDispatched(uid, 'order', 'refund'), /UNRESOLVED/);
    const value = { mode: 'LIVE', refundNo: refund.refundNo, amountKRW: 660, reference: 'emulator_refund_tx' };
    const attached = await Promise.all([store.attachRefund(uid, 'order', 'refund', value), store.attachRefund(uid, 'order', 'refund', value)]);
    assert.equal(attached.filter(r => !r.duplicate).length, 1);
    assert.equal((await store.loadRefundBinding(uid, 'order', 'refund')).transactionReference, value.reference);
    const wallet = (await getDoc(doc(db, credits.walletRef(db, uid).path))).data();
    assert.equal(wallet.available, 40); assert.equal(wallet.refundHeld, 10); assert.equal(wallet.refunded, 0);
    const path = bindings.childRef(db, 'LIVE', uid, 'refund_bindings', 'refund').path;
    await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), path)));
    await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), path), { stage: 'ready' }));
  });
});
