import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../cloud-functions/replay-coaching-credits.js';
import history from '../../cloud-functions/replay-coaching-purchase-history.js';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { creditFixtureEntries, creditRuntime } from '../helpers/coaching-credit-fixture.js';
import { validatePurchaseHistory } from '../../src/domains/stats/sudden-attack/replay/domain/replay-purchase-history-response.js';
import { createReplayPurchaseHistorySession } from '../../src/domains/stats/sudden-attack/replay/application/replay-purchase-history-session.js';
import { createLocalReplayPurchaseClient } from '../../src/domains/stats/sudden-attack/replay/infra/replay-purchase-client.js';
const NOW = Date.parse('2026-10-26T00:00:00Z'), DAY = 86400000;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function seed(db, uid, orderId, changes = {}) {
  const [, , entry] = creditFixtureEntries(uid, { quantity: 50, now: NOW, orderId });
  const o = { ...entry[1], ...changes };
  o.remaining = o.status === 'paid' ? o.quantity - o.used - o.held - o.refundHeld - o.refunded : 0;
  core.validateOrder(o, uid, orderId); db.data.set(core.orderRef(db, uid, orderId).path, o);
  if (o.status === 'paid') {
    const ref = core.walletRef(db, uid), w = db.data.get(ref.path) || core.emptyWallet(uid);
    w.purchased += o.quantity; w.used += o.used; w.available += o.remaining; w.refundHeld += o.refundHeld; w.refunded += o.refunded;
    if (o.remaining + o.refundHeld) w.lots.push({ orderId, remaining: o.remaining, held: 0, refundHeld: o.refundHeld, expiresAt: o.expiresAt });
    core.validateWallet(w, uid); db.data.set(ref.path, w);
  }
  return o;
}
const reader = db => history.createPurchaseHistoryReader({ db, enabled: true, now: () => NOW });
function http(db, extra = {}) {
  const handler = service.createReplayPurchaseHandler({ db, enabled: true, now: () => NOW,
    verifyToken: async t => { if (!['alice', 'bob'].includes(t)) throw Error(); return { uid: t }; }, ...extra });
  return async (body, token = 'alice') => {
    const res = { statusCode: 200, headers: {}, set(k,v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
    await handler({ method: 'POST', headers: { origin: 'https://trackingsa.com', authorization: `Bearer ${token}`, 'content-type': 'application/json' }, rawBody: Buffer.from(JSON.stringify(body)) }, res);
    return res;
  };
}

test('history is disabled by default, cursor input is bounded before DB access and empty reads create no records', async () => {
  const db = coachingMemoryDb();
  await assert.rejects(history.createPurchaseHistoryReader({ db })('alice'), /DISABLED/);
  for (const cursor of [{}, [], {createdAt: NOW, orderId: '../bob'}, {createdAt:-1,orderId:'a'}, {createdAt:NOW,orderId:'a',uid:'bob'}]) {
    await assert.rejects(reader(db)('alice', cursor), /INVALID_REQUEST/);
  }
  assert.equal(db.transactions, 0);
  const result = await reader(db)('alice');
  assert.equal(result.orders.length, 0); assert.equal(result.account.purchased, 0); assert.equal(result.nextCursor, null);
  assert.deepEqual(validatePurchaseHistory(result), result); assert.equal(db.data.size, 0);
  assert.deepEqual(db.optionsSeen.at(-1), {readOnly:true}); assert.equal(db.reads.at(-1).limit, 11);
});

test('history separates usable, expired, used and refund-held units and exposes only the owner summary', async () => {
  const db = coachingMemoryDb();
  seed(db,'alice','expired_order',{createdAt:NOW-366*DAY,paidAt:NOW-365*DAY,validDays:365,expiresAt:NOW,used:10});
  seed(db,'alice','active_order',{expiresAt:NOW+DAY,used:7,refundHeld:3,refunded:4});
  seed(db,'alice','pending_order',{status:'pending',paymentHash:null,paidAt:null});
  seed(db,'bob','other_owner_order');
  const before = structuredClone([...db.data]), result = await reader(db)('alice');
  assert.deepEqual(result.account,{status:'active',purchased:100,remaining:36,expired:40,held:0,used:17,refundHeld:3,refunded:4});
  assert.equal(result.orders.length,3); assert.equal(result.orders.find(o=>o.orderId==='expired_order').remaining,0);
  assert.equal(result.orders.find(o=>o.orderId==='expired_order').expired,40);
  assert.equal(result.orders.find(o=>o.orderId==='pending_order').paidAt,null);
  assert.doesNotMatch(JSON.stringify(result),/ownerHash|paymentHash|payToken|lease|other_owner_order|alice|bob/);
  assert.deepEqual(validatePurchaseHistory(result), result); assert.deepEqual([...db.data],before);
});

test('a real analysis reservation and unused refund lock are displayed without consuming or releasing either', async () => {
  const s = creditRuntime({quantity:50});
  const manager = orders.createCreditOrderManager({ db:s.db,enabled:true,now:()=>NOW });
  await manager.reserveRefund('alice','fixture_order','history_refund',3);
  const {request:input} = preflight.buildCoachingRequest(s.evidence), quote = cost.makeCostQuote(1000,input,NOW);
  await core.reserveCredit(s.db,'alice','202610-history_reserved_request',core.hash('history'),quote,s.options.config,NOW);
  const before = structuredClone([...s.db.data]), result = await reader(s.db)('alice');
  assert.equal(result.account.remaining,46); assert.equal(result.account.held,1); assert.equal(result.account.refundHeld,3);
  assert.equal(result.orders[0].held,1); assert.equal(result.orders[0].refundHeld,3);
  assert.deepEqual(validatePurchaseHistory(result),result); assert.deepEqual([...s.db.data],before);
});

test('ten-row cursor pages use a stable timestamp/ID tie-breaker, bounded queries and no offset or history writes', async () => {
  const db = coachingMemoryDb();
  for (let i=0;i<13;i++) seed(db,'alice',`history_${String(i).padStart(2,'0')}`);
  const read = reader(db), first = await read('alice');
  assert.equal(first.orders.length,10); assert.equal(first.orders[0].orderId,'history_12');
  assert.deepEqual(first.nextCursor,{createdAt:NOW-1000,orderId:'history_03'});
  seed(db,'alice','newer_order',{createdAt:NOW-100,paidAt:NOW-50});
  const second = await read('alice',first.nextCursor);
  assert.deepEqual(second.orders.map(o=>o.orderId),['history_02','history_01','history_00']); assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.orders,...second.orders].map(o=>o.orderId)).size,13);
  assert.equal((await read('alice')).orders[0].orderId,'newer_order');
  for (const result of [first,second]) validatePurchaseHistory(result);
  assert.ok(db.reads.every(q=>q.limit===11 && !q.collection.includes('bob')));
  assert.ok(db.optionsSeen.every(o=>o?.readOnly===true));
});

