import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TRACKING_SA_RULES_ROOT||process.cwd(),require=createRequire(resolve(root,'cloud-functions/package.json'));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const {default:runtime}=await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-production-purchase.js')));
const {default:core}=await import(pathToFileURL(resolve(root,'cloud-functions/replay-coaching-credits.js')));
let app,db;
before(async()=>{app=initializeApp({projectId:'demo-trackingsa-ownership'},'production-purchase-demo');db=getFirestore(app);await db.doc('users/production_demo_owner').set({uid:'production_demo_owner'});});
after(async()=>{await db?.terminate();if(app)await deleteApp(app);});
test('Firestore sale receipt, concurrent approval and20-use fulfillment remain atomic and owned',async()=>{
 const NOW=Date.parse('2026-10-27T00:00:00Z'),orderId='production_demo_001',uid='production_demo_owner',counts={create:0,approve:0},payment={};
 const provider={mode:'LIVE',async createPayment(e){counts.create++;Object.assign(payment,e,{mode:'LIVE',payToken:'emulator_synthetic_token',payStatus:'PAY_STANDBY',refundableAmount:3300,transactions:[]});return{...e,mode:'LIVE',payToken:payment.payToken,checkoutPage:`https://pay.toss.im/payfront/auth?payToken=${payment.payToken}`};},async inspectPayment(){return structuredClone(payment);},async approvePayment(){counts.approve++;payment.payStatus='PAY_COMPLETE';payment.paidAt=NOW;payment.transactions=[{kind:'PAY',reference:'emulator_production_tx',amountKRW:3300}];}};
 const handler=runtime.createReplayProductionPurchaseHandler({db,provider,now:()=>NOW,env:{REPLAY_PURCHASE_ENABLED:'true',REPLAY_MERCHANT_APPROVED:'true',REPLAY_SALES_ENABLED:'true'},
  disclosureDocument:{purpose:'sale',version:'emulator_sale_only_v1',title:'로컬 합성 조건',text:'실제 판매 문서가 아닌 Emulator 시험용입니다.'},verifyToken:async token=>({uid:token,firebase:{sign_in_provider:'google.com'}})});
 const call=async body=>{const r={status:200},res={set(){return this;},status(v){r.status=v;return this;},json(v){r.body=v;return this;},send(v){r.body=v;return this;}};await handler({method:'POST',headers:{origin:'https://trackingsa.com',authorization:`Bearer ${uid}`,'content-type':'application/json'},rawBody:Buffer.from(JSON.stringify(body))},res);return r;};
 const p=(await call({action:'product'})).body.product,body={action:'create',orderId,termsVersion:p.termsVersion,acknowledgement:{accepted:true,version:p.disclosure.version,digest:p.disclosure.digest}};
 assert.ok((await Promise.all([call(body),call(body)])).every(r=>r.status===200));
 const saved=(await db.doc(core.orderRef(db,uid,orderId).path).get()).data();assert.equal(saved.acknowledgement.purpose,'sale');assert.equal(saved.acknowledgement.acceptedAt,NOW);
 const start=await Promise.all([call({action:'checkout',orderId}),call({action:'checkout',orderId})]);assert.ok(start.some(r=>r.status===200));assert.equal(counts.create,1);
 payment.payStatus='PAY_APPROVED';const end=await Promise.all([call({action:'complete',orderId}),call({action:'complete',orderId})]);assert.ok(end.some(r=>r.body.order?.status==='paid'));assert.equal(counts.approve,1);
 assert.equal((await call({action:'complete',orderId})).body.order.quantity,20);
 const wallet=(await db.doc(core.walletRef(db,uid).path).get()).data();assert.equal(wallet.purchased,20);assert.equal(wallet.available,20);
 assert.deepEqual((await db.doc(core.orderRef(db,uid,orderId).path).get()).data().acknowledgement,saved.acknowledgement);
});
