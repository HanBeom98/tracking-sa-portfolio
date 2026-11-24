import test from 'node:test';
import assert from 'node:assert/strict';
import runtime from '../../cloud-functions/replay-coaching-production-purchase.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { onRequest } from '../../functions/api/replay-coaching-purchase.js';
import { createReplayPurchaseClient } from '../../src/domains/stats/sudden-attack/replay/infra/replay-purchase-client.js';
const NOW = Date.parse('2026-10-27T00:00:00Z'), ID = 'operational_order_01';
const env = { REPLAY_PURCHASE_ENABLED: 'true', REPLAY_MERCHANT_APPROVED: 'true', REPLAY_SALES_ENABLED: 'true' };
const document = { purpose: 'sale', version: 'synthetic_sale_only_v1', title: '합성 판매 조건', text: '테스트 내부 조건입니다. 실제 판매 문서가 아닙니다. 20회/3300원/365일.' };
function setup(extra = {}) {
  const db = coachingMemoryDb(), counts = { create: 0, inspect: 0, approve: 0, auth: 0 }, payment = {};
  db.data.set('users/alice', { uid: 'alice' }); db.data.set('users/bob', { uid: 'bob' });
  const provider = { mode: 'LIVE', async createPayment(expected) { counts.create++;
    Object.assign(payment, expected, { mode: 'LIVE', payToken: 'synthetic_production_only', payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [] });
    return { ...expected, mode: 'LIVE', payToken: payment.payToken, checkoutPage: `https://pay.toss.im/payfront/auth?payToken=${payment.payToken}` }; },
    async inspectPayment() { counts.inspect++; return structuredClone(payment); },
    async approvePayment() { counts.approve++; payment.payStatus = 'PAY_COMPLETE'; payment.paidAt = NOW; payment.transactions = [{ kind: 'PAY', reference: 'synthetic_paid_transaction', amountKRW: 3300 }]; } };
  const options = { db, provider, env, disclosureDocument: document, now: () => NOW,
    verifyToken: async token => { counts.auth++; if (!['alice','bob'].includes(token)) throw Error('invalid'); return { uid: token, firebase: { sign_in_provider: 'google.com' } }; }, ...extra };
  const handler = runtime.createReplayProductionPurchaseHandler(options);
  const call = async (body, uid = 'alice', selected = handler) => {
    const result = { status: 200, headers: {} }, res = { set(k,v) { result.headers[k] = v; return this; }, status(v) { result.status = v; return this; }, json(body) { result.body = body; return this; }, send(body) { result.body = body; return this; } };
    await selected({ method: 'POST', headers: { authorization: `Bearer ${uid}`, origin: 'https://trackingsa.com', 'content-type': 'application/json' }, rawBody: Buffer.from(JSON.stringify(body)) }, res); return result;
  };
  const prepare = async () => { const response = await call({ action: 'product' }); assert.equal(response.status, 200); const p = response.body.product;
    const response2 = await call({ action: 'create', orderId: ID, termsVersion: p.termsVersion, acknowledgement: { accepted: true, version: p.disclosure.version, digest: p.disclosure.digest } }); assert.equal(response2.status,200); return response2; };
  return { db, counts, payment, provider, options, handler, call, prepare };
}
test('production is closed before auth/DB/provider unless all release dependencies are explicitly wired', async () => {
  for (const extra of [{ env: {} }, { env: { ...env, REPLAY_MERCHANT_APPROVED: 'false' } }, { disclosureDocument: null },
    { disclosureDocument: { ...document, purpose: 'preview' } }, { provider: { mode: 'TEST' } }, { provider: undefined }]) {
    const s=setup(extra); assert.equal((await s.call({action:'product'})).status,503); assert.equal(s.db.transactions,0); assert.equal(s.counts.auth,0); assert.equal(s.counts.create,0);
  }
});
test('verified sale conditions bind the new 20-use order; stale digest or client text/price never creates it', async () => {
  const s=setup(), p=(await s.call({action:'product'})).body.product;
  assert.equal(p.quantity,20); assert.equal(p.amountKRW,3300); assert.equal(p.disclosure.purpose,'sale');
  for (const body of [
    {action:'create',orderId:ID,termsVersion:p.termsVersion,acknowledgement:{accepted:true,version:p.disclosure.version,digest:'f'.repeat(64)}},
    {action:'create',orderId:ID,termsVersion:p.termsVersion,acknowledgement:{accepted:true,version:p.disclosure.version,digest:p.disclosure.digest,text:'forged'}}]) assert.ok((await s.call(body)).status>=400);
  assert.equal(s.db.transactions,0); const r=await s.prepare(); const receipt=r.body.order.acknowledgement;
  assert.equal(receipt.purpose,'sale'); assert.equal(receipt.text,document.text); assert.equal(receipt.acceptedAt,NOW);
  assert.equal((await s.call({action:'get',orderId:ID},'bob')).status,404);
});
test('real handler composition confirms one owned payment and funds exactly20 credits with payment-relative expiry', async () => {
  const s=setup(); await s.prepare(); assert.equal((await s.call({action:'checkout',orderId:ID})).status,200);
  assert.equal((await s.call({action:'checkout',orderId:ID})).status,200); assert.equal(s.counts.create,1);
  s.payment.payStatus='PAY_APPROVED'; const r=await s.call({action:'complete',orderId:ID}); assert.equal(r.status,200);
  assert.equal(r.body.order.status,'paid'); assert.equal(r.body.order.quantity,20); assert.equal(r.body.order.paidAt,NOW); assert.equal(r.body.order.expiresAt,NOW+365*86400000);
  await s.call({action:'complete',orderId:ID}); assert.equal(s.counts.approve,1);
  assert.equal(s.db.data.get(credits.walletRef(s.db,'alice').path).available,20);
  const h=await s.call({action:'history',cursor:null}); assert.equal(h.status,200); assert.equal(h.body.orders.length,1); assert.equal(h.body.orders[0].quantity,20);
});
test('pausing new sales preserves completion of previously started payments and old receipts', async () => {
  const s=setup(); await s.prepare(); await s.call({action:'checkout',orderId:ID}); s.payment.payStatus='PAY_APPROVED';
  const paused=runtime.createReplayProductionPurchaseHandler({...s.options,env:{...env,REPLAY_SALES_ENABLED:'false'}});
  const product=await s.call({action:'product'},'alice',paused); assert.equal(product.status,200); assert.equal(product.body.paymentEnabled,false);
  assert.equal((await s.call({action:'checkout',orderId:ID},'alice',paused)).status,503);
  assert.equal((await s.call({action:'complete',orderId:ID},'alice',paused)).body.order.status,'paid'); assert.equal(s.counts.approve,1);
});
test('preview acknowledgement or TEST status cannot produce operational credits', async () => {
  const s=setup(); const old=orders.createCreditOrderManager({db:s.db,enabled:true,product:{...runtime.PRODUCT,expiresAt:null},reserveCapacity:true,now:()=>NOW});
  await old.createOrder('alice',ID);
  assert.equal((await s.call({action:'checkout',orderId:ID})).body.error,'ORDER_TERMS_CHANGED'); assert.equal(s.counts.create,0);
  const t=setup();await t.prepare();await t.call({action:'checkout',orderId:ID});t.payment.mode='TEST';t.payment.payStatus='PAY_COMPLETE';
  assert.equal((await t.call({action:'complete',orderId:ID})).status,409); assert.equal(t.db.data.has(credits.walletRef(t.db,'alice').path),false);
});
test('lost approval response recovers using the same payment without another provider write', async () => {
  const s=setup(), approve=s.provider.approvePayment; await s.prepare(); await s.call({action:'checkout',orderId:ID});s.payment.payStatus='PAY_APPROVED';
  s.provider.approvePayment=async()=>{await approve();throw Error('lost');};assert.equal((await s.call({action:'complete',orderId:ID})).status,409);
  assert.equal((await s.call({action:'complete',orderId:ID})).body.order.status,'paid');assert.equal(s.counts.approve,1);assert.equal(s.db.data.get(credits.walletRef(s.db,'alice').path).available,20);
});
test('production proxy is off by default, pins upstream and rejects redirects/raw errors without retries', async () => {
  const request=()=>new Request('https://trackingsa.com/api/replay-coaching-purchase',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({action:'product'})});
  let calls=0;assert.equal((await onRequest({request:request(),env:{}},async()=>{calls++;})).status,503);assert.equal(calls,0);
  const r=await onRequest({request:request(),env},async(url,options)=>{calls++;assert.equal(url,'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchase');assert.equal(options.headers.Authorization,'Bearer alice');assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://evil.example'}});});assert.equal(r.status,503);assert.equal(calls,1);
  const bad=await onRequest({request:request(),env},async()=>Response.json({error:'private-key-or-contact'},{status:503}));assert.equal((await bad.json()).error,'PURCHASE_UNAVAILABLE');
});
test('production transport is fixed to the owned origin and never accepts an endpoint from query/user body', async () => {
  let calls=0;const send=createReplayPurchaseClient({origin:'https://trackingsa.com',fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://trackingsa.com/api/replay-coaching-purchase');assert.equal(options.credentials,'omit');return Response.json({product:{}});}});
  assert.equal((await send({action:'product'},'alice')).status,200);assert.equal(calls,1);
  await assert.rejects(createReplayPurchaseClient({origin:'https://evil.example'})({action:'product'},'alice'),/DISABLED/);
});