test('authenticated HTTP history rejects owner/price/limit injection and works while checkout remains off', async () => {
  const db = coachingMemoryDb(); seed(db,'alice','private_order'); const call = http(db);
  for (const body of [{action:'history'}, {action:'history',cursor:null,uid:'bob'}, {action:'history',cursor:null,limit:999}, {action:'history',cursor:null,amountKRW:1}]) {
    const before = db.transactions, r = await call(body); assert.equal(r.statusCode,400); assert.equal(db.transactions,before);
  }
  assert.equal((await call({action:'history',cursor:null},'bad')).statusCode,401);
  const own = await call({action:'history',cursor:null}), other = await call({action:'history',cursor:null},'bob');
  assert.equal(own.statusCode,200); assert.equal(own.body.orders[0].orderId,'private_order'); assert.equal(other.body.orders.length,0);
  assert.equal(own.headers['Cache-Control'],'no-store'); assert.equal(own.headers.Vary,'Origin');
});

test('corrupt owner/order/wallet relationships fail without returning partial purchase records', async () => {
  for (const corrupt of ['owner','expiry','wallet']) {
    const db = coachingMemoryDb(); const o = seed(db,'alice','private_order',{expiresAt:NOW+DAY});
    if (corrupt==='owner') o.ownerHash = core.owner('bob');
    else if (corrupt==='expiry') o.expiresAt += DAY;
    else db.data.delete(core.walletRef(db,'alice').path);
    const result = await http(db)({action:'history',cursor:null});
    assert.equal(result.statusCode,503); assert.deepEqual(result.body,{error:'CREDIT_STATE_INVALID'});
  }
});

