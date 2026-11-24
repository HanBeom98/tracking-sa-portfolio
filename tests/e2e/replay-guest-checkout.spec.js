import { test, expect } from '@playwright/test';
import { onRequest } from '../../functions/api/replay-pass-guest-test.js';
import { merchantFixture, ACCESS } from '../helpers/merchant-test-fixture.js';
const PAGE='/ai-replay-pass/', state=page=>page.locator('#purchase-status');
const COOKIE='__Host-trackingsa_review_guest', LOCAL_COOKIE='fixture_review_guest';
async function setup({page,context},{blockedCookies=false,disabled=false,lost,tamper}={}) {
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
  await context.addInitScript(()=>{
    const listeners=new Set();let user=null;window.checkoutLoginCalls=0;
    const gateway={getCurrentUser:()=>user,waitForReady:async()=>{},requireAuth:async()=>{window.checkoutLoginCalls++;return user;},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
    Object.defineProperty(window,'AuthGateway',{configurable:true,get:()=>gateway,set:()=>{}});
    window.signIntoGuestCheckout=()=>{user={uid:'alice',getIdToken:async()=>'alice.synthetic_token.signature_for_guest_fixture'};for(const fn of listeners)fn({user});};
  });
  const f=merchantFixture(),actions=[],upstream=[];let dropped=false;
  await context.route('**/api/replay-pass-guest-test',async route=>{
    const r=route.request(),body=r.postDataJSON();actions.push(body.action);
    const headers={...r.headers(),origin:'https://trackingsa.com'};
    headers.cookie=(headers.cookie||'').replaceAll(LOCAL_COOKIE+'=',COOKIE+'=');
    const response=await onRequest({request:new Request('https://trackingsa.com/api/replay-pass-guest-test',{method:'POST',headers,body:r.postData()}),
      env:{TOSSPAY_REVIEW_ENABLED:'true',TOSSPAY_REVIEW_GUEST_ENABLED:disabled?'false':'true',TOSSPAY_REVIEW_ACCESS_KEY:ACCESS}},async(_url,options)=>{
      upstream.push(JSON.parse(options.body).action);
      const result={status:200},res={set(){},status(n){result.status=n;return this;},json(v){result.body=v;return this;}};
      await f.handler({method:'POST',headers:Object.fromEntries(Object.entries(options.headers).map(([k,v])=>[k.toLowerCase(),v])),rawBody:Buffer.from(options.body)},res);
      if(tamper&&result.status===200)tamper(result.body);
      return Response.json(result.body,{status:result.status});
    });
    if(lost===body.action&&!dropped){dropped=true;await route.abort();return;}
    const returned=Object.fromEntries(response.headers);
    if(blockedCookies)delete returned['set-cookie'];
    // The local HTTP fixture uses an unprefixed cookie. Unit tests assert the
    // actual production __Host-/Secure/HttpOnly attributes; never deploy this adapter.
    else if(returned['set-cookie'])returned['set-cookie']=returned['set-cookie'].replace(COOKIE+'=',LOCAL_COOKIE+'=').replace('; Secure','');
    await route.fulfill({status:response.status,headers:returned,body:await response.text()});
  });
  await context.route('https://pay.toss.im/payfront/**',route=>route.fulfill({contentType:'text/html',body:'<h1>로컬 합성 토스 TEST</h1>'}));
  await page.goto(PAGE);await expect(state(page)).toHaveAttribute('data-state','ready');
  return {...f,actions,upstream};
}
async function buy(page){await page.locator('#purchase-accept').check();await page.locator('#purchase-pay').click();}
for(const width of [390,1280])test(`guest reaches TEST without signup and recovers one owned order at${width}px`,async({page,context})=>{
  await page.setViewportSize({width,height:900});const f=await setup({page,context});
  expect(f.actions).toEqual([]);expect(f.db.transactions).toBe(0);await expect(page.locator('#purchase-pay')).toBeDisabled();
  await page.locator('#purchase-accept').check();await page.locator('#purchase-pay').evaluate(b=>{b.click();b.click();});
  await expect(page).toHaveURL(/^https:\/\/pay.toss.im\/payfront\//);expect(f.actions).toEqual(['start','session','create','checkout']);expect(f.counts.create).toBe(1);
  f.payment().payStatus='PAY_APPROVED';await page.goto(PAGE+'?return=1&success=true');await expect(state(page)).toHaveAttribute('data-state','restore');
  await page.locator('#purchase-check').click();await expect(state(page)).toHaveAttribute('data-state','confirmed');
  expect(f.counts.approve).toBe(1);await page.locator('#purchase-check').click();expect(f.counts.approve).toBe(1);
  expect(await page.evaluate(()=>window.checkoutLoginCalls)).toBe(0);
  expect(await page.evaluate(()=>document.cookie.includes('fixture_review_guest'))).toBe(false);
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tracking-sa:guest-checkout:v1')));
  expect(Object.keys(stored).sort()).toEqual(['expiresAt','guestId','orderId']);expect(JSON.stringify(stored)).not.toContain(ACCESS);
  expect([...f.db.data.keys()].some(p=>/\/wallet|\/credit_orders|^users\//.test(p))).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('blocked cookies prevent every DB, order and payment request',async({page,context})=>{
  const f=await setup({page,context},{blockedCookies:true});await buy(page);await expect(state(page)).toHaveAttribute('data-state','guest_expired');
  expect(f.actions).toEqual(['start','session']);expect(f.upstream).toEqual([]);expect(f.db.transactions).toBe(0);expect(f.counts.create).toBe(0);
});
test('cookie deletion with a stored order never silently replaces its owner or creates another order',async({page,context})=>{
  const f=await setup({page,context});await buy(page);await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);
  await context.clearCookies();await page.goto(PAGE+'?return=1');await expect(state(page)).toHaveAttribute('data-state','restore');
  await page.locator('#purchase-check').click();await expect(state(page)).toHaveAttribute('data-state','guest_expired');
  expect(f.counts.create).toBe(1);expect(f.counts.approve).toBe(0);expect(f.upstream).toEqual(['create','checkout']);
});
test('lost checkout response restores the same guest cookie and payment without another provider write',async({page,context})=>{
  const f=await setup({page,context},{lost:'checkout'});await buy(page);await expect(state(page)).toHaveAttribute('data-state','unknown');
  expect(f.counts.create).toBe(1);await page.reload();await expect(state(page)).toHaveAttribute('data-state','restore');await page.locator('#purchase-check').click();
  await expect(state(page)).toHaveAttribute('data-state','awaiting_buyer');await buy(page);await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);expect(f.counts.create).toBe(1);
});
test('disabled guest flag fails before upstream and never asks the visitor to sign up',async({page,context})=>{
  const f=await setup({page,context},{disabled:true});await buy(page);await expect(state(page)).toHaveAttribute('data-state','disabled');
  expect(f.db.transactions).toBe(0);expect(f.upstream).toEqual([]);expect(await page.evaluate(()=>window.checkoutLoginCalls)).toBe(0);
});
test('guest storage denial and forged return cannot create a payment',async({page,context})=>{
  const f=await setup({page,context});await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('blocked');};});
  await buy(page);await expect(state(page)).toHaveAttribute('data-state','storage_blocked');expect(f.upstream).toEqual([]);
  await page.goto(PAGE+'?return=1&order=forged');await expect(state(page)).toHaveAttribute('data-state','missing_return');expect(f.counts.create).toBe(0);
});
test('signing in clears visible guest details without moving or funding its order',async({page,context})=>{
  const f=await setup({page,context});await buy(page);await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);await page.goto(PAGE);
  await expect(state(page)).toHaveAttribute('data-state','restore');await page.locator('#purchase-check').click();await expect(page.locator('#purchase-order')).toBeVisible();
  await page.evaluate(()=>window.signIntoGuestCheckout());await expect(page.locator('#purchase-order')).toBeHidden();await expect(page.locator('#purchase-handoff')).toBeHidden();
  expect(f.counts.create).toBe(1);expect(f.counts.approve).toBe(0);
});
