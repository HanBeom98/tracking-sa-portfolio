import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../../cloud-functions/replay-coaching-credits.js';
import ack from '../../cloud-functions/replay-coaching-acknowledgement.js';
import orders from '../../cloud-functions/replay-coaching-credit-orders.js';
import bindings from '../../cloud-functions/replay-coaching-tosspay-store.js';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { createReplayPurchaseSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-purchase-session.js';
import { validatePurchaseEnvelope } from '../../src/domains/stats/sudden-attack/replay/domain/replay-purchase-response.js';
import { validatePurchaseHistory } from '../../src/domains/stats/sudden-attack/replay/domain/replay-purchase-history-response.js';
const NOW=Date.parse('2026-10-27T00:00:00Z'),DAY=86400000,ID='ack_order_00000001';
const product={id:core.PRODUCT,quantity:50,amountKRW:3300,termsVersion:'preview_offer_v1',validDays:365};
function body(p=product,orderId=ID) {
  const d=ack.previewDisclosure(p);
  return {action:'create',orderId,termsVersion:p.termsVersion,acknowledgement:{accepted:true,version:d.version,digest:d.digest}};
}
function setup() {
  const db=coachingMemoryDb(),clock={value:NOW},payment={},calls={create:0,approve:0};
  for(const uid of ['alice','bob'])db.data.set(`users/${uid}`,{uid});
  const provider={mode:'LIVE',async createPayment(expected){calls.create++;Object.assign(payment,expected,{mode:'LIVE',payToken:'synthetic_ack_token',payStatus:'PAY_STANDBY',refundableAmount:expected.amountKRW,transactions:[]});
    return {...payment,checkoutPage:'https://pay.toss.im/payfront/auth?payToken=synthetic_ack_token'};},
    async inspectPayment(){return structuredClone(payment);},async approvePayment(){calls.approve++;payment.payStatus='PAY_COMPLETE';payment.paidAt=clock.value;
      payment.transactions=[{kind:'PAY',reference:'synthetic_ack_tx',amountKRW:payment.amountKRW}];}};
  const options={db,enabled:true,product,provider,checkoutEnabled:true,productDesc:'Local acknowledgement',now:()=>clock.value};
  const handlerFor=(p=product)=>service.createReplayPurchaseHandler({...options,product:p,verifyToken:async token=>{if(!['alice','bob'].includes(token))throw Error();return {uid:token};}});
  const callFor=(p=product)=>{const handler=handlerFor(p);return async (request,token='alice')=>{
    const result={status:200},res={set(){},status(v){result.status=v;return this;},json(v){result.body=v;return this;}};
    await handler({method:'POST',headers:{origin:'https://trackingsa.com',authorization:`Bearer ${token}`,'content-type':'application/json'},rawBody:Buffer.from(JSON.stringify(request))},res);return result;
  };};
  return {db,clock,payment,calls,options,callFor,call:callFor(),order:()=>db.data.get(core.orderRef(db,'alice',ID).path)};
}

test('new HTTP orders require explicit confirmation of the server disclosure; caller timestamps and text are rejected before writes',async()=>{
  const s=setup(),p=await s.call({action:'product'});assert.equal(p.status,200);assert.equal(s.db.transactions,0);
  assert.equal(p.body.product.disclosure.purpose,'preview');assert.match(p.body.product.disclosure.text,/실제 판매 전/);
  const valid=body();
  for(const acknowledgement of [undefined,null,false,{...valid.acknowledgement,accepted:false},{...valid.acknowledgement,acceptedAt:NOW-1},
    {...valid.acknowledgement,text:'caller text'},{...valid.acknowledgement,uid:'bob'}]) {
    const request={...valid,acknowledgement};if(acknowledgement===undefined)delete request.acknowledgement;
    const result=await s.call(request);assert.equal(result.status,400);assert.equal(s.db.transactions,0);
  }
  const changed=await s.call({...valid,acknowledgement:{...valid.acknowledgement,digest:'a'.repeat(64)}});
  assert.equal(changed.status,409);assert.equal(s.db.transactions,0);assert.deepEqual(s.calls,{create:0,approve:0});
});

test('the authenticated owner receives the exact document and server-created acknowledgement in the order transaction',async()=>{
  const s=setup(),result=await s.call(body());assert.equal(result.status,200);
  const receipt=s.order().acknowledgement;
  assert.equal(receipt.acceptedAt,NOW);assert.equal(receipt.acceptedAt,s.order().createdAt);assert.equal(receipt.purpose,'preview');
  assert.deepEqual(receipt,ack.acknowledgement(product,ack.previewDisclosure(product),NOW));
  core.validateOrder(s.order(),'alice',ID);validatePurchaseEnvelope(result.body,'create',ID);
  assert.doesNotMatch(JSON.stringify(result.body),/ownerHash|paymentHash|payToken|alice|bob/);
  assert.equal((await s.call({action:'get',orderId:ID},'bob')).status,404);
  assert.equal(s.db.data.has(core.walletRef(s.db,'alice').path),false);
});

test('concurrent creation, response loss and retries retain the first acceptance time/document without another order or reservation',async()=>{
  const s=setup();const results=await Promise.all([s.call(body()),s.call(body())]);
  assert.equal(results.filter(r=>!r.body.duplicate).length,1);const original=structuredClone(s.order()),before=structuredClone([...s.db.data]);
  s.clock.value+=DAY;const retry=await s.call(body());assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
  assert.deepEqual(s.order(),original);assert.deepEqual([...s.db.data],before);
});

test('price/quantity changes invalidate an old checkbox digest even if a developer forgets to bump the terms version',async()=>{
  const s=setup();
  for(const p of [{...product,amountKRW:3900},{...product,quantity:30},{...product,validDays:180}]) {
    const result=await s.callFor(p)(body());assert.equal(result.status,409);assert.deepEqual(result.body,{error:'ORDER_TERMS_CHANGED'});
  }
  assert.equal(s.db.transactions,0);
  await s.call(body());const original=structuredClone(s.order());
  const later=s.callFor({...product,amountKRW:3900,termsVersion:'preview_offer_v2'});
  const found=await later({action:'get',orderId:ID});assert.equal(found.status,200);
  assert.deepEqual(found.body.order.acknowledgement,original.acknowledgement);assert.equal(found.body.order.amountKRW,3300);
});

test('payment, relative expiry and refund reservations preserve the acknowledgement and bind its identity without duplicating text',async()=>{
  const s=setup();await s.call(body());const original=structuredClone(s.order().acknowledgement);
  assert.equal((await s.call({action:'checkout',orderId:ID})).status,200);s.payment.payStatus='PAY_APPROVED';s.clock.value+=DAY;
  assert.equal((await s.call({action:'complete',orderId:ID})).body.outcome,'funded');assert.equal(s.order().expiresAt,NOW+366*DAY);
  assert.deepEqual(s.order().acknowledgement,original);
  const manager=orders.createCreditOrderManager({...s.options,reserveCapacity:true});
  await manager.reserveRefund('alice',ID,'refund_ack',49);assert.deepEqual(s.order().acknowledgement,original);
  const store=bindings.createTossPayBindingStore({...s.options,mode:'LIVE'});
  const reserve=s.db.data.get(core.refundRef(s.db,'alice','refund_ack').path);
  assert.equal((await store.saveRefund('alice',ID,'refund_ack',reserve,'tosspay:synthetic_ack_tx')).amountKRW,3234);
  const privateOrder=s.db.data.get(bindings.childRef(s.db,'LIVE','alice','payments',ID).path).order;
  assert.deepEqual(privateOrder.acknowledgement,ack.identity(original));assert.equal(Object.hasOwn(privateOrder.acknowledgement,'text'),false);
  const h=await s.call({action:'history',cursor:null});validatePurchaseHistory(h.body);
  assert.deepEqual(h.body.orders[0].acknowledgement,ack.identity(original));assert.equal(h.body.orders[0].refundHeld,49);
});

test('damaged stored acknowledgement contents or timestamps fail closed, including independent private binding checks',async()=>{
  for(const change of [{text:'changed'},{purpose:'sale'},{digest:'b'.repeat(64)},{acceptedAt:NOW+1},{version:'other'}, {schemaVersion:2}]) {
    const s=setup();await s.call(body());Object.assign(s.order().acknowledgement,change);
    const result=await s.call({action:'get',orderId:ID});assert.equal(result.status,503);assert.deepEqual(result.body,{error:'CREDIT_STATE_INVALID'});
  }
  const s=setup();await s.call(body());
  const bound=s.db.data.get(bindings.childRef(s.db,'LIVE','alice','payments',ID).path);
  bound.order.acknowledgement.digest='c'.repeat(64);
  const store=bindings.createTossPayBindingStore({...s.options,mode:'LIVE'});
  await assert.rejects(store.saveOrder('alice',ID,s.order()),/ORDER_CONFLICT/);
});

test('legacy orders remain readable and an HTTP retry cannot backfill an acceptance that was never recorded',async()=>{
  const s=setup(),manager=orders.createCreditOrderManager({...s.options,reserveCapacity:true});await manager.createOrder('alice',ID);
  const before=structuredClone([...s.db.data]);const found=await s.call({action:'get',orderId:ID});
  assert.equal(found.status,200);assert.equal(Object.hasOwn(found.body.order,'acknowledgement'),false);
  assert.equal((await s.call(body())).status,409);assert.deepEqual([...s.db.data],before);
});

test('session clears an obsolete confirmation on a terms change and requires a fresh product read and checkbox',async()=>{
  const s=setup(),requests=[],pointers=new Map();let changed=false;
  const session=createReplayPurchaseSession({getUser:()=>({uid:'alice',getIdToken:async()=>'alice'}),uuid:()=>ID,
    readPointer:()=>null,writePointer:(uid,id)=>pointers.set(uid,id),clearPointer:uid=>pointers.delete(uid),send:async request=>{
      requests.push(request);return changed&&request.action==='create'?{status:409,body:{error:'ORDER_TERMS_CHANGED'}}:s.call(request);
    }});
  await session.request('product');session.accept(true);changed=true;await session.request('create');
  assert.equal(session.view().state,'terms_changed');assert.equal(session.view().accepted,false);assert.equal(session.view().product,null);
  await session.request('create');assert.equal(requests.length,2);changed=false;await session.request('product');
  assert.equal(session.view().canCreate,false);session.accept(true);await session.request('create');assert.equal(session.view().state,'order_created');
  assert.deepEqual(requests.at(-1).acknowledgement,body().acknowledgement);assert.equal(Object.hasOwn(requests.at(-1),'acceptedAt'),false);
});

test('a forged acknowledgement receipt in a create response is rejected and the real saved order can still be recovered',async()=>{
  const s=setup(),session=createReplayPurchaseSession({getUser:()=>({uid:'alice',getIdToken:async()=>'alice'}),uuid:()=>ID,
    readPointer:()=>null,writePointer(){},clearPointer(){},send:async request=>{
      const result=await s.call(request);if(request.action==='create')result.body.order.acknowledgement.digest='d'.repeat(64);return result;
    }});
  await session.request('product');session.accept(true);await session.request('create');
  assert.equal(session.view().state,'unknown');assert.equal(session.view().order,null);
  await session.request('get');assert.equal(session.view().state,'order_found');assert.equal(session.view().order.acknowledgement.digest,s.order().acknowledgement.digest);
});

test('receipt text is bounded and ten-row history only exposes small identities within existing transport limits',async()=>{
  const s=setup(),manager=orders.createCreditOrderManager({...s.options,reserveCapacity:false});
  for(let i=0;i<11;i++)await manager.createOrder('alice',`ack_history_${String(i).padStart(5,'0')}`,ack.previewDisclosure(product));
  const result=await s.call({action:'history',cursor:null});assert.equal(result.body.orders.length,10);validatePurchaseHistory(result.body);
  assert.ok(Buffer.byteLength(JSON.stringify(result.body))<16384);assert.ok(result.body.orders.every(o=>!Object.hasOwn(o.acknowledgement,'text')));
  const one=await s.call({action:'get',orderId:'ack_history_00000'});assert.ok(Buffer.byteLength(JSON.stringify(one.body))<4096);
  const bad=structuredClone(one.body);bad.order.acknowledgement.text='한'.repeat(500);
  assert.throws(()=>validatePurchaseEnvelope(bad,'get','ack_history_00000'),/INVALID_PURCHASE_RESPONSE/);
});
