import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/replay-pass-guest-test.js';
import { merchantFixture, ACCESS } from '../helpers/merchant-test-fixture.js';
const origin='https://trackingsa.com', path=origin+'/api/replay-pass-guest-test', clock=Date.parse('2026-10-27T06:00:00Z');
const env={TOSSPAY_REVIEW_ENABLED:'true',TOSSPAY_REVIEW_GUEST_ENABLED:'true',TOSSPAY_REVIEW_ACCESS_KEY:ACCESS};
const id='a1'.repeat(16);
const request=(body={action:'start'},cookie='',headers={})=>new Request(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:JSON.stringify(body)});
async function start() {
  const response=await onRequest({request:request(),env},()=>{throw Error('unexpected upstream');},()=>clock);
  assert.equal(response.status,200);
  return {cookie:response.headers.get('Set-Cookie').split(';')[0],body:await response.json(),headers:response.headers};
}
function backend() {
  const f=merchantFixture(), sessions=[];
  const fetch=async(url,options)=>{
    assert.equal(url,'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchaseTest');
    assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,`Bearer ${ACCESS}`);
    sessions.push(options.headers['x-review-session']);
    const result={status:200},res={set(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;}};
    await f.handler({method:'POST',headers:Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v])),rawBody:Buffer.from(options.body)},res);
    return Response.json(result.body,{status:result.status});
  };
  return {...f,sessions,fetch};
}
test('guest TEST bootstrap is flag gated, same-origin POST only and never accesses payment or DB',async()=>{
  let calls=0;const fetch=async()=>{calls++;throw Error();};
  for(const flags of [{},{...env,TOSSPAY_REVIEW_GUEST_ENABLED:'false'},{...env,TOSSPAY_REVIEW_ENABLED:'false'}])assert.equal((await onRequest({request:request(),env:flags},fetch)).status,503);
  for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}])assert.equal((await onRequest({request:request(undefined,'',headers),env},fetch)).status,403);
  assert.equal((await onRequest({request:new Request(path,{headers:{Origin:origin}}),env},fetch)).status,405);
  for(const body of [{action:'start',uid:'forged'},{action:'create',orderId:id,amountKRW:1},{action:'refund',orderId:id},'x'.repeat(1500)])assert.equal((await onRequest({request:request(body),env},fetch)).status,400);
  assert.equal((await onRequest({request:request(undefined,'',{Authorization:'Bearer forged'}),env},fetch)).status,400);
  assert.equal(calls,0);
});
test('guest cookie is signed, host-only Secure HttpOnly Lax and expires without silently renewing',async()=>{
  const a=await start();assert.match(a.headers.get('Set-Cookie'),/; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400$/);
  assert.equal(a.headers.get('Cache-Control'),'no-store');assert.equal(a.body.expiresAt,clock+86400000);
  assert.equal(a.body.mode,'TEST');assert.equal(a.body.operationalCreditsGranted,false);assert.ok(!JSON.stringify(a.body).includes(ACCESS));
  const repeated=await onRequest({request:request({action:'start'},a.cookie),env},undefined,()=>clock+1000);
  assert.equal(repeated.headers.get('Set-Cookie'),null);assert.deepEqual(await repeated.json(),a.body);
  const expired=await onRequest({request:request({action:'start'},a.cookie),env},undefined,()=>clock+86400000);
  assert.equal(expired.status,401);assert.equal(expired.headers.get('Set-Cookie'),null);
});
test('missing, forged, duplicate or expired cookies cannot read a session or dispatch a TEST operation',async()=>{
  const a=await start();let calls=0;const fetch=async()=>{calls++;throw Error();};
  for(const cookie of ['',a.cookie.slice(0,-1)+(a.cookie.endsWith('0')?'1':'0'),`${a.cookie}; ${a.cookie}`,'__Host-trackingsa_review_guest='])
    for(const action of ['session','create','get','checkout','complete'])assert.equal((await onRequest({request:request(action==='session'?{action}:{action,orderId:id},cookie),env},fetch,()=>clock)).status,401);
  assert.equal(calls,0);
});
test('different guest cookies have different TEST owners; caller session cannot cross ownership or fund credits',async()=>{
  const a=await start(),b=await start(),f=backend();assert.notEqual(a.body.guestId,b.body.guestId);
  const call=(cookie,action,extra={})=>onRequest({request:request({action,orderId:id},cookie,extra),env},f.fetch,()=>clock);
  assert.equal((await call(a.cookie,'create',{'x-review-session':'f'.repeat(64)})).status,200);
  const owner=f.sessions[0];assert.notEqual(owner,'f'.repeat(64));assert.notEqual(owner,a.body.guestId);
  for(const action of ['get','checkout','complete'])assert.equal((await call(b.cookie,action)).status,404);
  assert.equal((await call(a.cookie,'checkout')).status,200);assert.equal(f.counts.create,1);
  f.payment().payStatus='PAY_APPROVED';const paid=await call(a.cookie,'complete');assert.equal((await paid.json()).order.quantity,20);
  assert.equal((await call(a.cookie,'complete')).status,200);assert.equal(f.counts.approve,1);
  assert.ok([...f.db.data.keys()].every(p=>!p.includes('/wallet')&&!p.includes('/credit_orders')));
});
test('guest bridge rejects LIVE responses and redirects, hides shared keys and never retries',async()=>{
  const a=await start();
  for(const response of [()=>new Response(null,{status:302,headers:{Location:'https://evil.example/'+ACCESS}}),()=>Response.json({mode:'LIVE',demoOnly:true,operationalCreditsGranted:false})]) {
    let calls=0;const r=await onRequest({request:request({action:'create',orderId:id},a.cookie),env},async()=>{calls++;return response();},()=>clock);
    assert.equal(r.status,503);assert.equal(calls,1);assert.equal(r.headers.get('Set-Cookie'),null);assert.ok(!JSON.stringify(await r.json()).includes(ACCESS));
  }
});
