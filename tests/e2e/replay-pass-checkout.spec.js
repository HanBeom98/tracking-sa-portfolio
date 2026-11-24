import { test, expect } from '@playwright/test';
import { merchantFixture, ACCESS } from '../helpers/merchant-test-fixture.js';
import { onRequest } from '../../functions/api/replay-pass-checkout.js';
import { readFileSync } from 'node:fs';
const PAGE = '/ai-replay-pass/', state = page => page.locator('#purchase-status');
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
});
async function setup({ page, context }, { initial = 'alice', lost, tamper } = {}) {
  // Preserve the member-only fallback regression, independently of the
  // review-period guest entry tested by replay-guest-checkout.spec.js.
  await context.route(/\/ai-replay-pass\/(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/html', body: readFileSync('public/ai-replay-pass/index.html', 'utf8').replace('data-guest-test-enabled="true"', 'data-guest-test-enabled="false"') }));
  await context.addInitScript(({ initial }) => {
    const listeners = new Set(); let uid = initial;
    const user = () => uid ? { uid, getIdToken: async () => `${uid}.synthetic_token.signature_for_browser_only` } : null;
    window.checkoutLoginCalls = 0;
    const gateway = { getCurrentUser: user, waitForReady: async () => {}, requireAuth: async () => { window.checkoutLoginCalls++; return user(); },
      subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
    Object.defineProperty(window, 'AuthGateway', { configurable: true, get: () => gateway, set: () => {} });
    window.setCheckoutUser = value => { uid = value; for (const fn of listeners) fn({ user: user() }); };
  }, { initial });
  const f = merchantFixture(), calls = []; let dropped = false;
  await context.route('**/api/replay-pass-checkout', async route => {
    const r = route.request(), body = r.postDataJSON(); calls.push(body.action);
    const response = await onRequest({ request: new Request('https://trackingsa.com/api/replay-pass-checkout', { method: 'POST', headers: { ...r.headers(), origin: 'https://trackingsa.com' }, body: r.postData() }),
      env: { TOSSPAY_REVIEW_ENABLED: 'true', TOSSPAY_REVIEW_ACCESS_KEY: ACCESS } }, async (_url, options) => {
      const result = { status: 200 }, res = { set() {}, status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
      await f.handler({ method: 'POST', headers: Object.fromEntries(Object.entries(options.headers).map(([k, v]) => [k.toLowerCase(), v])), rawBody: Buffer.from(options.body) }, res);
      if (tamper && result.status === 200) tamper(result.body);
      return Response.json(result.body, { status: result.status });
    }, async token => ({ sub: token.split('.')[0], firebase: { sign_in_provider: 'google.com' } }));
    if (lost === body.action && !dropped) { dropped = true; await route.abort(); return; }
    await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
  });
  await context.route('https://pay.toss.im/payfront/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>로컬 합성 토스 TEST 결제창</h1>' }));
  await page.goto(PAGE);
  return { ...f, calls };
}
async function buy(page) { await expect(state(page)).toHaveAttribute('data-state', 'ready'); await page.locator('#purchase-accept').check(); await page.locator('#purchase-pay').click(); }
for (const width of [390, 1280]) test(`ordinary customer purchase reaches TEST checkout and recovers without operator code at ${width}px`, async ({ page, context }, info) => {
  await page.setViewportSize({ width, height: 900 }); const f = await setup({ page, context });
  await expect(page.locator('#review-access')).toHaveCount(0); await expect(page.locator('#purchase-pay')).toBeDisabled(); expect(f.calls).toEqual([]);
  await page.locator('#purchase').screenshot({ path: info.outputPath(`customer-product-${width}.png`) });
  await page.locator('#purchase-accept').check(); await page.locator('#purchase-pay').evaluate(b => { b.click(); b.click(); });
  await expect(page).toHaveURL(/^https:\/\/pay.toss.im\/payfront\//); expect(f.calls).toEqual(['create', 'checkout']); expect(f.counts.create).toBe(1);
  f.payment().payStatus = 'PAY_APPROVED';
  await page.goto(`${PAGE}?return=1&success=true&amount=1&order=forged`);
  await expect(state(page)).toHaveAttribute('data-state', 'restore'); expect(f.counts.approve).toBe(0); expect(f.calls).toEqual(['create', 'checkout']);
  await page.locator('#purchase-check').click(); await expect(state(page)).toHaveAttribute('data-state', 'confirmed');
  await expect(page.locator('#purchase-order')).toContainText('20회 · 3,300원 · 365일');
  await expect(page.locator('#purchase-order')).toContainText('실제 출금·이용권 지급 없음'); expect(f.counts.approve).toBe(1);
  await page.locator('#purchase-check').click(); expect(f.counts.approve).toBe(1);
  const storage = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('tracking-sa:customer-checkout:')));
  expect(storage.length).toBe(1); expect(storage[0][1]).not.toContain('token'); expect(storage[0][1]).not.toContain('session'); expect(storage[0][1]).not.toContain('alice');
  expect([...f.db.data.keys()].some(k => /\/wallet|\/credit_orders/.test(k))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('guest opens login rather than sending payment; sign-in and consent do not auto-create an order', async ({ page, context }) => {
  const f = await setup({ page, context }, { initial: null }); await expect(state(page)).toHaveAttribute('data-state', 'signed_out');
  await page.locator('#purchase-pay').click(); expect(await page.evaluate(() => window.checkoutLoginCalls)).toBe(1); expect(f.calls).toEqual([]);
  await page.evaluate(() => window.setCheckoutUser('alice')); await expect(state(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#purchase-pay')).toBeDisabled(); expect(f.calls).toEqual([]);
});
test('lost checkout response recovers same customer order and opens existing checkout without provider retry', async ({ page, context }) => {
  const f = await setup({ page, context }, { lost: 'checkout' }); await buy(page); await expect(state(page)).toHaveAttribute('data-state', 'unknown');
  expect(f.counts.create).toBe(1); await page.reload(); await expect(state(page)).toHaveAttribute('data-state', 'restore');
  await page.locator('#purchase-check').click(); await expect(state(page)).toHaveAttribute('data-state', 'awaiting_buyer');
  await page.locator('#purchase-accept').check(); await page.locator('#purchase-pay').click(); await expect(page).toHaveURL(/^https:\/\/pay.toss.im/); expect(f.counts.create).toBe(1);
});
test('local-storage write failure prevents customer order or payment creation', async ({ page, context }) => {
  const f = await setup({ page, context }); await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('blocked'); }; });
  await buy(page); await expect(state(page)).toHaveAttribute('data-state', 'storage_blocked'); expect(f.calls).toEqual([]); expect(f.counts.create).toBe(0);
});
test('LIVE or wrong amount response cannot navigate to checkout or claim successful TEST payment', async ({ page, context }) => {
  const f = await setup({ page, context }, { tamper: body => { body.mode = 'LIVE'; } }); await buy(page);
  await expect(state(page)).toHaveAttribute('data-state', 'unknown'); await expect(page.locator('#purchase-handoff')).toBeHidden(); expect(f.counts.create).toBe(0);
});
test('forged return without a stored order never creates or approves a payment', async ({ page, context }) => {
  const f = await setup({ page, context }); await page.goto(`${PAGE}?return=1&success=true&order=forged`);
  await expect(state(page)).toHaveAttribute('data-state', 'missing_return'); await expect(page.locator('#purchase-pay')).toBeDisabled(); expect(f.calls).toEqual([]);
});
test('a new tab recovers the same signed-in customer order; account changes clear visible order and links', async ({ page, context }) => {
  const f = await setup({ page, context }); await buy(page); await expect(page).toHaveURL(/^https:\/\/pay.toss.im/);
  f.payment().payStatus = 'PAY_APPROVED'; const next = await context.newPage(); await next.goto(`${PAGE}?return=1`);
  await expect(state(next)).toHaveAttribute('data-state', 'restore'); await next.locator('#purchase-check').click(); await expect(state(next)).toHaveAttribute('data-state', 'confirmed');
  await next.evaluate(() => window.setCheckoutUser('bob')); await expect(next.locator('#purchase-order')).toBeHidden(); await expect(next.locator('#purchase-handoff')).toBeHidden();
  await expect(state(next)).toHaveAttribute('data-state', 'missing_return'); expect(f.counts.approve).toBe(1);
});
