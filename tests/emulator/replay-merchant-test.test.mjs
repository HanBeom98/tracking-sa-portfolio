import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const fixture = await import(pathToFileURL(resolve(root, 'tests/helpers/merchant-test-fixture.js')));
const { default: service } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-merchant-test.js')));
const { default: core } = await import(pathToFileURL(resolve(root, 'cloud-functions/replay-coaching-credits.js')));
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(process.env.TRACKING_SA_RULES_FILE || resolve(root, 'firestore.rules'), 'utf8') } }); });
after(async () => { await env?.cleanup(); });
async function setup(db, session) {
  await deleteDoc(doc(db, service.controlRef(db).path));
  const f = fixture.merchantFixture({ db });
  return { ...f, call: (action, options = {}) => f.call(action, { ...options, session }) };
}
test('Firestore merchant TEST concurrent create/approval fences persist without an operating wallet', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), session = 'd'.repeat(64), f = await setup(db, session);
    const creates = await Promise.all([f.call('create'), f.call('create')]); assert.ok(creates.every(r => r.status === 200));
    assert.equal((await getDoc(doc(db, service.controlRef(db).path))).data().total, 1);
    const starts = await Promise.all([f.call('checkout'), f.call('checkout')]); assert.ok(starts.some(r => r.status === 200)); assert.equal(f.counts.create, 1);
    f.payment().payStatus = 'PAY_APPROVED';
    const ends = await Promise.all([f.call('complete'), f.call('complete')]); assert.ok(ends.some(r => r.body.order?.state === 'confirmed')); assert.equal(f.counts.approve, 1);
    const uid = fixture.uidFor(session);
    assert.equal((await getDoc(doc(db, core.walletRef(db, uid).path))).exists(), false);
    assert.equal((await getDoc(doc(db, core.orderRef(db, uid, fixture.ORDER).path))).exists(), false);
    assert.equal((await f.call('get')).body.operationalCreditsGranted, false);
    assert.equal((await fixture.merchantFixture({ db }).call('get', { session: 'e'.repeat(64) })).status, 404);
  });
});
test('Firestore merchant TEST lost approval recovers without reapproval; browser roles cannot read or write private records', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), session = 'f'.repeat(64), f = await setup(db, session);
    await f.call('create'); await f.call('checkout'); f.payment().payStatus = 'PAY_APPROVED'; const approve = f.provider.approvePayment;
    f.provider.approvePayment = async p => { await approve(p); throw Error('lost response'); };
    assert.equal((await f.call('complete')).status, 409); assert.equal((await f.call('complete')).body.order.state, 'confirmed'); assert.equal(f.counts.approve, 1);
    const uid = fixture.uidFor(session), path = service.orderRef(db, uid, fixture.ORDER).path;
    const clients = [env.unauthenticatedContext().firestore(), env.authenticatedContext(uid).firestore(),
      env.authenticatedContext('merchant-admin', { email: 'demo-9249b6f9@example.com' }).firestore()];
    for (const client of clients) for (const p of [path, service.controlRef(db).path]) {
      await assertFails(getDoc(doc(client, p))); await assertFails(setDoc(doc(client, p), { state: 'confirmed' }));
    }
  });
});

test('Firestore merchant TEST cancellation persists as a terminal state with no approval or operating order', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore(),session='9'.repeat(64),f=await setup(db,session);
    await f.call('create'); await f.call('checkout'); Object.assign(f.payment(),{payStatus:'PAY_CANCEL',amountKRW:0,refundableAmount:0});
    const checks=await Promise.all([f.call('get'),f.call('complete')]); assert.ok(checks.every(r=>r.body.order?.state==='cancelled'));
    assert.equal(f.counts.approve,0); assert.equal((await f.call('checkout')).body.checkoutPage,undefined);
    const uid=fixture.uidFor(session),record=(await getDoc(doc(db,service.orderRef(db,uid,fixture.ORDER).path))).data();
    assert.equal(record.state,'cancelled'); assert.equal(record.confirmedAt,null); assert.equal(record.demoExpiresAt,null);
    assert.equal((await getDoc(doc(db,core.walletRef(db,uid).path))).exists(),false);
    assert.equal((await getDoc(doc(db,core.orderRef(db,uid,fixture.ORDER).path))).exists(),false);
  });
});
