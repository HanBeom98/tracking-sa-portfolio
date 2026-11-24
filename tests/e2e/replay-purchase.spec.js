import { test, expect } from '@playwright/test';
import service from '../../cloud-functions/replay-coaching-purchase-service.js';
import core from '../../cloud-functions/replay-coaching-credits.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { creditFixtureEntries } from '../helpers/coaching-credit-fixture.js';
const NOW = Date.parse('2026-10-26T00:00:00Z'), PAGE = '/stats/sudden-attack/replay/?coaching=review&transport=api&purchase=flow';
test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const listeners = new Set(); let user = { uid: 'alice', getIdToken: async () => 'alice' };
    const gateway = { getCurrentUser: () => user, getCurrentUserProfile: () => null, waitForReady: async () => {},
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
    Object.defineProperty(window, 'AuthGateway', { configurable: true, get: () => gateway, set: () => {} });
    window.setPurchaseTestUser = uid => { user = uid ? { uid, getIdToken: async () => uid } : null; for (const listener of listeners) listener({ user }); };
  });
});
async function backend(page, { checkoutEnabled = true, lost = null, hold = null } = {}) {
  const db = coachingMemoryDb(), calls = [], payment = {}, counts = { create: 0, approve: 0, inspect: 0 };
  for (const uid of ['alice', 'bob']) db.data.set(`users/${uid}`, { uid });
  const product = { id: core.PRODUCT, quantity: 20, amountKRW: 3300, termsVersion: 'browser_local_only', validDays: 365 };
  const provider = { mode: 'LIVE', async createPayment(expected) { counts.create++;
    Object.assign(payment, expected, { mode: 'LIVE', payToken: 'browser_synthetic_token', payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [] });
    return { ...payment, checkoutPage: 'https://pay.toss.im/payfront/auth?payToken=browser_synthetic_token' }; },
    async inspectPayment() { counts.inspect++; return structuredClone(payment); },
    async approvePayment() { counts.approve++; payment.payStatus = 'PAY_COMPLETE'; payment.paidAt = NOW;
      payment.transactions = [{ kind: 'PAY', reference: 'browser_synthetic_tx', amountKRW: 3300 }]; } };
  const handler = service.createReplayPurchaseHandler({ db, enabled: true, checkoutEnabled, product, provider, productDesc: 'Browser local only', now: () => NOW,
    verifyToken: async token => { if (!['alice', 'bob'].includes(token)) throw Error(); return { uid: token }; } });
  await page.route('**/api/replay-coaching-purchase', async route => {
    const req = route.request(), body = req.postDataJSON(); calls.push(body);
    const result = { status: 200 }, res = { set() {}, status(v) { result.status = v; return this; }, json(v) { result.body = v; return this; } };
    await handler({ method: req.method(), headers: { origin: 'https://trackingsa.com', 'content-type': 'application/json', authorization: req.headers().authorization }, rawBody: Buffer.from(req.postData()) }, res);
    if (hold && body.action === hold.action) await hold.promise;
    if (lost === body.action) { lost = null; await route.abort(); }
    else await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) }).catch(() => {});
  });
  return { db, calls, payment, counts };
}
const status = page => page.locator('[data-purchase-status]');
const button = (page, action) => page.locator(`[data-purchase-action="${action}"]`);
async function prepare(page) {
  await button(page, 'product').click(); await expect(status(page)).toHaveAttribute('data-state', 'product_ready');
  await expect(page.locator('[data-purchase-product]')).toContainText('결제 완료일부터 365일');
  await expect(page.locator('[data-purchase-disclosure]')).toContainText('실제 결제 약관에 대한 동의가 아닙니다.');
  await expect(button(page,'create')).toBeDisabled();
  await page.locator('[data-purchase-accept]').check(); await button(page, 'create').click();
  await expect(status(page)).toHaveAttribute('data-state', 'order_created');
  await expect(page.locator('[data-purchase-expiry]')).toHaveText('결제 완료일부터 365일');
  await expect(page.locator('[data-purchase-acknowledged-at]')).toContainText('서버 확인 기록:');
}