test('history response validation rejects forged counts, bad expiry, duplicated rows, raw secrets and forged cursor', async () => {
  const db = coachingMemoryDb(); seed(db,'alice','private_order',{expiresAt:NOW+DAY});
  const clean = await reader(db)('alice');
  for (const mutate of [v=>{v.account.remaining++;}, v=>{v.account.status='admin';}, v=>{v.orders[0].expired=1;},
    v=>{v.orders[0].remaining=-1;},v=>{v.orders.push(v.orders[0]);},v=>{v.orders[0].payToken='secret';},
    v=>{v.nextCursor={createdAt:NOW,orderId:'other'};},v=>{v.orders[0].orderId='<script>';},
    v=>{v.orders[0].validDays=365;},v=>{v.orders=Array(11).fill(v.orders[0]);}]) {
    const bad = structuredClone(clean); mutate(bad); assert.throws(()=>validatePurchaseHistory(bad),/INVALID_PURCHASE_HISTORY/);
  }
});

test('history session never auto-queries, ignores duplicate clicks and discards delayed results across account changes', async () => {
  const db = coachingMemoryDb(); seed(db,'alice','private_order');
  const wait = deferred(), auth = {user:{uid:'alice',getIdToken:async()=>'alice'}}, calls=[];
  const session = createReplayPurchaseHistorySession({getUser:()=>auth.user,send:async body=>{calls.push(body);await wait.promise;return {status:200,body:await reader(db)('alice')};}});
  assert.equal(calls.length,0); const pending = session.request(); await session.request();
  await Promise.resolve(); assert.equal(calls.length,1); assert.deepEqual(calls[0],{action:'history',cursor:null});
  auth.user={uid:'bob',getIdToken:async()=>'bob'};session.authChanged(); wait.resolve();await pending;
  assert.equal(session.view().data,null);assert.equal(session.view().state,'idle');
  auth.user=null;session.authChanged();assert.equal(session.view().state,'signed_out'); await session.request();assert.equal(calls.length,1);
});

test('session pages explicitly, rejects non-advancing pages and clears data after failed reads or disposal', async () => {
  const db = coachingMemoryDb(); for(let i=0;i<12;i++)seed(db,'alice',`history_${String(i).padStart(2,'0')}`);
  const first = await reader(db)('alice'); let duplicate=false,failed=false,calls=0;
  const session=createReplayPurchaseHistorySession({getUser:()=>({uid:'alice',getIdToken:async()=>'alice'}),send:async body=>{
    calls++;return failed?{status:503,body:{error:'PURCHASE_UNAVAILABLE'}}:{status:200,body:duplicate?first:await reader(db)('alice',body.cursor)};
  }});
  await session.request();assert.equal(session.view().data.orders.length,10);assert.equal(session.view().canNext,true);
  await session.request('next');assert.equal(session.view().data.orders.length,2);assert.equal(session.view().canNext,false);
  await session.request('next');assert.equal(calls,2); await session.request();duplicate=true;
  await session.request('next');assert.equal(session.view().state,'error');assert.equal(session.view().data,null);
  duplicate=false;failed=true;await session.request();assert.equal(session.view().data,null);assert.equal(session.view().canRefresh,true);
  session.dispose();await session.request();assert.equal(calls,5);
});

test('delayed token retrieval cannot send an old-account read after identity mutation or disposal', async () => {
  for (const mode of ['identity','dispose']) {
    const token=deferred(),user={uid:'alice',getIdToken:()=>token.promise};let calls=0;
    const session=createReplayPurchaseHistorySession({getUser:()=>user,send:async()=>{calls++;throw Error('must not send');}});
    const pending=session.request();
    if(mode==='identity')user.uid='bob';else session.dispose();
    token.resolve('alice');await pending;assert.equal(calls,0);assert.equal(session.view().data,null);
  }
});

test('transport keeps ordinary responses at 4KiB and history at 16KiB, including streamed bodies without a length header', async () => {
  for (const [action,size,ok] of [['history',8000,true],['product',8000,false],['history',17000,false]]) {
    const send=createLocalReplayPurchaseClient({origin:'http://127.0.0.1:4173',fetchImpl:async()=>new Response(JSON.stringify({data:'x'.repeat(size)}),{headers:{'content-type':'application/json'}})});
    if(ok)assert.equal((await send({action,cursor:null},'alice')).status,200);
    else await assert.rejects(send({action,cursor:null},'alice'),/CONNECTION_UNKNOWN/);
  }
});
