import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { collection, getDocs } from 'firebase/firestore';
const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const require = createRequire(resolve(root,'cloud-functions/package.json'));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { default: core } = await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-credits.js')));
const { default: history } = await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-purchase-history.js')));
const { default: ack } = await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-acknowledgement.js')));
const { default: service } = await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-purchase-service.js')));
const { creditFixtureEntries } = await import(pathToFileURL(resolve(root,'tests/helpers/coaching-credit-fixture.js')));
const NOW=Date.parse('2026-10-26T00:00:00Z');
let app,db,env;
before(async()=>{
  // Never fall through to ADC/production Firestore if launched without CLI.
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8085');
  app=initializeApp({projectId:'demo-trackingsa-ownership'},'history-readonly-emulator'); db=getFirestore(app);
  env=await initializeTestEnvironment({projectId:'demo-trackingsa-ownership',firestore:{host:'127.0.0.1',port:8085,rules:readFileSync(resolve(root,'firestore.rules'),'utf8')}});
});
after(async()=>{await env?.cleanup();await db?.terminate();if(app)await deleteApp(app);});
async function seed(uid,count=1) {
  const wallet=core.emptyWallet(uid),batch=db.batch();
  for(let i=0;i<count;i++) {
    const orderId=`history_${String(i).padStart(2,'0')}`;
    const [, , [,o]]=creditFixtureEntries(uid,{quantity:50,now:NOW,orderId});
    batch.set(core.orderRef(db,uid,orderId),o);
    wallet.purchased+=50;wallet.available+=50;wallet.lots.push({orderId,remaining:50,held:0,refundHeld:0,expiresAt:null});
  }
  batch.set(core.walletRef(db,uid),wallet);await batch.commit();return wallet;
}
const read=uid=>history.createPurchaseHistoryReader({db,enabled:true,now:()=>NOW})(uid);

test('Firestore HTTP creation atomically records the confirmed document once and preserves it across later retries',async()=>{
  const uid='history_ack_owner',orderId='emulator_ack_order01',clock={value:NOW};
  await db.collection('users').doc(uid).set({uid});
  const product={id:core.PRODUCT,quantity:50,amountKRW:3300,termsVersion:'emulator_ack_v1',validDays:365},d=ack.previewDisclosure(product);
  const handler=service.createReplayPurchaseHandler({db,enabled:true,product,now:()=>clock.value,verifyToken:async token=>({uid:token})});
  const request={action:'create',orderId,termsVersion:product.termsVersion,acknowledgement:{accepted:true,version:d.version,digest:d.digest}};
  const call=async(body,token=uid)=>{
    const result={status:200},res={set(){},status(v){result.status=v;return this;},json(v){result.body=v;return this;}};
    await handler({method:'POST',headers:{origin:'https://trackingsa.com',authorization:`Bearer ${token}`,'content-type':'application/json'},rawBody:Buffer.from(JSON.stringify(body))},res);return result;
  };
  const created=await Promise.all([call(request),call(request)]);assert.ok(created.every(r=>r.status===200));
  assert.equal(created.filter(r=>!r.body.duplicate).length,1);
  const ref=core.orderRef(db,uid,orderId),saved=(await ref.get()).data();
  assert.equal(saved.acknowledgement.acceptedAt,NOW);assert.equal(saved.acknowledgement.digest,d.digest);
  clock.value+=86400000;assert.equal((await call(request)).body.duplicate,true);assert.deepEqual((await ref.get()).data(),saved);
  assert.equal((await call({action:'get',orderId},'history_ack_other')).status,404);
  const h=await history.createPurchaseHistoryReader({db,enabled:true,now:()=>clock.value})(uid);
  assert.deepEqual(h.orders[0].acknowledgement,ack.identity(saved.acknowledgement));
  assert.equal(Object.hasOwn(h.orders[0].acknowledgement,'text'),false);
  assert.equal((await core.walletRef(db,uid).get()).exists,false);
});

test('Admin Firestore read-only query paginates same-time orders without a new composite index or owner leakage',async()=>{
  const uid='history_pages';await seed(uid,13);await seed('history_other',1);
  const reader=history.createPurchaseHistoryReader({db,enabled:true,now:()=>NOW});
  const first=await reader(uid),second=await reader(uid,first.nextCursor);
  assert.equal(first.orders.length,10);assert.equal(first.orders[0].orderId,'history_12');
  assert.deepEqual(second.orders.map(o=>o.orderId),['history_02','history_01','history_00']);assert.equal(second.nextCursor,null);
  assert.equal(first.account.purchased,650);assert.equal(second.account.purchased,650);
  assert.equal(new Set([...first.orders,...second.orders].map(o=>o.orderId)).size,13);
  assert.doesNotMatch(JSON.stringify(first),/ownerHash|paymentHash|payToken|history_other/);
  assert.equal((await read('history_empty')).orders.length,0);
});

test('a concurrent usage commit never mixes old order counts with a new wallet balance',async()=>{
  const uid='history_snapshot',wallet=await seed(uid);
  const ref=core.orderRef(db,uid,'history_00'),order=(await ref.get()).data();
  order.remaining--;order.used++;wallet.available--;wallet.used++;wallet.lots[0].remaining--;
  const batch=db.batch();batch.set(ref,order);batch.set(core.walletRef(db,uid),wallet);
  const [result]=await Promise.all([read(uid),batch.commit()]);
  assert.equal(result.account.remaining,result.orders[0].remaining);assert.equal(result.account.used,result.orders[0].used);
  assert.ok([49,50].includes(result.account.remaining));
  const after=await read(uid);assert.equal(after.account.remaining,49);assert.equal(after.orders[0].used,1);
});

test('expired relative orders remain visible while unused expired units are not usable or deleted',async()=>{
  const uid='history_expired';await seed(uid);
  const ref=core.orderRef(db,uid,'history_00'),order=(await ref.get()).data(),wallet=(await core.walletRef(db,uid).get()).data();
  Object.assign(order,{createdAt:NOW-366*86400000,paidAt:NOW-365*86400000,validDays:365,expiresAt:NOW});wallet.lots[0].expiresAt=NOW;
  const batch=db.batch();batch.set(ref,order);batch.set(core.walletRef(db,uid),wallet);await batch.commit();
  const result=await read(uid);assert.equal(result.account.remaining,0);assert.equal(result.account.expired,50);
  assert.equal(result.orders[0].expired,50);assert.equal(result.orders[0].expiresAt,NOW);
  assert.deepEqual((await ref.get()).data(),order);assert.deepEqual((await core.walletRef(db,uid).get()).data(),wallet);
});

test('anonymous, owner, other owner and site-admin clients cannot query the private purchase collection directly',async()=>{
  const uid='history_rules';await seed(uid);
  for(const context of [env.unauthenticatedContext(),env.authenticatedContext(uid),env.authenticatedContext('other'),
    env.authenticatedContext('site-admin',{email:'demo-15b9ce4f@example.com'})]) {
    await assertFails(getDocs(collection(context.firestore(),`${core.walletRef(db,uid).path}/orders`)));
  }
  assert.equal((await read(uid)).orders.length,1);
});
