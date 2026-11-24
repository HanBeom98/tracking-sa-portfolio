import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { default: core } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credits.js')));
const { default: orders } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credit-orders.js')));
const { default: flow } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-checkout.js')));
const NOW = Date.parse('2026-10-26T00:00:00Z');
const product = { id: core.PRODUCT, quantity: 50, amountKRW: 3300, termsVersion: 'emulator_only', expiresAt: null };
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') } }); });
after(async () => { await env?.cleanup(); });
async function setup(db, uid, policy = product) {
  await setDoc(doc(db, 'users', uid), { uid });
  const calls = { create: 0, approve: 0 }, token = `local_${uid}`, state = {}, clock = { value: NOW };
  const provider = { mode: 'LIVE',
    async createPayment(expected) {
      calls.create++; Object.assign(state, expected, { mode: 'LIVE', payToken: token, payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [] });
      return { ...state, checkoutPage: `https://pay.toss.im/payfront/auth?payToken=${token}` };
    },
    async inspectPayment() { return structuredClone(state); },
    async approvePayment() { calls.approve++; state.payStatus = 'PAY_COMPLETE'; state.paidAt = clock.value;
      state.transactions = [{ kind: 'PAY', reference: `local_tx_${uid}`, amountKRW: 3300 }]; },
  };
  const options = { db, enabled: true, productDesc: 'Emulator only', provider, now: () => clock.value };
  const manager = orders.createCreditOrderManager({ ...options, product: policy, reserveCapacity: true }); await manager.createOrder(uid, 'order');
  const coordinator = flow.createReplayCheckout(options);
  return { calls, state, clock, provider, manager, coordinator, uid,
    wallet: async () => (await getDoc(doc(db, core.walletRef(db, uid).path))).data() };
}

test('Firestore recovery retains payment-relative expiry and one grant after a delayed lost approval response', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const { expiresAt, ...base } = product;
    const s = await setup(ctx.firestore(), 'flow_duration', { ...base, validDays: 365 });
    await s.coordinator.start(s.uid, 'order'); s.state.payStatus = 'PAY_APPROVED';
    s.clock.value = NOW + 86400000;
    const approve = s.provider.approvePayment;
    s.provider.approvePayment = async () => { await approve(); throw Error('lost response'); };
    await assert.rejects(s.coordinator.complete(s.uid, 'order'), /CHECKOUT_UNRESOLVED/);
    assert.equal(await s.wallet(), undefined);
    s.clock.value += 3 * 86400000;
    const results = await Promise.allSettled([s.coordinator.complete(s.uid, 'order'), s.coordinator.complete(s.uid, 'order')]);
    assert.ok(results.some(r => r.status === 'fulfilled'));
    const order = await s.manager.readOrder(s.uid, 'order'), wallet = await s.wallet();
    assert.equal(order.validDays, 365); assert.equal(order.paidAt, NOW + 86400000);
    assert.equal(order.expiresAt, NOW + 366 * 86400000); assert.equal(order.checkout.updatedAt, s.clock.value);
    assert.equal(wallet.purchased, 50); assert.equal(wallet.lots[0].expiresAt, order.expiresAt); assert.equal(s.calls.approve, 1);
    assert.equal(core.creditView(wallet, order.expiresAt).remaining, 0);
    assert.equal((await s.coordinator.complete(s.uid, 'order')).outcome, 'already_funded');
  });
});

test('Firestore checkout creation and buyer approval are dispatched once across concurrent callers', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await setup(ctx.firestore(), 'flow_race');
    const starts = await Promise.allSettled([s.coordinator.start(s.uid, 'order'), s.coordinator.start(s.uid, 'order')]);
    assert.ok(starts.some(r => r.status === 'fulfilled')); assert.equal(s.calls.create, 1);
    s.state.payStatus = 'PAY_APPROVED';
    const finishes = await Promise.allSettled([s.coordinator.complete(s.uid, 'order'), s.coordinator.complete(s.uid, 'order')]);
    assert.ok(finishes.some(r => r.status === 'fulfilled')); assert.equal(s.calls.approve, 1);
    assert.equal((await s.wallet()).purchased, 50); assert.equal((await s.wallet()).available, 50);
    const order = await s.manager.readOrder(s.uid, 'order'); assert.equal(order.checkout.approvalRequestedAt, NOW);
    assert.equal((await s.coordinator.complete(s.uid, 'order')).outcome, 'already_funded'); assert.equal(s.calls.approve, 1);
  });
});

test('Firestore persists approval uncertainty and recovers paid status without a second approval request', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await setup(ctx.firestore(), 'flow_lost_approval'); await s.coordinator.start(s.uid, 'order'); s.state.payStatus = 'PAY_APPROVED';
    const approve = s.provider.approvePayment;
    s.provider.approvePayment = async () => { await approve(); throw new Error('simulated lost response'); };
    await assert.rejects(s.coordinator.complete(s.uid, 'order'), /CHECKOUT_UNRESOLVED/);
    assert.equal((await s.manager.readOrder(s.uid, 'order')).checkout.state, 'uncertain');
    assert.equal(await s.wallet(), undefined);
    assert.equal((await s.coordinator.complete(s.uid, 'order')).outcome, 'funded');
    assert.equal(s.calls.approve, 1); assert.equal((await s.wallet()).available, 50);
  });
});

test('Firestore retains creation uncertainty and prevents a second provider payment after a lost create response', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const s = await setup(ctx.firestore(), 'flow_lost_create'), create = s.provider.createPayment;
    s.provider.createPayment = async value => { await create(value); throw new Error('simulated lost response'); };
    await assert.rejects(s.coordinator.start(s.uid, 'order'), /CHECKOUT_UNRESOLVED/);
    await assert.rejects(s.coordinator.start(s.uid, 'order'), /CHECKOUT_UNRESOLVED/);
    await assert.rejects(s.manager.cancelUnstartedOrder(s.uid, 'order'), /UNRESOLVED/);
    assert.equal(s.calls.create, 1); assert.equal(s.calls.approve, 0); assert.equal(await s.wallet(), undefined);
  });
});