for (const width of [390, 1280]) test(`purchase/return screen confirms one owned order without replay upload at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); const server = await backend(page); await page.goto(PAGE);
  await expect(status(page)).toHaveAttribute('data-state', 'idle'); expect(server.calls).toEqual([]);
  await prepare(page); await expect(page.locator('[data-purchase-price]')).toHaveText('20회 · 3,300원');
  await button(page, 'checkout').evaluate(b => { b.click(); b.click(); });
  await expect(status(page)).toHaveAttribute('data-state', 'checkout_ready'); expect(server.counts.create).toBe(1);
  const id = await page.locator('[data-purchase-id]').textContent();
  // Never contact Toss. Intercept the external handoff locally, then emulate the
  // return navigation to the same site, carrying only an untrusted order hint.
  await page.route('https://pay.toss.im/payfront/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Local checkout placeholder</p>' }));
  await page.locator('[data-purchase-handoff]').click(); await expect(page).toHaveURL(/https:\/\/pay\.toss\.im/);
  server.payment.payStatus = 'PAY_APPROVED'; await page.goto(`${PAGE}&paymentReturn=1&order=${id}&success=true`);
  await expect(status(page)).toHaveAttribute('data-state', 'restore'); expect(server.counts.approve).toBe(0);
  await expect(button(page, 'complete')).toBeDisabled(); await button(page, 'get').click();
  await expect(status(page)).toHaveAttribute('data-state', 'order_found'); await button(page, 'complete').click();
  await expect(status(page)).toHaveAttribute('data-state', 'funded'); expect(server.counts.approve).toBe(1);
  expect(server.db.data.get(core.walletRef(server.db, 'alice').path).available).toBe(20);
  await expect(page.locator('[data-purchase-expiry]')).toContainText('2027. 10. 26.');
  await page.locator('[data-history-action="refresh"]').click();
  await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','ready');
  await expect(page.locator('[data-history-list]>li')).toHaveCount(1);
  await expect(page.locator('[data-history-summary]>div').filter({has:page.getByText('기간 내 미사용',{exact:true})}).locator('dd')).toHaveText('20회');
  await expect(page.locator('[data-history-list]')).toContainText('2027. 10. 26.');
  await expect(page.locator('[data-history-list]')).toContainText('purchase_preview_20261027_v1');
  await expect(page.locator('#replayResults')).toBeHidden(); // Purchase works without selecting a file.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#replayPurchaseFlow').screenshot({ path: testInfo.outputPath(`purchase-funded-${width}.png`) });
  await page.locator('[data-purchase-disclosure]').evaluate(el=>window.scrollTo(0,Math.max(0,scrollY+el.getBoundingClientRect().top-100)));
  await page.locator('[data-purchase-disclosure]').screenshot({path:testInfo.outputPath(`acknowledgement-${width}.png`)});
  await page.reload(); await expect(status(page)).toHaveAttribute('data-state', 'restore'); await button(page, 'get').click();
  await expect(status(page)).toHaveAttribute('data-state', 'funded'); expect(server.counts.approve).toBe(1);
  await expect(page.locator('[data-purchase-disclosure-text]')).toContainText('조건 버전: browser_local_only');
  expect(await page.evaluate(() => Object.entries(sessionStorage).filter(([k]) => k.startsWith('tracking-sa:replay-purchase:')).map(([, v]) => v))).toEqual([id]);
});

test('a changed-terms response clears the checkbox and requires reloading the document before retry',async({page})=>{
  const server=await backend(page);let rejected=false;
  await page.route('**/api/replay-coaching-purchase',async route=>{
    if(route.request().postDataJSON().action==='create'&&!rejected){rejected=true;await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'ORDER_TERMS_CHANGED'})});}
    else await route.fallback();
  });
  await page.goto(PAGE);await button(page,'product').click();await page.locator('[data-purchase-accept]').check();
  await button(page,'create').click();await expect(status(page)).toHaveAttribute('data-state','terms_changed');
  await expect(page.locator('[data-purchase-accept]')).not.toBeChecked();await expect(button(page,'create')).toBeDisabled();
  await expect(page.locator('[data-purchase-disclosure]')).toBeHidden();expect(server.db.transactions).toBe(0);
  await button(page,'product').click();await expect(page.locator('[data-purchase-disclosure]')).toBeVisible();
  await expect(page.locator('[data-purchase-accept]')).not.toBeChecked();await expect(button(page,'create')).toBeDisabled();
  await page.locator('[data-purchase-accept]').check();await button(page,'create').click();
  await expect(status(page)).toHaveAttribute('data-state','order_created');
  const create=server.calls.find(c=>c.action==='create');expect(Object.keys(create.acknowledgement).sort()).toEqual(['accepted','digest','version']);
  expect(server.counts.create).toBe(0);expect(server.counts.approve).toBe(0);
});

function seedHistory(server,count=13) {
  const wallet=core.emptyWallet('alice');
  for(let i=0;i<count;i++) {
    const orderId=`history_${String(i).padStart(2,'0')}`;
    const [, , [path,order]]=creditFixtureEntries('alice',{quantity:50,now:NOW,orderId});
    server.db.data.set(path,order);wallet.purchased+=50;wallet.available+=50;
    wallet.lots.push({orderId,remaining:50,held:0,refundHeld:0,expiresAt:null});
  }
  server.db.data.set(core.walletRef(server.db,'alice').path,wallet);
}

test('purchase history works without a saved order pointer, pages manually and clears across accounts',async({page})=>{
  const server=await backend(page);seedHistory(server);await page.goto(PAGE);
  expect(server.calls).toEqual([]);await page.locator('[data-history-action="refresh"]').click();
  await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','ready');
  await expect(page.locator('[data-history-list]>li')).toHaveCount(10);
  await expect(page.locator('[data-history-list]>li').first()).toContainText('history_12');
  await expect(page.locator('[data-history-summary]>div').filter({has:page.getByText('기간 내 미사용',{exact:true})}).locator('dd')).toHaveText('650회');
  await page.locator('[data-history-action="next"]').click();await expect(page.locator('[data-history-list]>li')).toHaveCount(3);
  await expect(page.locator('[data-history-list]>li').first()).toContainText('history_02');
  await expect(page.locator('[data-history-action="next"]')).toBeHidden();
  expect(server.calls.map(c=>c.action)).toEqual(['history','history']);expect(server.counts).toEqual({create:0,approve:0,inspect:0});
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('tracking-sa:replay-purchase:')))).toEqual([]);
  await page.evaluate(()=>window.setPurchaseTestUser('bob'));await expect(page.locator('[data-history-list]>li')).toHaveCount(0);
  await expect(page.locator('[data-history-data]')).toBeHidden();expect(server.calls.length).toBe(2);
  await page.locator('[data-history-action="refresh"]').click();await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','empty');
  await expect(page.locator('[data-history-summary]')).toContainText('0회');
  await page.evaluate(()=>window.setPurchaseTestUser(null));await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','signed_out');
  await expect(page.locator('[data-history-action="refresh"]')).toBeDisabled();await expect(page.locator('[data-history-data]')).toBeHidden();
});

test('expired unused units remain separate and a failed history read never triggers a retry or payment',async({page})=>{
  const server=await backend(page,{lost:'history'});seedHistory(server,1);
  const order=server.db.data.get(core.orderRef(server.db,'alice','history_00').path),wallet=server.db.data.get(core.walletRef(server.db,'alice').path);
  Object.assign(order,{createdAt:NOW-366*86400000,paidAt:NOW-365*86400000,validDays:365,expiresAt:NOW});wallet.lots[0].expiresAt=NOW;
  const before=structuredClone([...server.db.data]);await page.goto(PAGE);await page.locator('[data-history-action="refresh"]').click();
  await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','error');expect(server.calls.length).toBe(1);
  await expect(page.locator('[data-history-data]')).toBeHidden();await page.locator('[data-history-action="refresh"]').click();
  await expect(page.locator('[data-history-status]')).toHaveAttribute('data-state','ready');
  await expect(page.locator('[data-history-summary]>div').filter({has:page.getByText('기간 내 미사용',{exact:true})}).locator('dd')).toHaveText('0회');
  await expect(page.locator('[data-history-summary]>div').filter({has:page.getByText('만료된 미사용',{exact:true})}).locator('dd')).toHaveText('50회');
  await expect(page.locator('[data-history-list]')).toContainText('이용 기간 만료');
  expect(server.calls.length).toBe(2);expect(server.counts).toEqual({create:0,approve:0,inspect:0});expect([...server.db.data]).toEqual(before);
});

test('lost checkout response restores the same order after reload without another payment creation', async ({ page }) => {
  const server = await backend(page, { lost: 'checkout' }); await page.goto(PAGE); await prepare(page);
  await button(page, 'checkout').click(); await expect(status(page)).toHaveAttribute('data-state', 'unknown');
  const id = server.calls.find(c => c.action === 'create').orderId; await page.reload();
  await expect(status(page)).toHaveAttribute('data-state', 'restore'); await button(page, 'get').click();
  await button(page, 'checkout').click(); await expect(status(page)).toHaveAttribute('data-state', 'checkout_ready');
  expect(server.counts.create).toBe(1); expect(server.calls.filter(c => c.orderId).every(c => c.orderId === id)).toBe(true);
});

test('another account or logout clears order and navigation data while preserving owner-only recovery', async ({ page }) => {
  const server = await backend(page); await page.goto(PAGE); await prepare(page); await button(page, 'checkout').click();
  await expect(page.locator('[data-purchase-handoff]')).toBeVisible();
  await page.evaluate(() => window.setPurchaseTestUser(null)); await expect(status(page)).toHaveAttribute('data-state', 'signed_out');
  await expect(page.locator('[data-purchase-order]')).toBeHidden(); await expect(page.locator('[data-purchase-handoff]')).not.toHaveAttribute('href');
  await page.evaluate(() => window.setPurchaseTestUser('bob')); await expect(button(page, 'get')).toBeDisabled();
  await page.evaluate(() => window.setPurchaseTestUser('alice')); await button(page, 'get').click();
  await expect(page.locator('[data-purchase-order]')).toBeVisible(); expect(server.counts.approve).toBe(0);
});

test('invalid or cross-owner return parameters never authorize orders or a payment', async ({ page }) => {
  const server = await backend(page); await page.goto(`${PAGE}&order=../invalid&success=true&payToken=untrusted`);
  await expect(status(page)).toHaveAttribute('data-state', 'invalid_return'); expect(server.calls).toEqual([]);
  await expect(button(page, 'create')).toBeDisabled(); await expect(button(page, 'complete')).toBeDisabled();
  await page.goto(`${PAGE}&order=another_owned_order_01&success=true`); await page.evaluate(() => window.setPurchaseTestUser('bob'));
  await button(page, 'get').click(); await expect(status(page)).toHaveAttribute('data-state', 'not_found');
  await expect(button(page, 'complete')).toBeDisabled(); expect(server.counts.approve).toBe(0);
  const before = server.calls.length; await page.goto(`${PAGE}&paymentReturn=1`);
  await expect(status(page)).toHaveAttribute('data-state', 'missing_return');
  await expect(button(page, 'create')).toBeDisabled(); expect(server.calls.length).toBe(before);
});

test('default checkout gate and ordinary free pages do not start payment flows', async ({ page }) => {
  const server = await backend(page, { checkoutEnabled: false }); await page.goto(PAGE); await button(page, 'product').click();
  await expect(status(page)).toHaveAttribute('data-state', 'disabled'); await page.locator('[data-purchase-accept]').check();
  await expect(button(page, 'create')).toBeDisabled(); expect(server.db.transactions).toBe(0);
  const requested = []; page.on('request', r => { if (/replay-purchase-(flow|client|session|response)|\/api\/replay-coaching-purchase/.test(r.url())) requested.push(r.url()); });
  await page.goto('/stats/sudden-attack/replay/'); await expect(page.locator('#replayPurchaseFlow')).toHaveCount(0); expect(requested).toEqual([]);
});

test('browser storage write denial prevents order submission before any payment request', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('tracking-sa:replay-purchase:')) throw new DOMException('Blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  const server = await backend(page); await page.goto(PAGE); await button(page, 'product').click();
  await page.locator('[data-purchase-accept]').check(); await button(page, 'create').click();
  await expect(status(page)).toHaveAttribute('data-state', 'storage_unavailable');
  expect(server.calls.map(c => c.action)).toEqual(['product']); expect(server.db.transactions).toBe(0); expect(server.counts.create).toBe(0);
});

test('lost paid response recovers by an owned order read after reload, without another approval', async ({ page }) => {
  const server = await backend(page, { lost: 'complete' }); await page.goto(PAGE); await prepare(page);
  await button(page, 'checkout').click(); await expect(status(page)).toHaveAttribute('data-state', 'checkout_ready');
  server.payment.payStatus = 'PAY_APPROVED'; await button(page, 'complete').click();
  await expect(status(page)).toHaveAttribute('data-state', 'unknown'); expect(server.counts.approve).toBe(1);
  await page.reload(); await button(page, 'get').click(); await expect(status(page)).toHaveAttribute('data-state', 'funded');
  expect(server.counts.approve).toBe(1); expect(server.counts.create).toBe(1);
  expect(server.db.data.get(core.walletRef(server.db, 'alice').path).purchased).toBe(20);
});
