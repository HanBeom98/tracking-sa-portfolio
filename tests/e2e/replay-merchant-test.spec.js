import { test, expect } from '@playwright/test';
import { merchantFixture, ACCESS } from '../helpers/merchant-test-fixture.js';
const PAGE = '/ai-replay-pass/internal-test/';
const PUBLIC = '/ai-replay-pass/';
const button = (page, action) => page.locator(`[data-review="${action}"]`);
const status = page => page.locator('#review-status');
test.beforeEach(async ({ context }) => {
  await context.route('**/*', r => new URL(r.request().url()).origin === 'http://127.0.0.1:4173' ? r.continue() : r.abort());
});
async function backend(page, { lost, enabled = true, tamper } = {}) {
  const f = merchantFixture({ enabled }), calls = []; let dropped = false;
  const handler = async route => {
    const request = route.request(), body = request.postDataJSON(); calls.push({ ...body });
    const result = { status: 200 }, res = { set() {}, status(v) { result.status = v; return this; }, json(v) { result.body = v; return this; } };
    await f.handler({ method: request.method(), headers: { ...request.headers(), origin: 'https://trackingsa.com' }, rawBody: Buffer.from(request.postData()) }, res);
    if (lost === body.action && !dropped) { dropped = true; await route.abort(); return; }
    if (tamper && result.status === 200) tamper(result.body);
    await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) });
  };
  await page.route('**/api/replay-purchase-test', handler);
  return { ...f, calls, attach: target => target.route('**/api/replay-purchase-test', handler) };
}
async function credentials(page) { await page.locator('#review-access').fill(ACCESS); await page.locator('#review-accept').check(); }
for (const width of [390, 1280]) for (const dark of [false, true]) test(`public product at ${width}px ${dark ? 'dark' : 'light'} is readable without authentication or payment requests`, async ({ page }, info) => {
  const f = await backend(page); await page.setViewportSize({ width, height: 900 }); await page.goto(PUBLIC);
  await page.evaluate(dark => { document.body.classList.toggle('dark-mode', dark); document.documentElement.classList.toggle('dark-mode', dark); }, dark);
  await expect(page.getByRole('heading', { name: 'AI 리플레이 분석 이용권', exact: true })).toBeVisible();
  await expect(page.locator('.pass-facts')).toContainText('3,300원'); await expect(page.locator('.pass-facts')).toContainText('365일');
  await expect(page.getByRole('heading', { name: /조건부 환불 안내/ })).toBeVisible();
  await expect(page.getByRole('table',{name:'20회·3,300원 이용권의 미사용분 환불 예시'})).toContainText('추가 825원');
  await expect(page.locator('.pass-content')).toContainText('최대 1영업일 이내');
  await expect(page.locator('#review-access')).toHaveCount(0); expect(f.calls).toEqual([]); expect(f.db.transactions).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`merchant-product-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
});

test('reviewer can navigate product conditions, terms and factual TEST privacy without payment requests',async({page})=>{
  const f=await backend(page);await page.goto(PUBLIC);
  await page.getByRole('link',{name:'관련 이용약관'}).click();await expect(page).toHaveURL(/\/terms\/#ai-replay-pass$/);
  await expect(page.locator('#ai-replay-pass')).toContainText('소급하여 불리하게 바꾸지 않습니다');
  await page.getByRole('link',{name:'환불 기준',exact:true}).click();await expect(page).toHaveURL(/\/ai-replay-pass\/#refund-title$/);
  await expect(page.locator('.pass-content')).toContainText('이미 환불된 금액');
  await page.goto('/privacy-policy/#payment-test');await expect(page.locator('#payment-test')).toContainText('브라우저의 24시간 복구 기한과 서버 TEST 기록의 보관은 별개');
  expect(f.calls).toEqual([]);expect(f.db.transactions).toBe(0);
});
for (const width of [390, 1280]) test(`TEST checkout return and demo confirmation at ${width}px never grant operating credits`, async ({ page }, info) => {
  const f = await backend(page); await page.setViewportSize({ width, height: 900 }); await page.goto(PAGE); await credentials(page);
  await button(page, 'create').evaluate(b => { b.click(); b.click(); }); await expect(status(page)).toHaveAttribute('data-state', 'order_found');
  await button(page, 'checkout').click(); await expect(status(page)).toHaveAttribute('data-state', 'checkout_ready'); expect(f.counts.create).toBe(1);
  await page.route('https://pay.toss.im/payfront/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Synthetic TEST checkout</p>' }));
  await page.locator('#review-handoff').click(); await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);
  f.payment().payStatus = 'PAY_APPROVED'; await page.goto(`${PAGE}?return=1&success=true&amount=1&order=untrusted`);
  await expect(status(page)).toHaveAttribute('data-state', 'restore'); await expect(page.locator('#review-access')).toHaveValue('');
  expect(f.counts.approve).toBe(0); await expect(button(page, 'complete')).toBeDisabled(); await credentials(page);
  await button(page, 'get').click(); await button(page, 'complete').click(); await expect(status(page)).toHaveAttribute('data-state', 'confirmed');
  expect(f.counts.approve).toBe(1); await expect(page.locator('#review-order')).toContainText('실제 이용권 지급 없음');
  await expect(page.locator('#review-order')).toContainText('시연용 만료일');
  expect([...f.db.data.keys()].some(p => /wallet|^users\//.test(p))).toBe(false);
  const stored = await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('tracking-sa:merchant-test:')));
  expect(stored).toHaveLength(1); expect(Object.keys(JSON.parse(stored[0][1])).sort()).toEqual(['orderId', 'session']); expect(stored[0][1]).not.toContain(ACCESS);
  await page.locator('#merchant-test').screenshot({ path: info.outputPath(`merchant-confirmed-${width}.png`) });
  await page.reload(); await credentials(page); await button(page, 'get').click(); await expect(status(page)).toHaveAttribute('data-state', 'confirmed'); expect(f.counts.approve).toBe(1);
});
test('lost checkout response restores exactly the same TEST order without recreating a payment', async ({ page }) => {
  const f = await backend(page, { lost: 'checkout' }); await page.goto(PAGE); await credentials(page); await button(page, 'create').click();
  await button(page, 'checkout').click(); await expect(status(page)).toHaveAttribute('data-state', 'unknown'); await expect(button(page, 'checkout')).toBeDisabled();
  await page.reload(); await credentials(page); await button(page, 'get').click(); await button(page, 'checkout').click();
  await expect(status(page)).toHaveAttribute('data-state', 'checkout_ready'); expect(f.counts.create).toBe(1);
  expect(new Set(f.calls.map(c => c.orderId)).size).toBe(1);
});

test('a definite missing-order lookup permits only a manual create retry with the same saved ID', async ({ page }) => {
  const f = await backend(page); let first = true;
  await page.route('**/api/replay-purchase-test', async route => {
    if (first) { first = false; await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"REVIEW_UNAVAILABLE"}' }); }
    else await route.fallback();
  });
  await page.goto(PAGE); await credentials(page); await button(page, 'create').click(); await expect(status(page)).toHaveAttribute('data-state', 'error');
  await expect(button(page, 'create')).toBeDisabled();
  const saved = await page.evaluate(() => sessionStorage.getItem('tracking-sa:merchant-test:v1'));
  await button(page, 'get').click(); await expect(button(page, 'create')).toBeEnabled();
  await button(page, 'create').click(); await expect(status(page)).toHaveAttribute('data-state', 'order_found');
  expect(await page.evaluate(() => sessionStorage.getItem('tracking-sa:merchant-test:v1'))).toBe(saved);
  expect(new Set(f.calls.map(c => c.orderId)).size).toBe(1); expect(f.counts.create).toBe(0);
});
test('missing return pointer and denied storage stop all TEST mutations', async ({ page }) => {
  const f = await backend(page); await page.goto(`${PAGE}?return=1&success=true&payToken=fake`); await credentials(page);
  await expect(status(page)).toHaveAttribute('data-state', 'missing_return'); await expect(button(page, 'create')).toBeDisabled(); expect(f.calls).toEqual([]);
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error('denied'); }; });
  await page.goto(PAGE); await credentials(page); await button(page, 'create').click();
  await expect(status(page)).toHaveAttribute('data-state', 'storage_blocked'); expect(f.calls).toEqual([]);
});
test('disabled backend and injected LIVE response never expose payment navigation or confirmed status', async ({ page }) => {
  const f = await backend(page, { enabled: false }); await page.goto(PAGE); await credentials(page); await button(page, 'create').click();
  await expect(status(page)).toContainText('활성화되지 않았습니다'); expect(f.db.transactions).toBe(0); await expect(page.locator('#review-handoff')).toBeHidden();
  await page.evaluate(() => { sessionStorage.clear(); localStorage.removeItem('tracking-sa:merchant-test:recovery:v1'); }); await page.unroute('**/api/replay-purchase-test');
  await backend(page, { tamper: value => { value.mode = 'LIVE'; } }); await page.reload(); await credentials(page); await button(page, 'create').click();
  await expect(status(page)).toHaveAttribute('data-state', 'unknown'); await expect(page.locator('#review-order')).toBeHidden(); await expect(page.locator('#review-handoff')).toBeHidden();
});

test('closing the checkout tab restores the same encrypted TEST order in a new tab and confirms once', async ({ page, context }, info) => {
  const f = await backend(page); await page.goto(PAGE); await credentials(page); await button(page,'create').click();
  await expect(status(page)).toHaveAttribute('data-state','order_found'); await button(page,'checkout').click();
  await expect(status(page)).toHaveAttribute('data-state','checkout_ready');
  const saved = await page.evaluate(() => ({ pointer: JSON.parse(sessionStorage.getItem('tracking-sa:merchant-test:v1')), backup: localStorage.getItem('tracking-sa:merchant-test:recovery:v1') }));
  expect(saved.backup).not.toContain(saved.pointer.session); expect(saved.backup).not.toContain(ACCESS);
  f.payment().payStatus='PAY_APPROVED'; await page.close();
  const next = await context.newPage(); await f.attach(next); await next.goto(`${PAGE}?return=1&success=true`);
  await expect(status(next)).toHaveAttribute('data-state','recovery_available'); await credentials(next);
  await expect(button(next,'create')).toBeDisabled(); await expect(button(next,'complete')).toBeDisabled();
  expect(f.counts.approve).toBe(0); await button(next,'recover').click(); await expect(status(next)).toHaveAttribute('data-state','order_found');
  expect(f.counts.create).toBe(1); expect(f.counts.approve).toBe(0);
  expect(await next.evaluate(() => JSON.parse(sessionStorage.getItem('tracking-sa:merchant-test:v1')))).toEqual(saved.pointer);
  await button(next,'complete').click(); await expect(status(next)).toHaveAttribute('data-state','confirmed');
  await next.reload(); await credentials(next); await button(next,'get').click(); await expect(status(next)).toHaveAttribute('data-state','confirmed');
  expect(f.counts.approve).toBe(1); expect(new Set(f.calls.map(c=>c.orderId)).size).toBe(1);
  await next.locator('#merchant-test').screenshot({path:info.outputPath('merchant-restored-confirmed.png')});
});

test('wrong recovery code or expired encrypted record cannot request, approve or replace an existing order', async ({ page }) => {
  const f=await backend(page); await page.goto(PAGE); await credentials(page); await button(page,'create').click(); await expect(status(page)).toHaveAttribute('data-state','order_found');
  await page.evaluate(()=>sessionStorage.clear()); await page.reload(); await page.locator('#review-access').fill('c'.repeat(64)); await page.locator('#review-accept').check();
  const before=f.calls.length; await button(page,'recover').click(); await expect(status(page)).toHaveAttribute('data-state','recovery_failed'); expect(f.calls).toHaveLength(before);
  await expect(button(page,'create')).toBeDisabled();
  await page.evaluate(()=>{ const key='tracking-sa:merchant-test:recovery:v1',v=JSON.parse(localStorage.getItem(key));v.expiresAt=Date.now()-1;localStorage.setItem(key,JSON.stringify(v)); });
  await page.reload(); await credentials(page); await button(page,'recover').click(); await expect(status(page)).toHaveAttribute('data-state','recovery_failed'); expect(f.calls).toHaveLength(before);
});

test('verified expiry blocks old checkout and requires a separate manual new TEST order', async ({ page }, info) => {
  const f=await backend(page); await page.goto(PAGE); await credentials(page); await button(page,'create').click(); await expect(status(page)).toHaveAttribute('data-state','order_found');
  await button(page,'checkout').click(); await expect(status(page)).toHaveAttribute('data-state','checkout_ready');
  Object.assign(f.payment(), {payStatus:'PAY_CANCEL',amountKRW:0,refundableAmount:0});
  await button(page,'get').click(); await expect(status(page)).toHaveAttribute('data-state','cancelled');
  await expect(button(page,'complete')).toBeDisabled(); await expect(button(page,'checkout')).toBeDisabled(); await expect(page.locator('#review-handoff')).toBeHidden();
  expect(f.counts.create).toBe(1); expect(f.counts.approve).toBe(0);
  await page.locator('#merchant-test').screenshot({path:info.outputPath('merchant-cancelled.png')});
  await button(page,'create').click(); await expect(status(page)).toHaveAttribute('data-state','order_found'); expect(new Set(f.calls.map(c=>c.orderId)).size).toBe(2);
  expect(f.counts.create).toBe(1); expect(f.counts.approve).toBe(0);
});
