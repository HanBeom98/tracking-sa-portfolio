import { test, expect } from '@playwright/test';
import { makeReplay, makeRound } from '../fixtures/replay-context.js';
import service from '../../cloud-functions/replay-coaching-review-service.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import catalog from '../../cloud-functions/replay-coaching-review-catalog.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { seedCreditFixture } from '../helpers/coaching-credit-fixture.js';
import { openAIEnvelope } from '../helpers/coaching-openai-fixture.js';
const NOW = Date.parse('2026-10-26T00:00:00Z');
const fixture = () => makeReplay([
  makeRound([[10, 'mate', 'enemy1'], [20, 'spare', 'enemy2'], [30, 'enemy3', 'focus'], [50, 'enemy3', 'mate'], [70, 'enemy3', 'spare']]),
  makeRound([], { no: 2 }), makeRound([[10, 'enemy1', 'focus']], { no: 3 }), makeRound([], { no: 4 }),
]);
test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
  await page.addInitScript(() => {
    Date.now = () => Date.parse('2026-10-26T00:00:00Z');
    const listeners = new Set();
    let user = { uid: 'alice', getIdToken: async () => 'alice' };
    const gateway = { getCurrentUser: () => user, getCurrentUserProfile: () => null,
      waitForReady: async () => {}, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
    Object.defineProperty(window, 'AuthGateway', { configurable: true, get: () => gateway, set: () => {} });
    window.setReviewTestUser = uid => { user = uid ? { uid, getIdToken: async () => uid } : null; for (const listener of listeners) listener({ user }); };
  });
});

