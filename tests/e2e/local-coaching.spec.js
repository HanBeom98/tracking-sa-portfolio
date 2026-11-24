import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { contextFixture } from '../fixtures/replay-context.js';
import { resetEmulators, installEmulatorBrowser, createAccount, login, password, firestoreBase } from './emulator-browser.js';

test.beforeEach(async ({ context }) => {
  await resetEmulators(); await installEmulatorBrowser(context);
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
});
async function tester(request, number) {
  // Unique UID per case avoids the old SDK/emulator deleted-document tombstone.
  const uid = `coaching-tester-${number}`;
  const email = 'coaching@example.test';
  const result = await request.post('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-demo-key', {
    headers: { Authorization: 'Bearer owner' }, data: { localId: uid, email, password } });
  expect(result.ok()).toBeTruthy(); return { uid, email };
}
async function analyze(page, player = 'focus', open = true, replay = contextFixture()) {
  if (open) await page.goto('/stats/sudden-attack/replay/?coaching=mock');
  await page.locator('#replayFile').setInputFiles({ name: 'local-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replay)) });
  await page.locator('#replayPlayer').selectOption(player);
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('[data-coaching-request]')).toBeVisible();
  await page.evaluate(() => window.ensureAuthRuntime?.());
}
const button = page => page.locator('[data-coaching-request]');
const status = page => page.locator('[data-coaching-status]');
async function used(request, uid) {
  const key = createHash('sha256').update(uid).digest('hex');
  const result = await request.get(`${firestoreBase}/_replay_coaching_users/${key}`, { headers: { Authorization: 'Bearer owner' } });
  expect(result.ok()).toBeTruthy(); return (await result.json()).fields.used.integerValue;
}
test('guest cannot send; real emulator login sends bounded evidence and duplicates do not consume twice', async ({ page, request }) => {
  const calls = []; page.on('request', req => { if (req.url().endsWith('/api/replay-coaching')) calls.push(req); });
  await analyze(page); await expect(status(page)).toContainText('로그인한 테스트'); await expect(button(page)).toBeDisabled(); expect(calls).toHaveLength(0);
  const account = await tester(request, 1); await login(page, account); await analyze(page);
  await expect(button(page)).toBeEnabled(); await button(page).click();
  await expect(status(page)).toContainText('확인 완료');
  await expect(page.locator('#replayCoachingPreview')).toContainText('로컬 서버에서 받은 모의 응답');
  expect(await used(request, account.uid)).toBe('1');
  const payload = calls[0].postDataJSON(); expect(Object.keys(payload).sort()).toEqual(['evidence', 'requestId']);
  expect(JSON.stringify(payload)).not.toMatch(/nexonSN|nickName|replay_info|coordinates/); expect(calls[0].headers().authorization).toMatch(/^Bearer /);
  await button(page).click(); await expect(status(page)).toContainText('추가 차감은 없습니다'); expect(await used(request, account.uid)).toBe('1');
  expect(calls[0].postDataJSON()).toEqual(calls[1].postDataJSON());
  await page.locator('#replayCoachingPreview [data-round-jump="2"]').click(); await expect(page.locator('#replayRound-2')).toBeFocused();
  await page.evaluate(() => window.auth.signOut()); await expect(status(page)).toContainText('로그인한 테스트');
  await expect(page.locator('#replayCoachingPreview')).not.toContainText('로컬 서버에서 받은 모의 응답');
});
test('a lost completed HTTP response recovers with the same ID and no second charge', async ({ page, request }) => {
  const account = await tester(request, 2); await login(page, account); await analyze(page);
  const bodies = []; let first = true;
  await page.route('**/api/replay-coaching', async route => {
    bodies.push(route.request().postDataJSON());
    if (first) { first = false; const result = await route.fetch(); expect(result.status()).toBe(200); await route.abort(); }
    else await route.continue();
  });
  await button(page).click(); await expect(status(page)).toContainText('자동 재요청은 하지 않습니다'); expect(await used(request, account.uid)).toBe('1');
  await button(page).click(); await expect(status(page)).toContainText('재표시할 수 없습니다');
  expect(bodies[0]).toEqual(bodies[1]); expect(await used(request, account.uid)).toBe('1');
  await expect(page.locator('.coaching-card')).toHaveCount(3); // local fallback remains available
});
test('real user quota blocks a third distinct analysis and leaves ordinary replay features usable', async ({ page, request }) => {
  const account = await tester(request, 3); await login(page, account); await analyze(page);
  for (const player of ['focus', 'mate', 'enemy1']) {
    await page.locator('#replayPlayer').selectOption(player);
    await expect(button(page)).toBeDisabled();
    await page.locator('#analyzeReplayButton').click(); await button(page).click();
    await expect(status(page)).toContainText(player === 'enemy1' ? '이용 기간 모의 사용 한도' : '확인 완료');
  }
  expect(await used(request, account.uid)).toBe('2'); await expect(button(page)).toBeDisabled();
  await page.locator('[data-round-filter="all"]').click(); await expect(page.locator('#replayRound-1')).toBeVisible();
});
test('non-allowlisted emulator user is rejected; disabled, pending and malformed API results are explained', async ({ page }) => {
  await login(page, await createAccount('not-allowed')); await analyze(page); await button(page).click();
  await expect(status(page)).toContainText('허용된 테스트 계정'); await expect(button(page)).toBeDisabled();
  for (const [code, error, text] of [[503, 'COACHING_DISABLED', '비활성'], [409, 'REQUEST_UNRESOLVED', '운영자 확인'],
    [403, 'ACCESS_EXPIRED', '만료'], [403, 'ACCESS_NOT_STARTED', '아직 시작'], [409, 'ACCESS_PERIOD_CONFLICT', '기존 기록과 충돌'],
    [200, null, '응답의 형식이나 근거']]) {
    await page.route('**/api/replay-coaching', route => route.fulfill({ status: code, json: { error } }));
    await analyze(page); await button(page).click(); await expect(status(page)).toContainText(text);
    await page.unroute('**/api/replay-coaching');
  }
});
test('reset during pending response suppresses old cards; a replacement replay is never overwritten', async ({ page, request }, testInfo) => {
  await login(page, await tester(request, 5)); await analyze(page);
  let release; const wait = new Promise(resolve => { release = resolve; }); let reached;
  const ready = new Promise(resolve => { reached = resolve; });
  await page.route('**/api/replay-coaching', async route => {
    const result = await route.fetch(); reached(); await wait;
    await route.fulfill({ response: result }).catch(() => {});
  });
  await button(page).click(); await ready; await expect(button(page)).toBeDisabled();
  await page.locator('#resetReplayButton').click(); await expect(page.locator('#replayResults')).toBeHidden();
  await analyze(page, 'mate', false); release();
  await expect(status(page)).toContainText('아직 서버에 전송하지 않았습니다');
  await expect(page.locator('#replayCoachingPreview')).not.toContainText('로컬 서버에서 받은 모의 응답');
  await page.unroute('**/api/replay-coaching');
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.locator('#color-change').click();
      await page.locator('#replayCoachingPreview').screenshot({ path: testInfo.outputPath(`replay-coaching-local-${width}-${theme}.png`), style: 'header { visibility: hidden !important; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.locator('#color-change').click();
  }
});
test('missing verified evidence disables the local API while round records remain available', async ({ page }) => {
  const calls = []; page.on('request', req => { if (req.url().endsWith('/api/replay-coaching')) calls.push(req); });
  const replay = contextFixture();
  for (const round of replay.replay_info.replayRoundInfo) round.replayCharacterInfo = [];
  await analyze(page, 'focus', true, replay);
  await expect(status(page)).toContainText('검증된 라운드가 없어'); await expect(button(page)).toBeDisabled();
  await expect(page.locator('#replayCoachingPreview .coaching-card')).toHaveCount(0);
  await expect(page.locator('#replayRound-1')).toBeVisible(); expect(calls).toHaveLength(0);
});
