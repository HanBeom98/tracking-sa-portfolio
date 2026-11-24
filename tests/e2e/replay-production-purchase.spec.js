import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import runtime from '../../cloud-functions/replay-coaching-production-purchase.js';
import core from '../../cloud-functions/replay-coaching-credits.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { onRequest } from '../../functions/api/replay-coaching-purchase.js';
const PAGE='/ai-replay-pass/',NOW=Date.parse('2026-10-27T00:00:00Z');
const document={purpose:'sale',version:'browser_synthetic_sale_v1',title:'로컬 합성 판매 조건',text:'운영 연결 시험용 조건입니다. 실제 결제·서비스 판매 문서가 아닙니다. 20회/3300원/365일.'};
test.beforeEach(async({context})=>{await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());});
async function setup({page,context},{enabled=true,lost,initial='alice',mode='LIVE'}={}){
 await context.addInitScript(({initial})=>{let uid=initial;const listeners=new Set(),user=()=>uid?{uid,getIdToken:async()=>uid}:null;window.productionLoginCalls=0;
  const gateway={getCurrentUser:user,waitForReady:async()=>{},requireAuth:async()=>{window.productionLoginCalls++;return user();},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
  Object.defineProperty(window,'AuthGateway',{configurable:true,get:()=>gateway,set:()=>{}});window.setProductionUser=value=>{uid=value;for(const fn of listeners)fn({user:user()});};
 },{initial});
 const html=await readFile(new URL('../../public/ai-replay-pass/index.html',import.meta.url),'utf8');
 await context.route('**/ai-replay-pass/**',r=>new URL(r.request().url()).pathname===PAGE?r.fulfill({contentType:'text/html',body:mode==='LIVE'?html.replace('data-purchase-mode="TEST"','data-purchase-mode="LIVE"'):html}):r.continue());
 const db=coachingMemoryDb(),counts={create:0,approve:0,inspect:0},payment={},calls=[];
 for(const uid of ['alice','bob'])db.data.set(`users/${uid}`,{uid});
 const provider={mode:'LIVE',async createPayment(e){counts.create++;Object.assign(payment,e,{mode:'LIVE',payToken:'browser_production_synthetic',payStatus:'PAY_STANDBY',refundableAmount:3300,transactions:[]});return{...e,mode:'LIVE',payToken:payment.payToken,checkoutPage:`https://pay.toss.im/payfront/auth?payToken=${payment.payToken}`};},
  async inspectPayment(){counts.inspect++;return structuredClone(payment);},async approvePayment(){counts.approve++;payment.payStatus='PAY_COMPLETE';payment.paidAt=NOW;payment.transactions=[{kind:'PAY',reference:'browser_production_tx',amountKRW:3300}];}};
 const env=enabled?{REPLAY_PURCHASE_ENABLED:'true',REPLAY_MERCHANT_APPROVED:'true',REPLAY_SALES_ENABLED:'true'}:{};
 const handler=runtime.createReplayProductionPurchaseHandler({db,provider,env,disclosureDocument:document,now:()=>NOW,verifyToken:async token=>({uid:token,firebase:{sign_in_provider:'google.com'}})});
 let dropped=false;
 await context.route('**/api/replay-coaching-purchase',async route=>{const r=route.request(),body=r.postDataJSON();calls.push(body.action);
  const response=await onRequest({request:new Request('https://trackingsa.com/api/replay-coaching-purchase',{method:'POST',headers:{...r.headers(),origin:'https://trackingsa.com'},body:r.postData()}),env},async(_url,o)=>{
   const result={status:200},res={set(){return this;},status(s){result.status=s;return this;},json(v){result.body=v;return this;},send(v){result.body=v;return this;}};
   await handler({method:'POST',headers:{authorization:o.headers.Authorization,'content-type':'application/json',origin:'https://trackingsa.com'},rawBody:Buffer.from(o.body)},res);
   return Response.json(result.body,{status:result.status});
  });
  if(body.action===lost&&!dropped){dropped=true;await route.abort();return;}
  await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
 });
 await context.route('https://pay.toss.im/payfront/**',r=>r.fulfill({contentType:'text/html',body:'<h1>합성 공급자 · 실제 결제 없음</h1>'}));
 await page.goto(PAGE);return{db,counts,payment,calls};
}
const state=page=>page.locator('[data-sale-status]');
async function prepare(page){await page.locator('[data-sale-action="product"]').click();await expect(state(page)).toHaveAttribute('data-state','product_ready');await page.locator('[data-sale-accept]').check();}
for(const width of [390,1280])test(`ordinary operational screen funds20 and shows owned history through existing modules at${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});const s=await setup({page,context});expect(s.calls).toEqual([]);await prepare(page);
 await expect(page.locator('[data-sale-text]')).toHaveText(document.text);await page.locator('[data-sale-buy]').evaluate(b=>{b.click();b.click();});
 await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);expect(s.counts.create).toBe(1);s.payment.payStatus='PAY_APPROVED';
 await page.goto(`${PAGE}?return=1&success=true&amount=1`);await expect(state(page)).toHaveAttribute('data-state','restore');expect(s.counts.approve).toBe(0);
 await page.locator('[data-sale-check]').click();await expect(page.locator('[data-sale-order]')).toContainText('이용권 지급 완료');expect(s.counts.approve).toBe(1);
 expect(s.db.data.get(core.walletRef(s.db,'alice').path).available).toBe(20);
 await page.locator('[data-history-action="refresh"]').click();await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','ready');
 await expect(page.locator('[data-history-list]')).toContainText('20회');await expect(page.locator('[data-history-list]')).toContainText('2027. 10. 27.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.setProductionUser('bob'));await expect(page.locator('[data-sale-order]')).toBeHidden();await expect(page.locator('[data-history-data]')).toBeHidden();
});
test('operational composition is disabled by default and cannot create an order from the ordinary page',async({page,context})=>{
 const s=await setup({page,context},{enabled:false});await page.locator('[data-sale-action="product"]').click();await expect(state(page)).toHaveAttribute('data-state','disabled');
 await expect(page.locator('[data-sale-buy]')).toBeDisabled();expect(s.db.transactions).toBe(0);expect(s.counts.create).toBe(0);
});
test('owned payment recovery after lost approval acknowledgment never repeats provider approval or grants twice',async({page,context})=>{
 const s=await setup({page,context},{lost:'complete'});await prepare(page);await page.locator('[data-sale-buy]').click();await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);s.payment.payStatus='PAY_APPROVED';
 await page.goto(`${PAGE}?return=1`);await page.locator('[data-sale-check]').click();await expect(state(page)).toHaveAttribute('data-state','unknown');
 await page.reload();await page.locator('[data-sale-check]').click();await expect(page.locator('[data-sale-order]')).toContainText('이용권 지급 완료');expect(s.counts.approve).toBe(1);expect(s.db.data.get(core.walletRef(s.db,'alice').path).available).toBe(20);
});
test('anonymous viewer can request login but cannot send a purchase request',async({page,context})=>{
 const s=await setup({page,context},{initial:null});await page.locator('[data-sale-action="product"]').click();expect(await page.evaluate(()=>window.productionLoginCalls)).toBe(1);expect(s.calls).toEqual([]);expect(s.db.transactions).toBe(0);
});
test('query switches cannot activate the deployment-authored operational mode',async({page,context})=>{
 const s=await setup({page,context},{mode:'TEST'});await page.goto(`${PAGE}?mode=LIVE&checkout=LIVE`);await expect(page.locator('#purchase-pay')).toBeVisible();await expect(page.locator('[data-sale-buy]')).toHaveCount(0);expect(s.calls).toEqual([]);
});