async function analyze(page, query = '?coaching=review&transport=api') {
  await page.goto(`/stats/sudden-attack/replay/${query}`);
  await page.locator('#replayFile').setInputFiles({ name: 'synthetic-review.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture())) });
  await page.locator('#replayPlayer').selectOption('focus'); await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayResults')).toBeVisible();
}
async function server(page, { paid = true, lostAcknowledgement = false, hold = null } = {}) {
  const db = coachingMemoryDb(), calls = []; let generations = 0, tokens = 0;
  for (const uid of ['alice', 'bob']) { if (paid) seedCreditFixture(db, uid); else db.data.set(`users/${uid}`, { uid, subscription: { status: 'active' } }); }
  db.data.set(cost.controlRef(db).path, { schemaVersion: 1, enabled: true, period: '202610', allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  const handler = service.createReplayReviewHandler({ db, enabled: true, now: () => NOW,
    verifyToken: async value => { if (!['alice', 'bob'].includes(value)) throw Error(); return { uid: value }; },
    config: { userMicros: cost.POLICY.maxUserMicros, globalMonthly: 100 }, countTokens: async () => { tokens++; return 1000; },
    generate: async (request, quote) => {
      generations++; if (hold) await hold;
      const evidence = calls.findLast(c => c.body.action === 'generate').body.evidence;
      const facts = catalog.createReviewCatalog(evidence).facts;
      return openAIEnvelope(quote, { schemaVersion: 2, cards: facts.slice(0, 2).map((f, i) => ({ kind: i ? 'practice' : 'review', factId: f.id, questionId: f.questions[0], practiceId: f.practices[0] })) });
    } });
  await page.route('**/api/replay-coaching-review', async route => {
    const request = route.request(), body = request.postDataJSON(); calls.push({ body, authorization: request.headers().authorization });
    const result = { status: 200, body: null }, res = { set: () => res, status: n => { result.status = n; return res; }, json: v => { result.body = v; return res; } };
    // In-process adapter supplies the handler's allowed production origin.
    // Browser traffic itself stays on loopback; no operational endpoint is used.
    await handler({ method: request.method(), headers: { origin: 'https://trackingsa.com', authorization: request.headers().authorization, 'content-type': request.headers()['content-type'] }, rawBody: Buffer.from(request.postData()) }, res);
    if (lostAcknowledgement && body.action === 'generate') { lostAcknowledgement = false; await route.abort(); }
    else await route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) }).catch(() => {});
  });
  return { db, calls, counts: () => ({ generations, tokens }) };
}
const status = page => page.locator('[data-review-api-status]');
const cards = page => page.locator('[data-review-api-cards] .coaching-card');

for (const width of [390, 1280]) test(`authenticated local HTTP renders evidence-linked cards without duplicate generation at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 }); const backend = await server(page); await analyze(page);
  await expect(status(page)).toHaveAttribute('data-state', 'idle'); expect(backend.calls).toHaveLength(0);
  await page.locator('[data-review-api-generate]').evaluate(button => { button.click(); button.click(); });
  await expect(status(page)).toHaveAttribute('data-state', 'ready'); await expect(cards(page)).toHaveCount(2);
  expect(backend.counts()).toEqual({ generations: 1, tokens: 1 }); expect(backend.calls).toHaveLength(1);
  expect(backend.calls[0].authorization).toBe('Bearer alice');
  expect(JSON.stringify(backend.calls[0].body)).not.toMatch(/nexonSN|nickName|coordinate|subscription|"uid"/);
  await page.locator('[data-review-api-cards] [data-review-jump="1"]').click(); await expect(page.locator('#reviewAnchor-1')).toBeFocused();
  await page.locator('[data-review-api-cards] [data-review-playback="round-1"]').click();
  await expect(page.locator('#replayPlayback')).toBeFocused();
  await expect(page.locator('[data-playback-seek]')).toHaveValue('3000');
  await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  expect(backend.calls).toHaveLength(1);expect(backend.counts()).toEqual({generations:1,tokens:1});
  await page.locator('[data-review-api-result]').click(); await expect(status(page)).toHaveAttribute('data-state', 'ready');
  expect(backend.calls.map(c => c.body.action)).toEqual(['generate', 'result']); expect(backend.counts().generations).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.review-result').screenshot({ path: testInfo.outputPath('authenticated-review.png') });
  await page.locator('#replayPlayer').selectOption('mate'); await page.locator('#replayPlayer').selectOption('focus');
  await page.locator('#analyzeReplayButton').click(); await expect(status(page)).toHaveAttribute('data-state', 'recoverable');
  await expect(page.locator('[data-review-api-generate]')).toBeDisabled(); await page.locator('[data-review-api-result]').click();
  await expect(cards(page)).toHaveCount(2); expect(backend.counts().generations).toBe(1);
});

test('missing purchased AI credits never calls provider; basic replay navigation remains available', async ({ page }) => {
  const backend = await server(page, { paid: false }); await analyze(page);
  await page.locator('[data-review-api-generate]').click(); await expect(status(page)).toHaveAttribute('data-state', 'credits_required');
  expect(backend.counts()).toEqual({ generations: 0, tokens: 0 }); await expect(cards(page)).toHaveCount(0);
  await page.locator('[data-round-jump="4"]').first().click(); await expect(page.locator('#replayRound-4')).toBeFocused();
});

test('lost response recovers only through result lookup with the exact request ID', async ({ page }) => {
  const backend = await server(page, { lostAcknowledgement: true }); await analyze(page);
  await page.locator('[data-review-api-generate]').click(); await expect(status(page)).toHaveAttribute('data-state', 'unknown');
  expect(backend.calls).toHaveLength(1); await expect(page.locator('[data-review-api-generate]')).toBeDisabled();
  await page.locator('[data-review-api-result]').click(); await expect(status(page)).toHaveAttribute('data-state', 'ready');
  expect(backend.calls.map(c => c.body.action)).toEqual(['generate', 'result']);
  expect(backend.calls[1].body.requestId).toBe(backend.calls[0].body.requestId); expect(backend.counts().generations).toBe(1);
});

test('logout and switching accounts remove cards, with request history isolated by account', async ({ page }) => {
  const backend = await server(page); await analyze(page); await page.locator('[data-review-api-generate]').click(); await expect(cards(page)).toHaveCount(2);
  await page.evaluate(() => window.setReviewTestUser(null)); await expect(status(page)).toHaveAttribute('data-state', 'signed_out'); await expect(cards(page)).toHaveCount(0);
  await page.evaluate(() => window.setReviewTestUser('bob')); await expect(status(page)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('[data-review-api-result]')).toBeDisabled(); await expect(cards(page)).toHaveCount(0);
  await page.evaluate(() => window.setReviewTestUser('alice')); await expect(status(page)).toHaveAttribute('data-state', 'recoverable');
  await page.locator('[data-review-api-result]').click(); await expect(cards(page)).toHaveCount(2); expect(backend.counts().generations).toBe(1);
});

test('a late completed response after logout never restores the old account cards', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const backend = await server(page, { hold }); await analyze(page); await page.locator('[data-review-api-generate]').click();
  await expect.poll(() => backend.counts().generations).toBe(1);
  await page.evaluate(() => window.setReviewTestUser('bob')); await expect(status(page)).toHaveAttribute('data-state', 'idle');
  release(); await expect(cards(page)).toHaveCount(0);
  await page.evaluate(() => window.setReviewTestUser('alice')); await expect(status(page)).toHaveAttribute('data-state', 'recoverable');
  await page.locator('[data-review-api-result]').click(); await expect(status(page)).toHaveAttribute('data-state', 'ready');
  expect(backend.counts().generations).toBe(1);
});

test('ordinary free replay does not load the HTTP client, purchase UI, session or controls', async ({ page }) => {
  const requests = []; page.on('request', r => { if (/replay-review-(api|client)|replay-credit-purchase/.test(r.url()) || /\/api\/replay-coaching-review/.test(r.url())) requests.push(r.url()); });
  await analyze(page, '?transport=api'); await expect(page.locator('[data-review-api-generate]')).toHaveCount(0);
  await expect(page.locator('[data-credit-purchase-open]')).toHaveCount(0); expect(requests).toEqual([]);
});

for (const width of [390, 1280]) test(`purchase preview discloses limits and conditional refunds without taking payments at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  const backend = await server(page, { paid: false });
  const financialRequests = [];
  page.on('request', request => { if (/\/api\/|tosspay|toss\.im|tosspayments/.test(request.url())) financialRequests.push(request.url()); });
  await analyze(page);
  const details = page.locator('[data-credit-purchase-details]');
  await expect(details).toBeHidden();
  await page.getByRole('button', { name: '구매 조건과 환불 안내 보기' }).click();
  await expect(details).toBeVisible();
  await expect(page.locator('[data-credit-purchase-open]')).toHaveAttribute('aria-expanded', 'true');
  await expect(details).toContainText('판매 예정 구성 · 실제 결제 준비 중');
  await expect(details.locator('.credit-product-preview')).toContainText('20회');
  await expect(details.locator('.credit-product-preview')).toContainText('3,300원');
  await expect(details).toContainText('하루 정상 분석 최대 5회');
  await expect(details).toContainText('365일 내 미사용분은 정상 제공 1회당 165원');
  await expect(details).toContainText('유효기간·보관 기간');
  await expect(details).toContainText('법령상 보장되는 소비자의 권리는 제한하지 않습니다');
  await expect(page.locator('[data-credit-purchase-pay]')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.credit-purchase').screenshot({ path: testInfo.outputPath('credit-purchase.png') });
  await page.locator('[data-credit-purchase-close]').focus();
  await page.keyboard.press('Enter');
  await expect(details).toBeHidden(); await expect(page.locator('[data-credit-purchase-open]')).toBeFocused();
  expect(financialRequests).toEqual([]); expect(backend.calls).toEqual([]);
  expect(backend.counts()).toEqual({ generations: 0, tokens: 0 });
});

test('purchase preview resets on account changes, cleans up on a new replay and never treats login as payment permission', async ({ page }) => {
  const backend = await server(page, { paid: false }); await analyze(page);
  const open = page.locator('[data-credit-purchase-open]'), details = page.locator('[data-credit-purchase-details]');
  await open.click(); await expect(page.locator('[data-credit-purchase-account]')).toContainText('현재 로그인한 계정');
  await page.locator('[data-credit-purchase-close]').focus();
  await page.evaluate(() => window.setReviewTestUser(null));
  await expect(details).toBeHidden(); await expect(open).toBeFocused();
  await open.click(); await expect(page.locator('[data-credit-purchase-account]')).toContainText('구매에는 로그인이 필요');
  await expect(page.locator('[data-credit-purchase-pay]')).toBeDisabled();
  await page.evaluate(() => window.setReviewTestUser('bob')); await expect(details).toBeHidden();
  await open.click(); await expect(page.locator('[data-credit-purchase-pay]')).toBeDisabled();
  await page.locator('#replayPlayer').selectOption('mate');
  await expect(open).toHaveCount(0); await page.locator('#analyzeReplayButton').click();
  await expect(open).toHaveCount(1); await expect(details).toBeHidden();
  await open.click(); await expect(details).toBeVisible(); expect(backend.calls).toEqual([]);
});

test('purchase preview refuses to mount on a production origin even with local preview flags', async ({ page }) => {
  await page.goto('/stats/sudden-attack/replay/');
  const count = await page.evaluate(async () => {
    const { mountReplayCreditPurchase } = await import('/stats/sudden-attack/replay/ui/replay-credit-purchase.js');
    const host = document.createElement('div'); document.body.append(host);
    const view = mountReplayCreditPurchase(host, { location: { origin: 'https://trackingsa.com', search: '?coaching=review&transport=api' }, getUser: () => { throw Error('must not read auth'); } });
    view.authChanged(); view.dispose(); const result = host.childElementCount; host.remove(); return result;
  });
  expect(count).toBe(0);
});

test('buying credits after a definite refusal permits one manual retry with the same request ID', async ({ page }) => {
  const backend = await server(page, { paid: false }); await analyze(page);
  await page.locator('[data-review-api-generate]').click(); await expect(status(page)).toHaveAttribute('data-state', 'credits_required');
  expect(backend.counts().generations).toBe(0); const requestId = backend.calls[0].body.requestId;
  seedCreditFixture(backend.db, 'alice'); // synthetic trusted purchase; no real deposit
  await page.locator('[data-review-api-generate]').click(); await expect(status(page)).toHaveAttribute('data-state', 'ready');
  expect(backend.calls[1].body.requestId).toBe(requestId); expect(backend.counts().generations).toBe(1);
  await expect(status(page)).toContainText('사용 가능한 AI 분석 1회');
  await page.locator('[data-review-api-result]').click(); await expect(status(page)).toHaveAttribute('data-state', 'ready');
  expect(backend.counts().generations).toBe(1);
});
