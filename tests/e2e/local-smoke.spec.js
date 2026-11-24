import { test, expect } from "@playwright/test";
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { contextFixture } from '../fixtures/replay-context.js';
import { createDrawDetail } from '../fixtures/sa-draw-match.js';

test.beforeEach(async ({ context }) => {
  // Block Firebase, analytics, ads and every external service. No production reads or writes.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === "http://127.0.0.1:4173" ? route.continue() : route.abort();
  });
});

const measurementFixtureName = 'private-measurement-player';

async function revealSearchTools(page) {
  const toggle = page.locator('#searchToolsToggle');
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
}

async function openDrawFixture(page, theme, missingTeamIds = false) {
  const detail = createDrawDetail();
  if (missingTeamIds) detail.match_detail.forEach(player => delete player.team_id);
  await page.route('**/__draw-match/', route => route.fulfill({contentType:'text/html',body:`
    <!doctype html><html lang="ko" class="${theme==='dark'?'dark-mode':''}"><head><meta charset="utf-8">
    <link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/stats/sudden-attack/ui/style.css">
    <style>main{max-width:1100px;margin:24px auto;padding:0 12px;box-sizing:border-box}</style></head>
    <body class="${theme==='dark'?'dark-mode':''}"><main><sa-match-list></sa-match-list></main><script type="module">
    import {MatchRecord} from '/stats/sudden-attack/domain/match.js';
    import '/stats/sudden-attack/ui/components/match-list.js';
    const match=new MatchRecord(${JSON.stringify(detail)},'퀵매치 클랜전','Subject',{names:[],ouids:[]},{ouid:'local-subject',kill:16,death:13,result:'3'});
    match.context='public';document.querySelector('sa-match-list').matchRecords=[match];
    </script></body></html>`}));
  await page.goto('/__draw-match/');
  await expect(page.locator('.match-item.draw')).toBeVisible();
  await page.locator('.match-item.draw').click();
}

for (const width of [390,1280]) for (const theme of ['light','dark']) {
  test(`Old Town draw shows both six-player teams at ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await openDrawFixture(page,theme);
    await expect(page.locator('.result-badge')).toHaveText('무승부');
    await expect(page.locator('.score-team')).toHaveCount(2);
    await expect(page.getByRole('region',{name:'조회 선수 팀 · 무승부'}).locator('.score-player')).toHaveCount(6);
    await expect(page.getByRole('region',{name:'상대 팀 · 무승부'}).locator('.score-player')).toHaveCount(6);
    await expect(page.locator('.score-player')).toHaveCount(12);
    await expect(page.locator('.score-player.is-subject .kda')).toHaveText('16 / 13 / 6');
    await expect(page.locator('.unknown-team, .no-detail')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('a draw without team IDs still renders every participant without inventing sides',async({page})=>{
  await page.setViewportSize({width:390,height:900});
  await openDrawFixture(page,'dark',true);
  await expect(page.getByRole('region',{name:'전체 참가자 · 무승부'})).toBeVisible();
  await expect(page.locator('.score-team')).toHaveCount(1);
  await expect(page.locator('.score-player')).toHaveCount(12);
});

for (const width of [390, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`inline home CSS matches the external stylesheet at ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
      const html = await readFile(new URL('../../public/index.html', import.meta.url), 'utf8');
      const embeddedStyle = /<style id="home-shared-styles">[\s\S]*?<\/style>/;
      expect(html).toMatch(embeddedStyle);
      await page.route('**/__css-reference/', route => route.fulfill({ contentType: 'text/html',
        body: html.replace(embeddedStyle, '<link rel="stylesheet" href="/style.css">') }));
      await page.route('**/api/soop-live*', route => route.fulfill({ contentType: 'application/json',
        body: JSON.stringify({ status: 'ready', mode: 'page', page: 1, pageCount: 1, broadcasts: [] }) }));
      const appearance = () => page.evaluate(() => Object.fromEntries(
        ['header', '.home-hero', '#home-title', '.search-panel', '.hero-search', '.section', 'footer'].map(selector => {
          const el = document.querySelector(selector), box = el.getBoundingClientRect(), style = getComputedStyle(el);
          return [selector, { x: box.x, y: box.y, width: box.width, height: box.height,
            display: style.display, color: style.color, background: style.backgroundColor,
            font: style.font, padding: style.padding, position: style.position }];
        })));
      await page.goto('/__css-reference/');
      await expect(page.locator('#auth-login')).toBeVisible();
      const expected = await appearance();
      const cssRequests = [];
      page.on('request', request => { if (new URL(request.url()).pathname === '/style.css') cssRequests.push(request.url()); });
      await page.goto('/');
      await expect(page.locator('#auth-login')).toBeVisible();
      expect(await appearance()).toEqual(expected);
      expect(cssRequests).toEqual([]);
      await expect(page.locator('link[rel="stylesheet"][href^="/style.css"]')).toHaveCount(0);
      expect(await page.locator('input[name="n"]').evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
      if (width === 390) {
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.locator('#primary-navigation')).toBeVisible();
      }
      await page.locator('#color-change').click();
      await expect.poll(() => page.locator('html').evaluate(el => el.classList.contains('dark-mode'))).toBe(theme !== 'dark');
    });
  }
}

for (const asset of ['runtime-config.js', 'translations.js', 'common.js']) {
  test(`home renders its search before slow ${asset} and preserves initialization order`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(`**/${asset}*`, async route => { await gate; await route.continue(); });
    await page.route('**/api/soop-live*', route => {
      requests.push(new URL(route.request().url()).searchParams.get('page'));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'page', page: 1, pageCount: 1, broadcasts: [] }) });
    });
    try {
      await page.goto('/', { waitUntil: 'commit' });
      await expect(page.locator('#home-title')).toBeVisible();
      await expect(page.locator('input[name="n"]')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.readyState)).toBe('interactive');
      expect(requests).toEqual([]);
      await expect(page.locator('html')).toHaveClass(/dark-mode/);
    } finally {
      release();
    }
    await page.waitForLoadState('load');
    await expect(page.locator('[data-soop-live-root]')).toHaveAttribute('data-state', 'empty');
    expect(requests).toEqual(['1']);
    await expect(page.locator('#auth-controls').getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    await page.locator('#color-change').click();
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    expect(errors).toEqual([]);
  });
}

test('manual guide ad stays disabled in the production configuration and other page flows have no placement', async ({ page }) => {
  await page.addInitScript(() => { window.adsbygoogle = { push() { throw new Error('Disabled placement must not request an ad'); } }; });
  await page.goto('/guides/form-signal-report/');
  await expect(page.locator('[data-guide-ad]')).toBeHidden();
  await expect(page.locator('ins.adsbygoogle')).not.toHaveAttribute('data-guide-ad-requested', 'true');
  await expect(page.getByRole('heading', { name: '최근·이전 20경기의 승률과 킬뎃 비교', exact: true })).toBeVisible();
  for (const path of ['/stats/sudden-attack/', '/stats/sudden-attack/replay/', '/auth/signup/', '/board/']) {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  }
});

for (const width of [390, 1280]) {
  test(`manual guide ad requests once and hides unfilled inventory at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const runtime = await readFile(new URL('../../src/shared/infra/runtime-config.js', import.meta.url), 'utf8');
    expect(runtime).toContain('guideAdEnabled: false');
    await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'application/javascript', body: runtime.replace('guideAdEnabled: false', 'guideAdEnabled: true') }));
    await page.addInitScript(() => {
      window.__localAdRequests = 0;
      window.adsbygoogle = { push() {
        window.__localAdRequests++;
        const ad = document.querySelector('[data-guide-ad] ins');
        ad.dataset.adStatus = 'filled';
        ad.style.height = '90px';
      } };
    });
    await page.goto('/guides/form-signal-report/');
    const placement = page.locator('[data-guide-ad]');
    await expect(placement).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__localAdRequests)).toBe(1);
    expect(await placement.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.left >= 0 && r.right <= innerWidth && el.previousElementSibling.textContent.includes('출처와 적용 범위');
    })).toBe(true);
    await page.evaluate(async () => {
      const module = await import([...document.scripts].find(script => script.src.includes('/guides/guide-ad.js')).src);
      module.initializeGuideAd();
      document.querySelector('[data-guide-ad] ins').dataset.adStatus = 'unfilled';
    });
    await expect(placement).toBeHidden();
    expect(await page.evaluate(() => window.__localAdRequests)).toBe(1);
  });
}

test('manual guide ad initialization failure hides the placement without retries', async ({ page }) => {
  const runtime = await readFile(new URL('../../src/shared/infra/runtime-config.js', import.meta.url), 'utf8');
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'application/javascript', body: runtime.replace('guideAdEnabled: false', 'guideAdEnabled: true') }));
  await page.addInitScript(() => { window.__localAdRequests = 0; window.adsbygoogle = { push() { window.__localAdRequests++; throw new Error('Local SDK failure'); } }; });
  await page.goto('/guides/form-signal-report/');
  await expect.poll(() => page.evaluate(() => window.__localAdRequests)).toBe(1);
  await expect(page.locator('[data-guide-ad]')).toBeHidden();
  await page.evaluate(async () => {
    const module = await import([...document.scripts].find(script => script.src.includes('/guides/guide-ad.js')).src);
    module.initializeGuideAd();
  });
  expect(await page.evaluate(() => window.__localAdRequests)).toBe(1);
});
async function seedMeasurementProfile(context, stale = false) {
  await context.addInitScript(({ name, stale }) => {
    const stats = { totalMatchesCount: 0, winRate: 0, kdPercent: 0, radar: {} };
    const view = { matches: [], stats };
    localStorage.setItem('sa_cache_v2_public:' + name, JSON.stringify({ timestamp: stale ? 1 : Date.now(), data: {
      player: { nickname: name, ouid: 'private-measurement-ouid' }, matches: [], stats,
      viewContext: 'public', seasonViews: { current: view, previous: view },
    } }));
  }, { name: measurementFixtureName, stale });
}
async function mockMeasurementSdk(page, wait = Promise.resolve()) {
  await page.route('https://www.googletagmanager.com/gtag/js?**', async route => {
    await wait;
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.__measurementCommands = (window.dataLayer || []).map(args => Array.from(args));
      window.gtag = function () { window.__measurementCommands.push(Array.from(arguments)); };
    ` });
  });
}
async function mockZeroMatchNetwork(page) {
  await page.route('**/api/sa-proxy?**', route => {
    const endpoint = new URL(route.request().url()).searchParams.get('path');
    const body = endpoint.endsWith('/id') ? { ouid: 'private-measurement-ouid' }
      : endpoint.endsWith('/user/basic') ? { user_name: measurementFixtureName, character_name: measurementFixtureName }
      : endpoint.endsWith('/match') ? { match: [] } : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}
const recordedProductEvents = page => page.evaluate(() => (window.__measurementCommands || [])
  .filter(row => row[0] === 'event').map(row => ({ name: row[1], ...row[2] })));

async function openShareCard(page) {
  const panel = page.locator('#shareCardPanel');
  if (!await panel.evaluate(el => el.open)) await panel.locator('summary').click();
}

test('verification link marks the lazy SDK and real search on a locally served production origin then normal navigation clears it', async ({ page, context }) => {
  // The production hostname is simulated. Every response comes from the local build or a fixture.
  await page.route('https://trackingsa.com/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    if (pathname.startsWith('/api/') || !/\.(?:html|js|css|json|svg|png|webp|ico|woff2?)$/.test(pathname)) return route.abort();
    const root = new URL('../../public/', import.meta.url);
    const local = new URL('.' + pathname, root);
    if (!local.href.startsWith(root.href)) return route.abort();
    try { await route.fulfill({ path: fileURLToPath(local) }); } catch { await route.abort(); }
  });
  await seedMeasurementProfile(context); await mockMeasurementSdk(page);
  await page.goto('https://trackingsa.com/stats/sudden-attack/?measurement_scope=verification&n=' + measurementFixtureName);
  await page.locator('#characterName').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  const checked = await recordedProductEvents(page);
  expect(checked.every(e => e.traffic_scope === 'verification' && e.debug_mode === true)).toBe(true);
  expect(JSON.stringify(checked)).not.toContain('private-');
  const config = await page.evaluate(() => window.__measurementCommands.find(row => row[0] === 'config')[2]);
  expect(config).toMatchObject({ traffic_scope: 'verification', debug_mode: true, page_location: 'https://trackingsa.com/stats/sudden-attack/' });
  expect(await page.evaluate(() => sessionStorage.getItem('tracking_sa_measurement_scope_v1'))).toBeNull();
  await page.goto('https://trackingsa.com/stats/sudden-attack/?n=' + measurementFixtureName);
  await page.locator('#characterName').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  expect((await recordedProductEvents(page)).every(e => e.traffic_scope === 'production' && !Object.hasOwn(e, 'debug_mode'))).toBe(true);
  const normalConfig = await page.evaluate(() => window.__measurementCommands.find(row => row[0] === 'config')[2]);
  expect(Object.hasOwn(normalConfig, 'debug_mode')).toBe(false);
});

test('initial direct-link search uses the head client before delayed SDK readiness and counts zero-match results once', async ({ page, context }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await seedMeasurementProfile(context);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await mockMeasurementSdk(page, gate);
  try {
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName + '#private-fragment');
    await expect.poll(() => page.evaluate(() => window.trackingSaProductAnalytics?.getStatus().pending)).toBe(3);
    await expect(page.locator('#statsSummary')).toContainText('최근 0경기 기준');
    expect(await recordedProductEvents(page)).toEqual([]);
    await page.locator('#characterName').click(); release();
    await expect.poll(async () => (await recordedProductEvents(page)).length).toBe(3);
    const events = await recordedProductEvents(page);
    expect(events.map(e => e.name)).toEqual(['sa_search_start', 'sa_search_first_result', 'sa_search_finish']);
    expect(events[0].entry_point).toBe('direct_link');
    expect(events[1].result_source).toBe('fresh_cache');
    expect(events[2]).toMatchObject({ outcome: 'success', result_shown: 1, result_source: 'fresh_cache', revalidation: 'not_needed', traffic_scope: 'verification' });
    expect(JSON.stringify(events)).not.toContain('private-');
    await page.locator('[data-measurement-summary]').scrollIntoViewIfNeeded();
    await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_summary_view').length).toBe(1);
    await page.locator('.season-toggle-btn[data-mode="previous"]').click();
    await expect(page.locator('#statsSummary')).toContainText('최근 0경기 기준');
    expect((await recordedProductEvents(page)).filter(e => e.name === 'sa_search_start')).toHaveLength(1);
    expect((await recordedProductEvents(page)).filter(e => e.name === 'sa_search_first_result')).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('real stale-cache search finishes as partial when background proxy times out', async ({ page, context }) => {
  await seedMeasurementProfile(context, true); await mockMeasurementSdk(page);
  await page.route('**/api/sa-proxy?**', route => route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ code: 'REQUEST_TIMEOUT' }) }));
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
  await expect(page.locator('#statsSummary')).toContainText('최근 0경기 기준');
  await page.locator('#characterName').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  const events = await recordedProductEvents(page);
  expect(events.find(e => e.name === 'sa_search_first_result').result_source).toBe('stale_cache');
  expect(events.find(e => e.name === 'sa_search_finish')).toMatchObject({ outcome: 'partial', revalidation: 'failure', error_code: 'timeout', result_source: 'stale_cache', result_shown: 1 });
  await expect(page.locator('#searchBtn')).toBeEnabled();
});

test('real cold network search and forced refresh emit separate accepted attempts', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mockZeroMatchNetwork(page); await mockMeasurementSdk(page);
  await page.goto('/stats/sudden-attack/');
  await page.locator('#characterName').fill(measurementFixtureName); await page.locator('#searchBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  await page.locator('#refreshBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(2);
  const events = await recordedProductEvents(page);
  expect(events.filter(e => e.name === 'sa_search_start').map(e => e.entry_point)).toEqual(['input_button', 'refresh']);
  expect(events.filter(e => e.name === 'sa_search_finish').map(e => [e.outcome, e.result_source, e.revalidation])).toEqual([
    ['success', 'network', 'not_needed'], ['success', 'network', 'not_needed']]);
  expect(JSON.stringify(events)).not.toContain('private-'); expect(errors).toEqual([]);
});

test('real stale-cache revalidation success records a network finish with one first result', async ({ page, context }) => {
  await seedMeasurementProfile(context, true); await mockZeroMatchNetwork(page); await mockMeasurementSdk(page);
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
  await expect(page.locator('#searchBtn')).toBeEnabled(); await page.locator('#characterName').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  const events = await recordedProductEvents(page);
  expect(events.filter(e => e.name === 'sa_search_first_result')).toHaveLength(1);
  expect(events.find(e => e.name === 'sa_search_finish')).toMatchObject({ outcome: 'success', revalidation: 'success', result_source: 'network', result_shown: 1 });
});

test('favorite button and chip changes are measured after DOM updates even when persistence fails', async ({ page, context }) => {
  await seedMeasurementProfile(context); await mockMeasurementSdk(page);
  await context.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
  await expect(page.locator('#favoriteBtn')).toBeVisible(); await revealSearchTools(page); await page.locator('#favoriteBtn').click();
  await expect(page.locator('#favoriteBtn')).toHaveClass(/favorite-active/);
  await expect(page.locator('#favoriteSearches .chip-with-remove')).toHaveCount(1);
  await page.locator('#favoriteSearches .chip-remove').click();
  await expect(page.locator('#favoriteSearches .chip-with-remove')).toHaveCount(0);
  await expect(page.locator('#favoriteBtn')).not.toHaveClass(/favorite-active/);
  await revealSearchTools(page); await page.locator('#favoriteBtn').click(); await revealSearchTools(page); await page.locator('#favoriteBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_favorite_change').length).toBe(4);
  const events = await recordedProductEvents(page);
  expect(events.filter(e => e.name === 'sa_favorite_change').map(e => [e.action, e.action_source, e.persistence])).toEqual([
    ['add', 'result_button', 'unknown'], ['remove', 'favorite_chip', 'unknown'], ['add', 'result_button', 'unknown'], ['remove', 'result_button', 'unknown']]);
  expect(JSON.stringify(events)).not.toContain('private-');
});

test('modal and favorite-chip comparisons record current cached results without adding search attempts', async ({ page, context }, testInfo) => {
  await seedMeasurementProfile(context); await mockMeasurementSdk(page);
  await context.addInitScript(name => {
    const data = JSON.parse(localStorage.getItem('sa_cache_v2_public:' + name));
    data.data.player = { nickname: 'private-comparison-player', ouid: 'private-target-ouid' };
    localStorage.setItem('sa_cache_v2_public:private-comparison-player', JSON.stringify(data));
    localStorage.setItem('sa_favorite_searches', JSON.stringify(['private-comparison-player']));
  }, measurementFixtureName);
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
  await page.locator('#characterName').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_search_finish').length).toBe(1);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('#favoriteSearches .chip-compare')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('favorite-chip-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.locator('#compareBtn').click(); await page.locator('#vsTargetName').fill('private-comparison-player');
  await page.locator('#startVsBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_vs_finish').length).toBe(1);
  await expect(page.locator('#playerProfile')).toContainText('VS MODE');
  await revealSearchTools(page); await page.locator('#favoriteSearches .chip-compare').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_vs_finish').length).toBe(2);
  const events = await recordedProductEvents(page);
  expect(events.filter(e => e.name === 'sa_vs_finish').map(e => [e.vs_source, e.outcome, e.result_source])).toEqual([
    ['modal', 'success', 'fresh_cache'], ['favorite_chip', 'success', 'fresh_cache']]);
  expect(events.filter(e => e.name === 'sa_search_start')).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain('private-');
});

test('production runtime keeps a fresh public search and generated share image on the same origin', async ({ page, context }) => {
  const apiCalls = [], vercelCalls = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiCalls.push({ origin: url.origin, path: url.pathname });
    if (url.hostname.endsWith('.vercel.app')) vercelCalls.push(url.pathname);
  });
  await context.addInitScript(() => {
    window.__migrationShare = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async items => window.__migrationShare.push(items[0].types),
    } });
  });
  await page.route('**/api/sa-proxy?**', route => {
    const endpoint = new URL(route.request().url()).searchParams.get('path');
    const body = endpoint.endsWith('/id') ? { ouid: 'migration-fixture' }
      : endpoint.endsWith('/user/basic') ? { user_name: measurementFixtureName }
      : endpoint.endsWith('/user/rank') ? { grade: '훈련병' }
      : endpoint.endsWith('/match') ? { match: [] } : {};
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('**/api/sa-image?**', route => route.fulfill({ contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>' }));
  await page.goto('/stats/sudden-attack/');
  await page.locator('#characterName').fill(measurementFixtureName);
  await page.locator('#searchBtn').click();
  await expect(page.locator('#statsSummary')).toContainText('최근 0경기 기준');
  await openShareCard(page);
  await page.locator('#shareCardBtn').click();
  await expect.poll(() => page.evaluate(() => window.__migrationShare.length)).toBe(1);
  expect(await page.evaluate(() => window.__migrationShare[0])).toContain('image/png');
  expect(apiCalls.some(call => call.path === '/api/sa-proxy')).toBe(true);
  expect(apiCalls.some(call => call.path === '/api/sa-image')).toBe(true);
  expect(apiCalls.every(call => call.origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(vercelCalls).toEqual([]);
});

test('real card rendering and link copy record mocked clipboard completion without writing the system clipboard', async ({ page, context }) => {
  await seedMeasurementProfile(context); await mockMeasurementSdk(page);
  await context.addInitScript(() => {
    window.__shareFixture = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async items => {
        const activeAtRequest = navigator.userActivation.isActive;
        const png = await items[0].getType('image/png');
        window.__shareFixture.push({ method: 'image', types: items[0].types, activeAtRequest, size: png.size, type: png.type });
      },
      writeText: async text => window.__shareFixture.push({ method: 'link', url: text }),
    } });
  });
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
  await openShareCard(page);
  await page.locator('#shareCardBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_share_finish').length).toBe(1);
  await page.locator('#copyResultLinkBtn').click();
  await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_share_finish').length).toBe(2);
  expect((await recordedProductEvents(page)).filter(e => e.name === 'sa_share_finish').map(e => [e.method, e.outcome])).toEqual([
    ['clipboard_image', 'success'], ['clipboard_link', 'success']]);
  const calls = await page.evaluate(() => window.__shareFixture);
  expect(calls[0].types).toContain('image/png');
  expect(calls[0].activeAtRequest).toBe(true);
  expect(calls[0].type).toBe('image/png');
  expect(calls[0].size).toBeGreaterThan(0);
  expect(new URL(calls[1].url).searchParams.get('n')).toBe(measurementFixtureName);
  expect(JSON.stringify(await recordedProductEvents(page))).not.toContain('private-');
});

for (const outcome of ['success', 'cancelled', 'fallback']) {
  test(`mobile card share records mocked native ${outcome} with one start/finish`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedMeasurementProfile(context); await mockMeasurementSdk(page);
    await context.addInitScript(outcome => {
      window.__shareFixture = { calls: 0, downloads: 0, type: '', size: 0 };
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async value => {
        window.__shareFixture.calls++;
        window.__shareFixture.type = value.files[0].type; window.__shareFixture.size = value.files[0].size;
        if (outcome === 'cancelled') throw new DOMException('Cancelled', 'AbortError');
        if (outcome === 'fallback') throw new Error('Native sharing unavailable');
      } });
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download && this.href.startsWith('blob:')) { window.__shareFixture.downloads++; return; }
        return originalClick.call(this);
      };
    }, outcome);
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
    await openShareCard(page);
    await page.locator('#shareCardBtn').click();
    await expect.poll(async () => (await recordedProductEvents(page)).filter(e => e.name === 'sa_share_finish').length).toBe(1);
    const events = await recordedProductEvents(page);
    expect(events.filter(e => e.name === 'sa_share_start')).toHaveLength(1);
    expect(events.filter(e => e.name === 'sa_share_finish').map(e => [e.method, e.outcome])).toEqual([
      outcome === 'fallback' ? ['png_download', 'download_requested'] : ['native', outcome] ]);
    const calls = await page.evaluate(() => window.__shareFixture);
    expect(calls.calls).toBe(1); expect(calls.type).toBe('image/png'); expect(calls.size).toBeGreaterThan(0);
    expect(calls.downloads).toBe(outcome === 'fallback' ? 1 : 0);
    await expect(page.locator('#shareCardBtn')).toBeEnabled();
    await expect(page.locator('#shareCardStatus')).toContainText(outcome === 'cancelled' ? '취소했습니다' : outcome === 'fallback' ? '저장을 요청' : '공유를 완료');
    expect(JSON.stringify(events)).not.toContain('private-');
  });
}

for (const width of [390, 1280]) {
  test(`local share photo editing reaches the PNG and resets cleanly at ${width}px`, async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await seedMeasurementProfile(context);
    await context.addInitScript(() => {
      window.__photoPngs = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => {
        const blob = await items[0].getType('image/png');
        const image = await createImageBitmap(blob), canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        window.__photoPngs.push({ width: image.width, height: image.height,
          pixel: [...context.getImageData(60, 60, 1, 1).data], type: blob.type });
        image.close();
      } } });
    });
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
    await openShareCard(page);
    const imageData = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 1200;
      const context = canvas.getContext('2d'); context.fillStyle = '#e92a11'; context.fillRect(0, 0, 600, 1200);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    const input = page.locator('#shareProfileImageInput'), photo = page.locator('[data-share-profile-image]');
    await input.setInputFiles({ name: 'local-photo.png', mimeType: 'image/png', buffer: Buffer.from(imageData, 'base64') });
    await expect(photo).toBeVisible();
    await expect(page.locator('#shareProfileZoomValue')).toHaveText('100%');
    await expect(page.locator('#shareCardStatus')).toHaveText('이 사진은 현재 카드에만 적용됩니다.');
    await expect.poll(() => page.locator('#shareCardPreview .sa-share-card-inner').evaluate(el =>
      Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m11 - 1) < .000001)).toBe(true);
    const zoom = async value => page.locator('#shareProfileZoom').evaluate((el, value) => {
      el.value = String(value); el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await zoom(150);
    const frame = page.locator('[data-share-profile-frame]'); await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox(), before = await photo.evaluate(el => el.style.top);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20);
    await page.mouse.up();
    expect(await photo.evaluate(el => el.style.top)).not.toBe(before);
    await page.locator('#resetShareProfilePositionBtn').click();
    await expect(page.locator('#shareProfileZoomValue')).toHaveText('100%');
    await zoom(50);
    expect(await photo.evaluate(el => el.clientWidth < el.parentElement.clientWidth)).toBe(true);
    await zoom(150);
    await page.locator('#shareCardBtn').click();
    await expect.poll(() => page.evaluate(() => window.__photoPngs.length)).toBe(1);
    expect(await page.evaluate(() => window.__photoPngs[0])).toEqual({ width: 1080, height: 675, type: 'image/png', pixel: [233, 42, 17, 255] });
    await input.setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
    await expect(page.locator('#shareCardStatus')).toHaveText('올바른 이미지 파일을 선택해 주세요.');
    await expect(photo).toBeVisible();
    await page.locator('#resetShareProfileImageBtn').click();
    await expect(photo).toBeHidden(); await expect(page.locator('#shareProfileAdjustments')).toBeHidden();
    await page.locator('#shareCardBtn').click();
    await expect.poll(() => page.evaluate(() => window.__photoPngs.length)).toBe(2);
    expect(await page.evaluate(() => window.__photoPngs[1].pixel)).not.toEqual([233, 42, 17, 255]);
    expect(errors).toEqual([]);
  });
}

for (const [width, theme] of [[320, 'light'], [390, 'dark']]) {
  test(`mobile public search surfaces its input and core result metrics at ${width}px in ${theme}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 780 });
    await seedMeasurementProfile(context);
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.goto('/stats/sudden-attack/');
    const input = page.locator('#characterName');
    const search = page.locator('#searchBtn');
    const inputBox = await input.boundingBox();
    const searchBox = await search.boundingBox();
    expect(inputBox.y).toBeLessThan(215);
    expect(Math.abs(inputBox.y - searchBox.y)).toBeLessThan(2);
    expect(searchBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('.sa-discovery-strip span').evaluateAll(elements =>
      elements.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('search-first-screen.png') });

    await page.evaluate(name => {
      const key = 'sa_cache_v2_public:' + name;
      const cached = JSON.parse(localStorage.getItem(key));
      Object.assign(cached.data.seasonViews.current.stats, { totalMatchesCount: 8, winRate: 62.5, kdPercent: 56 });
      localStorage.setItem(key, JSON.stringify(cached));
    }, measurementFixtureName);
    await input.fill(measurementFixtureName);
    await search.click();
    const meta = page.locator('#resultsMeta');
    await expect(meta.getByRole('heading')).toHaveText(measurementFixtureName);
    await expect(meta).toContainText('Tracking SA 집계');
    await expect(meta.locator('.sa-result-metrics dd')).toHaveText(['62.5%', '56%', '8경기']);
    await expect(page.locator('#loading')).toBeHidden();
    const resultBox = await meta.boundingBox();
    expect(resultBox.y + resultBox.height).toBeLessThan(460);
    expect(Math.abs((await input.boundingBox()).y - (await search.boundingBox()).y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const share = page.locator('#shareCardPanel');
    await expect(share.locator('summary')).toHaveText('전적 공유');
    expect(await share.evaluate(el => el.open)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('results-first-screen.png') });
  });
}

test('public result groups profile and KPIs, keeps sharing expandable and restores accessible VS focus', async ({ page, context }) => {
  await seedMeasurementProfile(context);
  for (const width of [390, 402, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
    await expect(page.locator('#statsSummary .quick-kpi').first()).toBeVisible();
    await expect(page.locator('#resultsMeta .sa-result-metrics dd')).toHaveText(['—', '—', '0경기']);
    expect(await page.locator('#shareCardPanel').evaluate(el => el.open)).toBe(false);
    // Font/layout completion can occur between separate boundingBox calls in CI.
    // Check the actual ordering together in one frame, retaining the no-overlap requirement.
    await expect.poll(() => page.evaluate(() => {
      const profile = document.querySelector('#playerProfile').getBoundingClientRect();
      const navigation = document.querySelector('#resultNavigation').getBoundingClientRect();
      const kpi = document.querySelector('#statsSummary .quick-kpi').getBoundingClientRect();
      return { profileBeforeTabs: profile.bottom <= navigation.top,
        tabsBeforeKpis: navigation.bottom <= kpi.top,
        fitsViewport: document.documentElement.scrollWidth <= innerWidth + 1 };
    })).toEqual({ profileBeforeTabs: true, tabsBeforeKpis: true, fitsViewport: true });
    await openShareCard(page); await expect(page.locator('#shareCardPreview')).toBeVisible();
    await page.locator('#shareCardPanel summary').click();
    await revealSearchTools(page); await page.locator('#favoriteBtn').click();
    for (const cls of ['chip-compare','chip-remove']) {
      const box=await page.locator('#favoriteSearches .' + cls).first().boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#compareBtn').click();
    await expect(page.getByRole('dialog', { name:'상대방 전적 비교', exact:false })).toBeVisible();
    await expect(page.getByRole('textbox',{name:'비교할 캐릭터명',exact:true})).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.locator('#closeVsModalBtn')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('#vsTargetName')).toBeFocused();
    await page.keyboard.press('Escape'); await expect(page.locator('#compareBtn')).toBeFocused();
    await revealSearchTools(page); await page.locator('#favoriteBtn').click();
  }
});

test('pending clipboard offers explicit PNG recovery without duplicate completion or late status overwrite', async ({ page, context }) => {
  await seedMeasurementProfile(context);await mockMeasurementSdk(page);
  await context.addInitScript(() => {
    window.__pendingRecovery={writes:0,downloads:0};
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:()=>{window.__pendingRecovery.writes++;return new Promise(resolve=>{window.__releasePendingCopy=resolve;});}}});
    const original=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){window.__pendingRecovery.downloads++;return;}return original.call(this);};
  });
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);await openShareCard(page);
  await page.locator('#shareCardBtn').click();
  await expect(page.locator('#downloadShareImageBtn')).toBeVisible({timeout:12000});
  expect((await recordedProductEvents(page)).filter(e=>e.name==='sa_share_finish')).toHaveLength(0);
  await page.locator('#downloadShareImageBtn').click();
  const message=await page.locator('#shareCardStatus').innerText();
  expect(message).toContain('저장을 요청');await expect(page.locator('#shareCardBtn')).toBeDisabled();
  await page.evaluate(()=>window.__releasePendingCopy());
  await expect(page.locator('#shareCardBtn')).toBeEnabled();
  await expect(page.locator('#shareCardStatus')).toHaveText(message);
  expect(await page.evaluate(()=>window.__pendingRecovery)).toEqual({writes:1,downloads:1});
  const finishes=(await recordedProductEvents(page)).filter(e=>e.name==='sa_share_finish');
  expect(finishes.map(e=>[e.method,e.outcome])).toEqual([['png_download','download_requested']]);
});

test('share action label follows viewport changes without extra rendering or network', async ({ page, context }) => {
  await page.setViewportSize({width:390,height:844});await seedMeasurementProfile(context);
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);await openShareCard(page);
  await expect(page.locator('#shareCardBtn')).toHaveText('공유하기');
  await page.setViewportSize({width:844,height:390});await expect(page.locator('#shareCardBtn')).toHaveText('이미지 복사');
  await page.setViewportSize({width:390,height:844});await expect(page.locator('#shareCardBtn')).toHaveText('공유하기');
});

test('unresolved font and decorative rank image do not leave card generation pending or trigger automatic retries', async ({ page, context }) => {
  await seedMeasurementProfile(context);await mockMeasurementSdk(page);
  await context.addInitScript(name=>{
    const data=JSON.parse(localStorage.getItem('sa_cache_v2_public:'+name));
    data.data.player.rankImage='https://open.api.nexon.com/static/suddenattack/img/'+'a'.repeat(32);
    localStorage.setItem('sa_cache_v2_public:'+name,JSON.stringify(data));
    Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise(()=>{})}});
    window.__imageCopies=0;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{window.__imageCopies++;}}});
  },measurementFixtureName);
  let release;const gate=new Promise(resolve=>{release=resolve;});let requests=0;
  await page.route('**/sa-image?**',async route=>{requests++;await gate;await route.abort().catch(()=>{});});
  try {
    await page.goto('/stats/sudden-attack/?n='+measurementFixtureName);await openShareCard(page);
    await page.locator('#shareCardBtn').click();
    await expect(page.locator('#shareCardStatus')).toContainText('이미지를 복사했습니다',{timeout:14000});
    await expect(page.locator('#shareCardBtn')).toBeEnabled();
    expect(requests).toBe(1);expect(await page.evaluate(()=>window.__imageCopies)).toBe(1);
    expect((await recordedProductEvents(page)).filter(e=>e.name==='sa_share_finish').map(e=>e.outcome)).toEqual(['success']);
  } finally {release();}
});

test('product measurement queues until the local SDK fixture loads and emits sanitized events once', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('https://www.googletagmanager.com/gtag/js?**', async route => {
    await gate;
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.__measurementCommands = (window.dataLayer || []).map(args => Array.from(args));
      window.gtag = function () { window.__measurementCommands.push(Array.from(arguments)); };
    ` });
  });
  await page.goto('/stats/sudden-attack/');
  const queued = await page.evaluate(async () => {
    const { initializeAnalytics } = await import(document.querySelector('script[src*="/analytics-loader.js"]').src);
    const client = initializeAnalytics(window, document);
    history.pushState({}, '', '?n=private-test-value#private-fragment');
    const context = client.createContext();
    const accepted = client.track('sa_search_start', { entry_point: 'direct_link', nickname: 'private-test-value' }, context);
    const duplicate = client.track('sa_search_start', { entry_point: 'direct_link' }, context);
    return { accepted, duplicate, pending: client.getStatus().pending };
  });
  expect(queued).toEqual({ accepted: true, duplicate: false, pending: 1 });
  try {
    await page.locator('#characterName').click();
    release();
    await expect.poll(() => page.evaluate(() => (window.__measurementCommands || []).filter(row => row[0] === 'event').length)).toBe(1);
    const commands = await page.evaluate(() => window.__measurementCommands);
    const events = commands.filter(row => row[0] === 'event');
    expect(events[0][1]).toBe('sa_search_start');
    expect(events[0][2]).toMatchObject({ measurement_version: 'v1', traffic_scope: 'verification', page_location: 'http://127.0.0.1:4173/stats/sudden-attack/', page_title: '서든어택 전적 검색 | Tracking SA', send_to: 'G-PORTFOLIO' });
    expect(JSON.stringify(events)).not.toContain('private-');
    expect(commands.filter(row => row[0] === 'config')).toHaveLength(1);
    await expect(page.locator('#searchBtn')).toBeEnabled();
  } finally { release(); }
});

test('blocked measurement SDK drops queued events and leaves the real search controls usable', async ({ page }) => {
  await page.goto('/stats/sudden-attack/');
  await page.evaluate(async () => {
    const { initializeAnalytics } = await import(document.querySelector('script[src*="/analytics-loader.js"]').src);
    const client = initializeAnalytics(window, document);
    client.track('sa_search_start', { entry_point: 'input_button' }, client.createContext());
  });
  await page.locator('#characterName').click();
  await expect.poll(() => page.evaluate(async () => {
    const { initializeAnalytics } = await import(document.querySelector('script[src*="/analytics-loader.js"]').src);
    return initializeAnalytics(window, document).getStatus().disabled;
  })).toBe(true);
  const status = await page.evaluate(async () => {
    const { initializeAnalytics } = await import(document.querySelector('script[src*="/analytics-loader.js"]').src);
    return initializeAnalytics(window, document).getStatus();
  });
  expect(status).toMatchObject({ pending: 0, sent: 0, dropped: 1 });
  await expect(page.locator('#characterName')).toBeEnabled();
  await expect(page.locator('#searchBtn')).toBeEnabled();
});

test("local home links to the published stats page and renders its search controls", async ({ page }) => {
  await page.goto("/");
  const statsLink = page.locator('a[href="/stats/sudden-attack/"]').first();
  await expect(statsLink).toBeVisible();
  await statsLink.click();
  await expect(page).toHaveURL(/\/stats\/sudden-attack\/$/);
  await expect(page.locator("h1")).toContainText("서든어택 전적 검색");
  await expect(page.locator("#characterName")).toBeVisible();
  await expect(page.locator("#searchBtn")).toBeVisible();
  await expect(page.locator("#resultsShell")).toBeHidden();
});

test("local replay entry executes its modules and rejects an invalid file", async ({ page }) => {
  await page.goto("/stats/sudden-attack/replay/");
  await expect(page.locator("#replayFileStatus")).toContainText("아직 선택한 파일이 없습니다");
  await page.locator("#replayFile").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{") });
  await expect(page.locator("#replayFileStatus")).toHaveAttribute("role", "alert");
  await expect(page.locator("#playerStep")).toBeHidden();
});

for (const width of [390, 1280]) {
  test(`replay context shows verified situations and withholds incomplete rounds at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const apiRequests = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.goto('/stats/sudden-attack/replay/');
    const fixture = contextFixture(); // An old synthetic match skips the existing OpenAPI forecast.
    const analyze = async () => {
      await page.locator('#replayFile').setInputFiles({ name: 'context.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(fixture)) });
      await expect(page.locator('#playerStep')).toBeVisible();
      await page.locator('#replayPlayer').selectOption('focus');
      await page.locator('#analyzeReplayButton').click();
      await expect(page.locator('#replayInsights')).toBeVisible();
    };
    await analyze();
    const insights = page.locator('#replayInsights');
    await expect(insights).toContainText('상황 기록 확인: 2/2개 라운드.');
    for (const title of ['첫 사망 장면 복기', '교환킬 후보', '혼자 남은 상황']) {
      await expect(insights.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    await expect(insights).toContainText('0.6초 뒤');
    await expect(insights).toContainText('1대2 상황');
    await page.getByRole('button', { name: '2라운드 기록 보기', exact: true }).click();
    await expect(page.locator('#replayRound-2')).toBeFocused();
    await page.getByRole('button', { name: '사망 장면 분석', exact: true }).click();
    await expect(page.locator('#replayDetail')).toContainText('당시 생존 인원은 3대3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await insights.screenshot({ path: testInfo.outputPath('replay-context.png') });
    await page.locator('#color-change').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    fixture.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin = 1;
    await analyze();
    await expect(insights).toContainText('상황 기록 확인: 1/2개 라운드.');
    await expect(insights).toContainText('판정을 보류합니다.');
    await expect(insights.getByRole('heading', { name: '첫 사망 장면 복기', exact: true })).toHaveCount(0);
    await expect(insights).toContainText('1/2개 라운드 기준');
    expect(apiRequests).toEqual([]);
  });
}

test('proxy timeout and throttling keep search retryable without a missing-player message', async ({ page }) => {
  let status = 504;
  await page.route('**/api/sa-proxy?**', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ code: status === 504 ? 'REQUEST_TIMEOUT' : 'HTTP_ERROR' }) }));
  await page.goto('/stats/sudden-attack/');
  await page.locator('#characterName').fill('로컬테스트');
  await page.locator('#searchBtn').click();
  await expect(page.locator('#searchErrorMessage')).toContainText('대기 시간이 초과');
  await expect(page.locator('#searchError')).not.toContainText('닉네임을 확인한 뒤');
  await expect(page.locator('#characterName')).toHaveValue('로컬테스트');
  await expect(page.locator('#searchBtn')).toBeEnabled();
  status = 429;
  await page.locator('#searchBtn').click();
  await expect(page.locator('#searchErrorMessage')).toContainText('요청이 많아');
  await expect(page.locator('#searchErrorTitle')).not.toContainText('캐릭터를 찾을 수 없습니다');
  await expect(page.locator('#searchBtn')).toBeEnabled();
});

test('SOOP proxy timeout replaces the loading placeholder with recoverable guidance', async ({ page }) => {
  await page.route('**/api/soop-live*', route => route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ status: 'error', broadcasts: [] }) }));
  await page.goto('/');
  await expect(page.locator('[data-soop-live-root]')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('[data-soop-live-grid]')).toContainText('응답 대기 시간이 초과');
});

test("local guide navigation reaches a complete maintained guide", async ({ page }) => {
  await page.goto("/guides/");
  const guide = page.locator('a[href="/guides/sudden-attack-stats-guide/"]').first();
  await expect(guide).toBeVisible();
  await guide.click();
  await expect(page).toHaveURL(/\/guides\/sudden-attack-stats-guide\/$/);
  await expect(page.locator("h1")).toContainText("서든어택");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
});

test("desktop and mobile primary navigation reach guides without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    if (viewport.width < 900) {
      await page.locator('.mobile-menu-toggle').click();
      await expect(page.locator('.mobile-menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('#primary-navigation a[href="/guides/"]').click();
    await expect(page).toHaveURL(/\/guides\/$/);
    await expect(page.getByRole('heading', { name: '필요한 정보로, 바로.', level: 1, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("home analysis links and keyword search reach the existing worked examples", async ({ page }) => {
  await page.goto('/');
  const home = page.locator('#content-guides');
  await expect(home.locator('a[href="/guides/"]')).toBeVisible();
  await expect(home.locator('a[href="/guides/form-signal-report/"]')).toBeVisible();
  await expect(home.locator('a[href="/guides/vs-comparison-guide/"]')).toBeVisible();
  await home.locator('a[href="/guides/map-sample-report/"]').click();
  await expect(page.locator('h1')).toContainText('맵별 승률과 맵 편중');
  await expect(page.locator('table')).toHaveCount(2);
  await page.goto('/search/?q=' + encodeURIComponent('킬뎃'));
  const example = page.locator('#searchPageResults a[href="/guides/form-signal-report/"]');
  await expect(example).toContainText('승률과 킬뎃 비교');
  await example.click();
  await expect(page.getByRole('heading', {name:'실제 조회 사례: 같은 닉네임의 수치가 다른 이유'})).toBeVisible();
});

test("Korean search finds the existing English titles and keeps English queries working", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lang", "en"));
  await page.goto('/search/?q=' + encodeURIComponent('서든어택'.normalize('NFD')));
  const stats = page.locator('#searchPageResults a[href="/stats/sudden-attack/"]');
  await expect(stats).toBeVisible();
  await expect(stats.locator('.result-title')).toHaveText('Sudden Attack Stats');
  await page.locator('#searchPageInput').fill('ＳＵＤＤＥＮ　ＡＴＴＡＣＫ');
  await page.locator('#searchPageButton').click();
  await expect(stats).toBeVisible();
  await page.locator('#searchPageInput').fill('서든 어택 리그');
  await page.locator('#searchPageButton').click();
  await expect(page.locator('#searchPageResults a[href="/stats/sudden-attack/league/"]')).toContainText('Sudden Attack League Hub');
  await expect(stats).toHaveCount(0);
});

test("search includes descriptions and enforces the minimum after Hangul normalization", async ({ page }) => {
  await page.goto('/search/');
  await page.locator('#searchPageInput').fill('purpose');
  await page.locator('#searchPageButton').click();
  await expect(page.locator('#searchPageResults a[href="/about/"]')).toBeVisible();
  await page.locator('#searchPageInput').fill('가'.normalize('NFD'));
  await page.locator('#searchPageButton').click();
  await expect(page.locator('#searchSummary')).toContainText('2글자 이상');
  await expect(page.locator('#searchPageResults a')).toHaveCount(0);
});

test('paged SOOP cards preserve late interval priority, partial results and mobile disclosure', async ({ page }) => {
  const errors = [], requested = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript',
    body: "window.runtimeConfig = { apiBaseUrl: '/api', soopLiveMode: 'paged' };" }));
  await page.route('**/api/soop-live?*', route => {
    const pageNo = Number(new URL(route.request().url()).searchParams.get('page'));
    requested.push(pageNo);
    if (pageNo === 2) return route.fulfill({ status: 503, body: 'unavailable' });
    const broadcasts = pageNo === 1
      ? Array.from({ length: 12 }, (_, index) => ({ id: String(index), streamerId: 'fixture', title: `방송 ${index}`, streamerName: `스트리머 ${index}`, viewerCount: 1000 - index }))
      : [{ id: 'late', streamerId: 'late', title: 'Interval 마지막 페이지 <script>', streamerName: '우선 방송', viewerCount: 1 }];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'page', page: pageNo, pageCount: 3, broadcasts }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('[data-soop-live-root]')).toHaveAttribute('data-state', 'ready');
  const cards = page.locator('[data-soop-live-grid] .live-card');
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toContainText('Interval 마지막 페이지 <script>');
  await expect(cards.first()).toHaveAttribute('href', 'https://play.sooplive.com/late/late');
  await expect(page.locator('[data-soop-live-grid] script')).toHaveCount(0);
  await expect(page.locator('[data-soop-live-toggle]')).toHaveText('방송 더 보기 (9)');
  await page.locator('[data-soop-live-toggle]').click();
  await expect(page.locator('[data-soop-live-root]')).toHaveAttribute('data-expanded', 'true');
  expect(requested.sort()).toEqual([1, 2, 3]);
  expect(errors).toEqual([]);
});

test("blocked browser storage preserves shell interactions and the stats page", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(window, name, {
      configurable: true, get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark-mode/);
  await expect(page.locator("body")).toHaveClass(/dark-mode/);
  await page.locator("#color-change").click();
  await expect(page.locator("html")).not.toHaveClass(/dark-mode/);
  await expect(page.locator("body")).not.toHaveClass(/dark-mode/);
  await page.goto("/stats/sudden-attack/");
  await expect(page.locator("#characterName")).toBeVisible();
  await expect(page.locator("#searchBtn")).toBeVisible();
  expect(errors).toEqual([]);
});

test("full browser storage keeps recent and favorite controls usable in the current page", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException("Storage full", "QuotaExceededError"); };
    Storage.prototype.removeItem = function () { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await page.goto("/stats/sudden-attack/");
  await expect(page.locator("#searchBtn")).toBeVisible();
  const state = await page.evaluate(async () => {
    const helpers = await import("/stats/sudden-attack/ui/utils/ui-helpers.js");
    helpers.saveSearch("quota-recent", "Tracking");
    helpers.toggleFavoriteSearch("quota-favorites", "Tracking");
    helpers.renderFavoriteSearches(document.querySelector("#favoriteSearches"), "quota-favorites", () => {});
    return { recent: helpers.getRecentSearches("quota-recent"), favorites: helpers.getFavoriteSearches("quota-favorites") };
  });
  expect(state).toEqual({ recent: ["Tracking"], favorites: ["Tracking"] });
  await expect(page.locator("#favoriteSearches")).toContainText("Tracking");
  await page.locator("#color-change").click();
  await expect(page.locator("body")).not.toHaveClass(/dark-mode/);
  expect(errors).toEqual([]);
});

for (const width of [390, 1280]) {
  test(`public loads shared components only and league keeps ranking, charts and balancing at ${width}px`, async ({ page, context }) => {
    const errors = [], requested = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requested.push(new URL(request.url()).pathname));
    await page.setViewportSize({ width, height: 844 });
    await seedMeasurementProfile(context);
    const shared = ['player-card', 'stats-summary', 'radar-chart', 'synergy-view', 'match-list'];
    const league = ['mmr-trend-chart', 'map-mastery', 'crew-mvps', 'crew-highlights', 'team-board', 'crew-ranking'];
    const registry = names => page.evaluate(names => names.map(name => Boolean(customElements.get('sa-' + name))), names);
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
    await expect(page.locator('#statsSummary .quick-kpi').first()).toBeVisible();
    expect(await registry(shared)).toEqual(shared.map(() => true));
    expect(await registry(league)).toEqual(league.map(() => false));
    expect(requested.filter(path => league.some(name => path.endsWith('/ui/components/' + name + '.js')))).toEqual([]);
    await expect(page.locator('#statsSummary sa-radar-chart svg')).toHaveCount(1);
    await page.locator('#statsSummary sa-synergy-view').evaluate(el => {
      el.data = { bestPartner: { nickname: 'FixturePartner', total: 3, winRate: 67 } };
    });
    await expect(page.locator('#statsSummary sa-synergy-view .rel-name')).toHaveText('FixturePartner');
    // Read-only local DB fixture drives the real league dashboard and balancer entry point.
    await page.addInitScript(() => {
      const members = ['FixtureOne', 'FixtureTwo'].map((characterName, i) => ({ id: 'fixture-' + i,
        data: () => ({ characterName, mmr: 1200, hsr: 1200, wins: 0, loses: 0, mmrHistory: [] }) }));
      window.db = { collection(name) { return {
        orderBy() { return this; }, limit() { return this; },
        get: async () => ({ docs: name === 'sa_crew_members' ? members : [] }),
        doc: () => ({ get: async () => ({ exists: true, data: () => ({ startDate: { toDate: () => new Date('2026-01-01') } }) }) }),
      }; } };
      window.__leagueClipboard = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true,
        value: { writeText: async value => window.__leagueClipboard.push(value) } });
    });
    // The blocked external SDK would otherwise clear the local DB fixture during bootstrap.
    await page.route('**/firebase-config.js*', route => route.fulfill({
      contentType: 'text/javascript', body: '// Read-only DB fixture installed by the test.'
    }));
    requested.length = 0;
    await page.goto('/stats/sudden-attack/league/');
    await expect(page.locator('sa-crew-ranking .clickable-name')).toHaveCount(2);
    expect(await registry([...shared, ...league])).toEqual([...shared, ...league].map(() => true));
    for (const name of league) expect(requested.filter(path => path.endsWith('/ui/components/' + name + '.js'))).toHaveLength(1);
    await expect(page.locator('sa-crew-ranking')).toContainText('FixtureOne');
    await expect(page.locator('sa-crew-ranking')).toContainText('FixtureTwo');
    await page.locator('#balancerBtn').click();
    const members = page.locator('#balancerMemberList input[type="checkbox"]');
    await expect(members).toHaveCount(2);
    await members.nth(0).check(); await members.nth(1).check();
    await page.locator('#calculateBalanceBtn').click();
    await expect(page.locator('sa-team-board')).toContainText('FixtureOne');
    await expect(page.locator('sa-team-board')).toContainText('FixtureTwo');
    await page.locator('sa-team-board .copy-btn').click();
    expect(await page.evaluate(() => window.__leagueClipboard[0])).toContain('FixtureOne');
    await page.locator('#closeBalancerBtn').click();
    await page.evaluate(() => {
      const card = document.createElement('sa-stats-summary'); card.id = 'league-chart-fixture'; document.body.append(card);
      card.stats = { context: 'league', isCrew: true, totalMatchesCount: 0, radar: {}, crewMmr: 1200, crewHsr: 1200,
        mmrTrend: [], mapStats: [{ name: 'FixtureMap', total: 2, wins: 1, winRate: 50 }] };
    });
    await expect(page.locator('#league-chart-fixture sa-mmr-trend-chart')).toContainText('1200 MMR');
    await expect(page.locator('#league-chart-fixture sa-map-mastery')).toContainText('FixtureMap');
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 1280]) for (const theme of ['light', 'dark']) {
  test(`public search view preserves category, pagination, loading and comparison flows at ${width}px ${theme}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const expectResultsToFit = async () => {
      const layout = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth <= innerWidth,
        results: document.getElementById('resultsShell').scrollWidth <= document.getElementById('resultsShell').clientWidth,
        overflow: [...document.querySelectorAll('#resultsShell *')].filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).position !== 'absolute').slice(0, 12).map(el => ({ tag: el.tagName, class: el.className, width: el.clientWidth, scroll: el.scrollWidth }))
      }));
      expect({ page: layout.page, results: layout.results }, JSON.stringify(layout.overflow)).toEqual({ page: true, results: true });
    };
    // Run the real view and custom elements with deferred local callbacks, without provider APIs.
    await page.route('**/stats/sudden-attack/home-main.js*', route => route.fulfill({
      contentType: 'text/javascript', body: "import '/stats/sudden-attack/ui/components/register-common.js';"
    }));
    await page.goto('/stats/sudden-attack/');
    const names = await page.evaluate(async () => {
      await Promise.all(['sa-player-card', 'sa-match-list', 'sa-stats-summary'].map(tag => customElements.whenDefined(tag)));
      const { createPublicSearchView } = await import('/stats/sudden-attack/ui/runtime/public-search-view.js');
      const ids = { searchInput: 'characterName', resetBtn: 'resetSearchBtn',
        recentSearchesContainer: 'recentSearches', favoriteSearchesContainer: 'favoriteSearches',
        profileSection: 'playerProfile', statsSection: 'statsSummary', historySection: 'matchHistory' };
      const keys = ['searchInput', 'searchBtn', 'refreshBtn', 'compareBtn', 'favoriteBtn', 'resetBtn',
        'loading', 'loadingText', 'recentSearchesContainer', 'favoriteSearchesContainer', 'searchGuide',
        'profileSection', 'statsSection', 'historySection', 'swrStatus', 'resultsShell', 'resultsMeta'];
      const elements = Object.fromEntries(keys.map(key => [key, document.getElementById(ids[key] || key)]));
      const name = 'Tracking <b data-injected="yes">위장닉</b> & "별칭"';
      const label = '파티 <i data-injected="yes">기록</i> & 최근';
      const match = id => ({ matchId: id, matchResult: 'WIN', matchTypeName: '파티랭크',
        mapName: `로컬 테스트 맵 ${id}`, matchDate: '2026-10-25T01:00:00Z', kill: 1, death: 1, assist: 0, kdPercent: 50 });
      const stats = { totalMatchesCount: 1, winRate: 100, kdPercent: 50,
        officialRecentWinRate: 60, officialRecentKd: 65, recentAssaultRate: 66,
        recentSniperRate: 67, recentSpecialRate: 68, avgDamage: 1234, avgK: 8, avgD: 6, avgA: 2,
        mostPlayedMap: '프로방스(심플)',
        radar: { combat: 60, survival: 50, teamwork: 40, precision: 30, victory: 70 },
        playstyleIcon: '◆', playstyleTitle: '균형 잡힌 플레이', playstyleDescription: '로컬 분석 표본',
        bestPartner: { nickname: '함께한 동료', total: 3, winRate: 66.7 },
        nemesis: { nickname: '까다로운 상대', total: 3, rivalWinRate: 66.7 } };
      const current = { label: '최근 20경기', stats: { ...stats, totalMatchesCount: 20, winRate: 20 }, matches: [match('current')] };
      const previous = { label: '이전 20경기', stats: { ...stats, totalMatchesCount: 20, winRate: 60 }, matches: [match('previous')] };
      const party = { label, stats, matches: [match('party')] };
      const profile = { player: { nickname: name, ouid: 'fixture-ouid', clanName: '예시클랜',
        ranking: 1833, totalExp: 123456789, partyTier: 'LEGEND', partyScore: 3650,
        soloTier: 'GOLD I', soloScore: 1800 }, viewContext: 'public',
        stats, matches: current.matches, seasonViews: { current, previous }, matchCategoryViews: { party } };
      let category = 'all', mode = 'current';
      const state = { profile, match, categoryCalls: 0, moreCalls: 0, activityCalls: 0, dayCalls: 0 };
      const view = createPublicSearchView({ elements, getPrimaryUserData: () => profile,
        getActiveSeasonMode: () => mode, setActiveSeasonMode: value => { mode = value; },
        getActiveMatchCategory: () => category, syncFavoriteButton() {},
        onSeasonChange: () => view.renderProfile(profile),
        loadPlayerActivity: async (_player, onProgress) => {
          state.activityCalls += 1; onProgress({ percent: 80 });
          return [{ ...match('activity'), matchDate: new Date(Date.now() - 86400000).toISOString() }];
        },
        loadPlayerActivityDay: async (_player, matches) => { state.dayCalls += 1; return matches; },
        onMatchCategoryChange: value => { state.categoryCalls += 1; return new Promise(resolve => {
          state.completeCategory = () => { category = value; resolve(profile); };
        }); },
        onLoadMoreMatches: () => { state.moreCalls += 1; return new Promise((resolve, reject) => {
          state.completeMore = result => resolve(result); state.failMore = () => reject(new Error('Local retry fixture'));
        }); }
      });
      state.view = view; window.publicViewFixture = state;
      view.showLoading(name);
      return { name, label };
    });
    await expect(page.locator('#loading')).toBeVisible();
    await page.evaluate(() => { const { view, profile } = window.publicViewFixture; view.renderProfile(profile); view.finishLoading(); });
    await expect(page.locator('#loading')).toBeHidden();
    await expect(page.locator('#resultsMeta .is-strong')).toHaveText(names.name);
    // Result navigation preserves all public metrics and lazily owns one activity cache.
    const officialMetrics = page.locator('#playerProfile .official-metrics-grid');
    const officialText = await officialMetrics.innerText();
    await expect(page.locator('#playerProfile .nickname')).toHaveText(names.name);
    await expect(page.locator('#playerProfile .rank-pill-value')).toHaveText(['LEGEND', 'GOLD I']);
    await expect(page.locator('#playerProfile .public-profile-facts')).toContainText('#1,833');
    await expect(page.locator('#playerProfile .public-profile-facts')).toContainText('123,456,789');
    await expect(page.locator('#playerProfile .official-metric strong')).toHaveText(['60%', '65%', '66%', '67%', '68%']);
    await expect(page.locator('#statsSummary .quick-kpi strong')).toHaveText(['20%', '50%', '8/6/2', '프로방스(심플)']);
    const profileLayout = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const identity = box('#playerProfile .profile-main'), facts = box('#playerProfile .public-profile-facts');
      const official = box('#playerProfile .official-metrics-grid');
      const kpis = [...document.querySelectorAll('#statsSummary .quick-kpi')].map(el => el.getBoundingClientRect());
      return { identityBeforeFacts: identity.bottom <= facts.top, factsBeforeOfficial: facts.bottom < official.top,
        mapBelowNumbers: kpis.slice(0, 3).every(box => box.bottom <= kpis[3].top),
        mapFillsRow: Math.abs(kpis[3].width - document.querySelector('#statsSummary .quick-kpi-grid').clientWidth) < 2 };
    });
    expect(profileLayout).toEqual({ identityBeforeFacts: true, factsBeforeOfficial: true, mapBelowNumbers: true, mapFillsRow: true });
    await expect(page.locator('#resultNavigation')).toBeVisible();
    await expect(page.locator('#statsSummary .quick-kpi-grid')).toBeVisible();
    await expect(page.locator('#statsSummary .public-compact-analysis')).toBeHidden();
    expect(await page.evaluate(() => window.publicViewFixture.activityCalls)).toBe(0);
    const form = page.locator('#formInsightSection');
    await expect(form.locator('figure')).toHaveAccessibleName('이전 구간과 최근 구간의 승률 및 킬뎃 비교');
    await expect(form.locator('h3')).toHaveText('승률 하락 · 킬뎃 유지');
    await expect(form.locator('figcaption')).toContainText('이전 20경기 → 최근 20경기');
    await expect(form.locator('.sa-form-comparison-heading strong')).toHaveText(['-40.0%p', '0.0%p']);
    await expect(form.locator('.sa-form-bar-row strong')).toHaveText(['60.0%', '20.0%', '50.0%', '50.0%']);
    const ratios = await form.locator('.sa-form-bar-track').evaluateAll(tracks => tracks.map(track =>
      track.firstElementChild.getBoundingClientRect().width / track.getBoundingClientRect().width));
    for (const [i, ratio] of ratios.entries()) expect(ratio).toBeCloseTo([.6, .2, .5, .5][i], 2);
    await expect(form.locator('details')).not.toHaveAttribute('open', '');
    await form.locator('summary').click();
    await expect(form.locator('.sa-form-insight-comparison')).toBeVisible();
    await form.locator('summary').click();
    if (process.env.SA_VISUAL_OUTPUT) await form.screenshot({ path: `${process.env.SA_VISUAL_OUTPUT}/form-${width}-${theme}.png` });
    await expectResultsToFit();
    if (process.env.SA_VISUAL_OUTPUT) await page.locator('#resultsShell').screenshot({ path: `${process.env.SA_VISUAL_OUTPUT}/results-${width}-${theme}-overview.png` });
    await page.locator('#resultAnalysisTab').click();
    await expect(page.locator('#statsSummary .quick-kpi-grid')).toBeHidden();
    await expect(page.locator('#statsSummary sa-radar-chart')).toBeVisible();
    await expect(page.locator('#statsSummary .public-breakdown-card')).toContainText('1234');
    await expect(page.locator('#statsSummary .relationship-container')).toContainText('함께한 동료');
    await expect(page.locator('#statsSummary .relationship-container')).toContainText('까다로운 상대');
    await expect(page.locator('#matchHistory')).toBeHidden();
    await expectResultsToFit();
    if (process.env.SA_VISUAL_OUTPUT) await page.locator('#resultsShell').screenshot({ path: `${process.env.SA_VISUAL_OUTPUT}/results-${width}-${theme}-analysis.png` });
    await page.locator('#resultAnalysisTab').press('ArrowRight');
    await expect(page.locator('#resultActivityTab')).toBeFocused();
    await expect(page.locator('#resultContent')).toHaveAttribute('aria-labelledby', 'resultActivityTab');
    await expect(page.locator('#playerActivity .activity-day-analysis')).toContainText('평균 딜량');
    await expect(page.locator('#playerActivity .activity-day')).toHaveCount(31);
    await expectResultsToFit();
    if (process.env.SA_VISUAL_OUTPUT) await page.locator('#resultsShell').screenshot({ path: `${process.env.SA_VISUAL_OUTPUT}/results-${width}-${theme}-activity.png` });
    expect(await page.evaluate(() => [window.publicViewFixture.activityCalls, window.publicViewFixture.dayCalls])).toEqual([1, 1]);
    await page.locator('#resultOverviewTab').click(); await page.locator('#resultActivityTab').click();
    expect(await page.evaluate(() => [window.publicViewFixture.activityCalls, window.publicViewFixture.dayCalls])).toEqual([1, 1]);
    const selectedDate = await page.locator('#playerActivity .activity-date-input').inputValue();
    await page.evaluate(() => { window.publicViewFixture.card = document.querySelector('#playerProfile sa-player-card'); });
    await page.locator('#resultAnalysisTab').click();
    await page.locator('#statsSummary [data-mode="previous"]').click();
    await expect(page.locator('#resultAnalysisTab')).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => window.publicViewFixture.card === document.querySelector('#playerProfile sa-player-card'))).toBe(true);
    await page.locator('#statsSummary [data-mode="current"]').click();
    await page.locator('#resultActivityTab').click();
    await expect(page.locator('#playerActivity .activity-date-input')).toHaveValue(selectedDate);
    expect(await officialMetrics.innerText()).toBe(officialText);
    expect(await page.evaluate(() => [window.publicViewFixture.activityCalls, window.publicViewFixture.dayCalls])).toEqual([1, 1]);
    await page.locator('#resultOverviewTab').click();
    await page.locator('#matchHistory [data-category="party"]').click();
    await expect(page.locator('#matchHistory .match-category-btn:disabled')).toHaveCount(4);
    await page.evaluate(() => window.publicViewFixture.completeCategory());
    await expect(page.locator('#matchHistory [data-category="party"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#matchHistory .match-category-btn:disabled')).toHaveCount(0);
    await expect(page.locator('#matchHistory h2')).toHaveText(names.label + ' 매치 기록');
    await expect(page.locator('#statsSummary .season-toggle-btn')).toHaveCount(0);
    await expect(page.locator('[data-injected]')).toHaveCount(0);
    const more = page.locator('#matchHistory .match-history-more-btn');
    await more.click(); await expect(more).toBeDisabled();
    await page.evaluate(() => window.publicViewFixture.failMore());
    await expect(more).toBeEnabled(); await expect(more).toHaveText('불러오지 못했습니다 · 다시 시도');
    await more.click();
    await page.evaluate(() => { const s = window.publicViewFixture;
      s.completeMore({ matches: [s.match('party'), s.match('older')], hasMore: true }); });
    await expect(page.locator('#matchHistory .match-container')).toHaveCount(2);
    expect(await page.evaluate(() => window.publicViewFixture.moreCalls)).toBe(2);
    await more.click();
    await page.evaluate(() => { const s = window.publicViewFixture; s.view.showLoading('다음 플레이어');
      s.completeMore({ matches: [s.match('stale')], hasMore: false }); });
    await expect(page.locator('#loadingText')).toContainText('다음 플레이어');
    await expect(page.locator('#loading')).toBeVisible();
    expect(await page.evaluate(() => window.publicViewFixture.profile.matchCategoryHistory.party.matches.map(m => m.matchId))).toEqual(['party', 'older']);
    await page.evaluate(() => { const s = window.publicViewFixture; s.view.renderVs(s.profile,
      { ...s.profile, player: { nickname: '비교 대상' } }); s.view.finishLoading(); });
    await expect(page.locator('#matchHistory')).toBeHidden();
    await expect(page.locator('#resultsMeta')).toContainText('VS 비교');
    await expect(page.locator('#resultNavigation')).toBeHidden();
    await expect(page.locator('#playerActivity')).toBeHidden();
    await expect(page.locator('#playerProfile sa-player-card')).toHaveCount(2);
    await page.evaluate(() => window.publicViewFixture.view.reset());
    await expect(page.locator('#resultsShell')).toBeHidden();
    // Re-enter the all-category view and exercise the actual season toggle binding.
    await page.locator('#characterName').fill('새 검색');
    await page.evaluate(() => window.publicViewFixture.view.renderProfile(window.publicViewFixture.profile));
    await page.locator('#matchHistory [data-category="all"]').click();
    await page.evaluate(() => window.publicViewFixture.completeCategory());
    await page.locator('#statsSummary [data-mode="previous"]').click();
    await expect(page.locator('#matchHistory h2')).toHaveText('이전 20경기 매치 기록');
    await expect(page.locator('#matchHistory .match-container')).toHaveCount(1);
    await expect(page.locator('#matchHistory .map')).toHaveText('로컬 테스트 맵 previous');
    await page.evaluate(() => {
      const s = window.publicViewFixture; s.profile.seasonViews.previous.stats.totalMatchesCount = 6;
      s.view.renderProfile(s.profile);
    });
    await expect(form.locator('figure')).toHaveCount(0);
    await expect(form).toContainText('비교 표본 부족');
    expect(errors).toEqual([]);
  });
}

test('search history treats special names as text and preserves original action values', async ({ page }) => {
  await page.goto('/stats/sudden-attack/');
  const result = await page.evaluate(async () => {
    const helpers = await import('/stats/sudden-attack/ui/utils/ui-helpers.js');
    const name = `★Tracking <b data-injected="yes">위장닉</b> & "쌍따옴표" '작은따옴표'`;
    helpers.saveSearch('safe-recent', name);
    helpers.toggleFavoriteSearch('safe-favorites', name);
    const recent = document.querySelector('#recentSearches');
    const favorites = document.querySelector('#favoriteSearches');
    const actions = [];
    helpers.renderRecentSearches(recent, 'safe-recent', value => actions.push(['recent', value]));
    helpers.renderFavoriteSearches(favorites, 'safe-favorites', value => actions.push(['search', value]),
      value => actions.push(['remove', value]), value => actions.push(['compare', value]));
    recent.querySelector('.search-chip').click();
    for (const selector of ['.chip-label', '.chip-compare', '.chip-remove']) favorites.querySelector(selector).click();
    return { name, actions, recentText: recent.querySelector('.search-chip').textContent,
      favoriteText: favorites.querySelector('.chip-label').textContent,
      label: favorites.querySelector('.chip-compare').getAttribute('aria-label'),
      dataset: favorites.querySelector('.chip-with-remove').dataset.name,
      injected: recent.querySelectorAll('[data-injected]').length + favorites.querySelectorAll('[data-injected]').length,
      stored: [JSON.parse(localStorage.getItem('safe-recent')), JSON.parse(localStorage.getItem('safe-favorites'))] };
  });
  expect(result.injected).toBe(0);
  expect(result.recentText).toBe(result.name);
  expect(result.favoriteText).toBe('★ ' + result.name);
  expect(result.dataset).toBe(result.name);
  expect(result.label).toBe(result.name + ' VS 비교');
  expect(result.stored).toEqual([[result.name], [result.name]]);
  expect(result.actions).toEqual(['recent', 'search', 'compare', 'remove'].map(action => [action, result.name]));
});

test('stats and league names stay literal in cards and retain original click and clipboard values', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/stats/sudden-attack/');
  const result = await page.evaluate(async () => {
    await customElements.whenDefined('sa-player-card');
    if (!customElements.get('sa-crew-ranking')) await import('/stats/sudden-attack/ui/components/register-league.js');
    const name = `Tracking <b data-injected="yes">위장닉</b> & "별칭" '원본'`;
    const host = document.createElement('section'); host.id = 'safe-name-fixture'; document.body.append(host);
    const add = tag => { const node = document.createElement(tag); host.append(node); return node; };
    const player = add('sa-player-card');
    const model = {nickname: name, context: 'public', clanName: name, rankName: name, seasonRank: name,
      soloTier: name, partyTier: name, radar: {}, recentMatches: []};
    player.player = model;
    const zero = {totalMatchesCount: 0, winRate: 0, kdPercent: 0, radar: {}};
    const vs = add('sa-stats-summary');
    vs.vsModeData = {primary: zero, target: zero, primaryName: name, targetName: name, context: 'public'};
    const stats = add('sa-stats-summary');
    stats.innerHTML = stats.renderRivalry({nemesis: {nickname: name, total: 1, rivalWinRate: 0}}, {isPublicView: true});
    const member = {id: name, characterName: name, mmr: 1200, hsr: 1200, wins: 1, loses: 0, crewKills: 1, crewDeaths: 0};
    const ranking = add('sa-crew-ranking'); ranking.rankings = [member];
    const mvp = add('sa-crew-mvps'); mvp.data = [member];
    const highlights = add('sa-crew-highlights');
    highlights.data = {todayMvp: {name, diff: 1, mmr: 1200}, weeklyRival: {a: member, b: member, diff: 0},
      weeklyClimbers: [{name, diff: 1}], hotStreaks: [name], timeline: [name]};
    const synergy = add('sa-synergy-view'); synergy.data = {bestPartner: {nickname: name, total: 1, winRate: 0}};
    const matches = add('sa-match-list');
    matches.innerHTML = matches.drawTeamCard([{nickname: name, kdPercent: 0, kill: 0, death: 0, assist: 0, hsPercent: 0}], 'WIN', true);
    const board = add('sa-team-board');
    const draft = {red: [member], blue: [member], redAvg: 1200, blueAvg: 1200, diff: 0}; board.data = draft;
    let clipboard = '';
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async value => { clipboard = value; }}});
    board.querySelector('.copy-btn').click(); await Promise.resolve();
    let clicked = '';
    window.addEventListener('sa-request-search', event => { clicked = event.detail.name; }, {once: true});
    ranking.querySelector('.clickable-name').click();
    return {name, injected: host.querySelectorAll('[data-injected]').length, clicked, clipboard,
      nickname: player.querySelector('.nickname').textContent, clan: player.querySelector('.clan-name').textContent,
      vsName: vs.querySelector('th').textContent, synergyName: synergy.querySelector('.rel-name').textContent,
      originalName: model.nickname,
      datasets: [...host.querySelectorAll('[data-name]')].map(node => node.dataset.name)};
  });
  expect(result.injected).toBe(0);
  expect(result.nickname).toBe(result.name);
  expect(result.originalName).toBe(result.name);
  expect(result.clan).toBe('[' + result.name + ']');
  expect(result.vsName).toBe(result.name);
  expect(result.synergyName).toBe(result.name);
  expect(result.clicked).toBe(result.name);
  expect(result.clipboard).toContain(result.name);
  expect(result.clipboard).not.toContain('&lt;');
  expect(result.datasets.length).toBeGreaterThan(5);
  expect(result.datasets.every(name => name === result.name)).toBe(true);
  expect(errors).toEqual([]);
});

test('admin and balancer rendering preserve original names and legacy identifiers without HTML', async ({ page }) => {
  await page.goto('/stats/sudden-attack/');
  const result = await page.evaluate(async () => {
    const {AdminManager} = await import('/stats/sudden-attack/ui/admin-manager.js');
    const {BalancerManager} = await import('/stats/sudden-attack/ui/balancer-manager.js');
    const name = `Tracking <b data-injected="yes">별칭</b> & "원본"`;
    const id = `legacy"<&'`;
    const members = [id, id + '2'].map(id => ({id, characterName: name, mmr: 1200, hsr: 1200, wins: 0, loses: 0}));
    const host = document.createElement('section'); document.body.append(host);
    const panel = document.createElement('section'); host.append(panel);
    panel.innerHTML = '<div class="admin-member-grid"></div><select id="manualPenaltyMemberSelect"></select>';
    const admin = Object.create(AdminManager.prototype);
    admin.adminPanel = panel; admin.currentRankings = members;
    admin.crewRepo = {getManualSeedTierOptions: () => [{value: 'BRONZE', label: name}]};
    admin.renderAdminMemberList(); admin.renderManualPenaltyMemberOptions();
    const options = [...panel.querySelectorAll('#manualPenaltyMemberSelect option')].slice(1).map(o => [o.value, o.textContent]);
    const datasets = [...panel.querySelectorAll('[data-ouid]')].map(node => node.dataset.ouid);
    const balancer = Object.create(BalancerManager.prototype);
    balancer.currentRankings = members; balancer.selectedMemberOuids = new Set();
    balancer.balancerMemberList = document.createElement('section'); host.append(balancer.balancerMemberList);
    balancer.countDisplay = document.createElement('div');
    let selected = [];
    balancer.crewRepo = {balanceTeams: value => { selected = value; return null; }};
    balancer.renderMemberList();
    const checkboxes = [...balancer.balancerMemberList.querySelectorAll('input[type="checkbox"]')];
    for (const checkbox of checkboxes) { checkbox.checked = true; checkbox.dispatchEvent(new Event('change')); }
    balancer.calculateBalance();
    return {name, ids: members.map(m => m.id), options, datasets, selected,
      injected: host.querySelectorAll('[data-injected]').length,
      inputs: checkboxes.map(cb => [cb.value, cb.dataset.ouid])};
  });
  expect(result.injected).toBe(0);
  expect(result.options).toEqual(result.ids.map(id => [id, result.name]));
  expect(result.inputs).toEqual(result.ids.map(id => [result.name, id]));
  expect(result.datasets.every(id => result.ids.includes(id))).toBe(true);
  expect(result.selected.map(m => [m.ouid, m.characterName, m.position])).toEqual(result.ids.map(id => [id, result.name, 'rifler']));
});

test("split stats modules render zero-match public, league and VS cards through the real component", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/stats/sudden-attack/");
  await page.evaluate(async () => {
    await customElements.whenDefined("sa-stats-summary");
    await import('/stats/sudden-attack/ui/components/register-league.js');
    const host = document.createElement("section");
    host.id = "render-fixture";
    document.body.append(host);
    const zero = { totalMatchesCount: 0, winRate: 0, kdPercent: 0, crewMatchCount: 0, crewMmr: 1200, crewHsr: 1200, playstyleTitle: "기록 없음", radar: {} };
    for (const context of ["public", "league"]) {
      const card = document.createElement("sa-stats-summary");
      card.dataset.testid = context + "-fixture";
      host.append(card);
      card.stats = { ...zero, context };
    }
    const vs = document.createElement("sa-stats-summary");
    vs.dataset.testid = "vs-fixture";
    host.append(vs);
    vs.vsModeData = { primary: zero, target: zero, primaryName: "Tracking", targetName: "위장닉", context: "public" };
  });
  const publicCard = page.getByTestId("public-fixture");
  await expect(publicCard).toContainText("최근 0경기 기준");
  await expect(publicCard).toContainText("0%");
  await expect(publicCard).not.toContainText("내전 HSR");
  await expect(page.getByTestId("league-fixture")).toContainText("내전 HSR");
  await expect(page.getByTestId("league-fixture")).toContainText("최근 경기 중 우리 크루(8인 이상) 내전 기록이 없습니다.");
  await expect(page.getByTestId("vs-fixture")).toContainText("Tracking");
  await expect(page.getByTestId("vs-fixture")).toContainText("위장닉");
  await expect(page.getByTestId("vs-fixture")).toContainText("비교 보류");
  await expect(page.getByTestId("vs-fixture").locator(".vs-comparison-table tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("vs-fixture").locator("sa-radar-chart")).toHaveCount(0);
  await page.locator("#color-change").click();
  await expect(page.locator("body")).not.toHaveClass(/dark-mode/);
  await expect(publicCard).toContainText("최근 0경기 기준");
  expect(errors).toEqual([]);
});

test('VS displays decimal advantages cleanly on either side while keeping draws and integer league scores', async ({ page }) => {
  await page.goto('/stats/sudden-attack/');
  await page.evaluate(async () => {
    await customElements.whenDefined('sa-stats-summary');
    await import('/stats/sudden-attack/ui/components/register-league.js');
    for (const reverse of [false, true]) {
      const card = document.createElement('sa-stats-summary');
      card.id = reverse ? 'vs-primary-advantage' : 'vs-target-advantage';
      document.body.append(card);
      card.vsModeData = { primary: { totalMatchesCount:20,kdPercent:50,winRate:50,avgK: reverse ? 4.6 : 3.5 }, target: { totalMatchesCount:20,kdPercent:50,winRate:50,avgK: reverse ? 3.5 : 4.6 }, context: 'public' };
    }
    const league = document.createElement('sa-stats-summary');
    league.id = 'vs-league-advantage'; document.body.append(league);
    league.vsModeData = {
      primary: { isCrew:true,totalMatchesCount:20,crewMmr: 1234, crewHsr: 1200, mmrTrend: [{ mmr: 1200, hsr: 1200 }, { mmr: 1234, hsr: 1200 }] },
      target: { isCrew:true,totalMatchesCount:20,crewMmr: 1200, crewHsr: 1234, mmrTrend: [{ mmr: 1200, hsr: 1200 }, { mmr: 1200, hsr: 1234 }] }, context: 'league',
    };
  });
  for (const [id, winner] of [['vs-primary-advantage', 'primary'], ['vs-target-advantage', 'target']]) {
    const card = page.locator('#' + id);
    const row = card.locator('tr').filter({ hasText: '경기당 킬' });
    await expect(row.locator('.' + winner + '-win .vs-delta')).toHaveText('+1.1킬 우세');
    await expect(card).not.toContainText('1.099999');
    await expect(card).toContainText('동률');
  }
  const league = page.locator('#vs-league-advantage');
  await expect(league.locator('tr').filter({ hasText: '내전 MMR' }).locator('.primary-win .vs-delta')).toHaveText('+34점 우세');
  await expect(league.locator('tr').filter({ hasText: '내전 HSR' }).locator('.target-win .vs-delta')).toHaveText('+34점 우세');
});

for (const width of [390, 1280]) {
  test(`coaching preview separates facts and practice, follows evidence and withholds unknown rounds at ${width}px`, async ({ page }, testInfo) => {
    const errors = [], apiRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()); });
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.goto('/stats/sudden-attack/replay/');
    const replay = contextFixture();
    const analyze = async () => {
      await page.locator('#replayFile').setInputFiles({ name: 'coaching.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(replay)) });
      await page.locator('#replayPlayer').selectOption('focus');
      await page.locator('#analyzeReplayButton').click();
      await expect(page.locator('#replayCoachingPreview')).toBeVisible();
    };
    await analyze();
    const preview = page.locator('#replayCoachingPreview');
    await expect(preview.getByRole('heading', { name: '해설 미리보기', exact: true })).toBeVisible();
    await expect(preview).toContainText('AI 미연결 · 예시');
    await expect(preview).toContainText('검증된 2/2개 라운드');
    await expect(preview.locator('.coaching-card')).toHaveCount(3);
    await expect(preview.locator('dt').filter({ hasText: '관찰한 사실' })).toHaveCount(3);
    await expect(preview.locator('dt').filter({ hasText: '연습 제안' })).toHaveCount(3);
    await expect(preview).toContainText('1킬·2사망');
    await expect(preview).toContainText('실제 시야나 의도적인 커버');
    await page.locator('[data-round-filter="kill"]').click();
    await expect(page.locator('#replayRound-2')).toBeHidden();
    await preview.getByRole('button', { name: '2라운드 근거 보기', exact: true }).click();
    await expect(page.locator('#replayRound-2')).toBeFocused();
    await expect(page.locator('#replayRound-2')).toBeVisible();
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.locator('#color-change').click();
      await page.locator('.records-nav').getByRole('link', { name: '기록 해설·예시', exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await preview.screenshot({ path: testInfo.outputPath(`coaching-preview-${theme}.png`) });
    }

    replay.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin = 1;
    await analyze();
    await expect(preview).toContainText('검증된 1/2개 라운드');
    await expect(preview.getByRole('button', { name: '2라운드 근거 보기', exact: true })).toHaveCount(0);
    await expect(preview).toContainText('1킬·1사망');
    replay.replay_info.replayRoundInfo[0].replayCharacterInfo = [];
    await analyze();
    await expect(preview).toContainText('검증된 라운드가 없어 해설을 보류');
    await expect(preview.locator('.coaching-card')).toHaveCount(0);
    await expect(page.locator('#replayRound-1')).toBeVisible();
    await page.locator('#resetReplayButton').click();
    await expect(preview).toBeHidden();
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}


for (const [width, theme] of [[390, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
  test(`activity query failures stay distinct and recover without false zero metrics at ${width}px ${theme}`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
    await page.route('**/stats/sudden-attack/home-main.js*',route=>route.fulfill({contentType:'text/javascript',body:"import '/stats/sudden-attack/ui/components/register-common.js';"}));
    await page.goto('/stats/sudden-attack/');
    await page.evaluate(async()=>{
      await customElements.whenDefined('sa-player-card');
      const [{NexonApiClient},{SaRepository},{SaService},{SaPageUseCases}]=await Promise.all([
        import('/stats/sudden-attack/infra/nexon-api-client.js'),
        import('/stats/sudden-attack/infra/sa-repository.js'),
        import('/stats/sudden-attack/application/sa-service.js'),
        import('/stats/sudden-attack/application/sa-page-use-cases.js')
      ]);
      const state={listBroken:true,detailBroken:true,listCalls:0,detailCalls:0};
      const player={ouid:'local-failure-fixture',nickname:'Fixture',context:'public'};
      const row={match_id:'local-failure-match',date_match:new Date(Date.now()-86400000).toISOString(),match_type:'랭크전 솔로',match_result:'3',kill:6,death:4,assist:2};
      const client=new NexonApiClient('',{now:()=>0});
      client.fetch=async(_path,{match_type:type})=>{
        state.listCalls++;
        if(state.listBroken&&type==='토너먼트')throw Object.assign(new Error('local fixture'),{code:'RATE_LIMITED'});
        return {match:[row]};
      };
      client.getMatchDetail=async()=>{
        state.detailCalls++;
        if(state.detailBroken)throw new Error('local detail fixture');
        return {match_id:row.match_id,date_match:row.date_match,match_detail:[{ouid:player.ouid,user_name:'Fixture',match_result:'3',kill:6,death:4,assist:2,damage:900,headshot:2}]};
      };
      const useCases=new SaPageUseCases({service:new SaService(new SaRepository(client))});
      const card=document.createElement('sa-player-card');
      card.id='query-failure-fixture';card.style.cssText='display:block;max-width:1100px;margin:20px auto';
      card.player=player;
      card.activityLoader=(_player,progress)=>useCases.loadPlayerActivity(player,progress);
      card.activityDayLoader=(_player,matches,date)=>useCases.loadPlayerActivityDay(player,matches,date);
      document.body.append(card);
      card.querySelector('[data-panel="profile"]').classList.add('hidden');
      card.querySelector('[data-panel="activity"]').classList.remove('hidden');
      window.queryFailureFixture={state,useCases,card};
      await card.loadActivity(player);
    });
    const card=page.locator('#query-failure-fixture');
    const panel=card.locator('[data-panel="activity"]');
    await expect(panel).toContainText('일부 경기 유형을 불러오지 못했습니다');
    await expect(panel).toContainText('요청이 많아');
    await expect(panel.locator('.activity-overview')).toHaveCount(0);
    expect(await page.evaluate(()=>window.queryFailureFixture.useCases.playerActivityCache.size)).toBe(0);
    expect(await page.evaluate(()=>localStorage.getItem('sa_activity_31:v4:local-failure-fixture'))).toBeNull();
    await page.evaluate(()=>{window.queryFailureFixture.state.listBroken=false;});
    await panel.getByRole('button',{name:'활동 기록 다시 시도',exact:true}).click();
    await expect(panel.locator('.activity-overview')).toBeVisible();
    await expect(panel.getByRole('button',{name:'상세 기록 다시 시도',exact:true})).toBeVisible();
    await expect(panel.locator('.activity-day-analysis .activity-day-metrics')).toHaveCount(0);
    await panel.locator('[data-activity-mode="solo"]').click();
    await expect(panel.locator('.activity-day-analysis')).toContainText('불러오지 못했습니다');
    await expect(panel.locator('.activity-day-analysis')).not.toContainText('기록이 없습니다');
    await page.evaluate(()=>{window.queryFailureFixture.state.detailBroken=false;});
    await panel.getByRole('button',{name:'상세 기록 다시 시도',exact:true}).click();
    await expect(panel.locator('.activity-day-metrics')).toContainText('900');
    await expect(panel.getByRole('button',{name:'상세 기록 다시 시도',exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>window.queryFailureFixture.state.listCalls)).toBe(6);
    expect(await page.evaluate(()=>window.queryFailureFixture.state.detailCalls)).toBe(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}



for(const partial of [false,true]) {
  test(`cold search ${partial?'partial':'total'} list failure displays retry guidance instead of empty history`,async({page})=>{
    let broken=true;
    await mockZeroMatchNetwork(page);
    await page.route('**/api/sa-proxy?**',async route=>{
      const url=new URL(route.request().url());
      if(url.searchParams.get('path')?.endsWith('/match')&&broken&&(!partial||url.searchParams.get('match_type')==='토너먼트')) {
        return route.fulfill({status:504,contentType:'application/json',body:JSON.stringify({code:'REQUEST_TIMEOUT'})});
      }
      return route.fallback();
    });
    await page.goto('/stats/sudden-attack/?n='+measurementFixtureName);
    await expect(page.locator('#searchError')).toBeVisible();
    await expect(page.locator('#searchErrorTitle')).toContainText(partial?'일부 경기 기록':'경기 기록 조회에 실패');
    await expect(page.locator('#searchErrorMessage')).toContainText('대기 시간');
    await expect(page.locator('#characterName')).toHaveValue(measurementFixtureName);
    await expect(page.locator('#matchHistory')).toBeHidden();
    await expect(page.locator('#statsSummary')).toBeHidden();
    broken=false;
    await page.locator('#searchBtn').click();
    await expect(page.locator('#searchError')).toBeHidden();
    await expect(page.locator('#statsSummary')).toContainText('최근 0경기 기준');
    await expect(page.locator('#matchHistory')).toBeVisible();
  });
}


for(const [width,theme] of [[390,'light'],[390,'dark'],[1280,'light'],[1280,'dark']]) {
  test(`VS uses one K/D and the same selected window in table and radar at ${width}px ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
    await page.route('**/stats/sudden-attack/home-main.js*',route=>route.fulfill({contentType:'text/javascript',body:"import '/stats/sudden-attack/ui/components/register-common.js';"}));
    await page.goto('/stats/sudden-attack/');
    await page.evaluate(async()=>{
      await Promise.all(['sa-player-card','sa-stats-summary','sa-radar-chart'].map(tag=>customElements.whenDefined(tag)));
      const {createPublicSearchView}=await import('/stats/sudden-attack/ui/runtime/public-search-view.js');
      const ids={searchInput:'characterName',resetBtn:'resetSearchBtn',recentSearchesContainer:'recentSearches',favoriteSearchesContainer:'favoriteSearches',profileSection:'playerProfile',statsSection:'statsSummary',historySection:'matchHistory'};
      const keys=['searchInput','searchBtn','refreshBtn','compareBtn','favoriteBtn','resetBtn','loading','loadingText','recentSearchesContainer','favoriteSearchesContainer','searchGuide','profileSection','statsSection','historySection','swrStatus','resultsShell','resultsMeta'];
      const elements=Object.fromEntries(keys.map(key=>[key,document.getElementById(ids[key]||key)]));
      const stats=(kd,win,kills,count)=>({kdPercent:kd,winRate:win,avgK:kills,totalMatchesCount:count,officialRecentKd:99,officialRecentWinRate:99,radar:{combat:kd,survival:kd,teamwork:kd,precision:kd,victory:kd}});
      const profile=(name,current,previous)=>({player:{nickname:name,ouid:name},viewContext:'public',stats:stats(99,99,99,20),seasonViews:{current:{stats:current,matches:[]},previous:{stats:previous,matches:[]}}});
      const primary=profile('Alpha',stats(80,80,8,20),stats(30,40,4,6));
      const target=profile('Beta',stats(20,20,2,20),stats(70,60,4,20));
      const state={primary,target,mode:'previous'};
      const view=createPublicSearchView({elements,getPrimaryUserData:()=>primary,getActiveSeasonMode:()=>state.mode,setActiveSeasonMode:value=>{state.mode=value;},syncFavoriteButton(){},onSeasonChange(){}});
      state.view=view;window.vsComparisonFixture=state;
      view.renderProfile(primary);view.renderVs(primary,target);view.finishLoading();
    });
    const summary=page.locator('#vsStats');
    await expect(summary.locator('.vs-comparison-table tbody tr')).toHaveCount(3);
    await expect(summary.locator('.vs-comparison-table td.lbl')).toHaveText(['K/D','승률','경기당 킬']);
    await expect(summary.locator('.vs-comparison-scope').first()).toContainText('전체 이전 20경기');
    await expect(summary.locator('.vs-comparison-scope').first()).toContainText('Alpha 6경기 / Beta 20경기');
    await expect(summary.locator('.vs-summary-score strong')).toHaveText('0:2');
    const kd=summary.locator('.vs-comparison-table tbody tr').first();
    await expect(kd.locator('td').first()).toContainText('30%');
    await expect(kd.locator('td').last()).toContainText('70%');
    await expect(kd.locator('.vs-delta').last()).toHaveText('+40%p 우세');
    expect(await page.locator('#vsRadar').evaluate(el=>[el._lastData.radar.combat,el._lastData.vsTargetRadar.combat])).toEqual([30,70]);
    expect(await page.locator('#primaryCard').evaluate(el=>el.querySelector('.sa-data-source-nexon')!==null)).toBe(true);
    await expect(summary).not.toContainText('종합 K/D');
    await expect(summary).not.toContainText('최근 K/D');
    await page.evaluate(()=>{const s=window.vsComparisonFixture;s.mode='current';s.view.renderVs(s.primary,s.target);});
    await expect(summary.locator('.vs-summary-score strong')).toHaveText('3:0');
    expect(await page.locator('#vsRadar').evaluate(el=>[el._lastData.radar.combat,el._lastData.vsTargetRadar.combat])).toEqual([80,20]);
    await page.evaluate(()=>{const s=window.vsComparisonFixture;s.mode='previous';delete s.target.seasonViews.previous;s.view.renderVs(s.primary,s.target);});
    await expect(summary.locator('.vs-summary-score strong')).toHaveText('비교 보류');
    await expect(summary.locator('sa-radar-chart')).toHaveCount(0);
    await expect(summary.locator('.vs-comparison-scope').first()).toContainText('Beta 0경기');
    await expect(summary.locator('.vs-comparison-table tbody tr').first().locator('td').last()).toContainText('—');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}


for(const width of [390,1280]) {
  test(`matchRecords preserves native selector matching across loading, pagination and detail events at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.route('**/stats/sudden-attack/home-main.js*',route=>route.fulfill({contentType:'text/javascript',body:"import '/stats/sudden-attack/ui/components/register-common.js';"}));
    await page.goto('/stats/sudden-attack/');
    await page.evaluate(async detail=>{
      await customElements.whenDefined('sa-match-list');
      const {MatchRecord}=await import('/stats/sudden-attack/domain/match.js');
      const node=document.createElement('sa-match-list');
      node.id='match-records-fixture';node.classList.add('selector-fixture');
      node.style.cssText='display:block;max-width:1100px;margin:20px auto';document.body.append(node);
      const records=Array.from({length:45},(_,index)=>{
        const record=new MatchRecord({...detail,match_id:`fixture-${index}`},'퀵매치 클랜전','Subject',{names:[],ouids:[]},{ouid:'fixture-subject',kill:16,death:13,result:'3'});
        record.context='public';return record;
      });
      const events=[];window.addEventListener('sa-request-search',event=>events.push(event.detail.name));
      window.matchRecordsFixture={node,records,events};
      node.matchRecords=null;
    },createDrawDetail());
    const node=page.locator('#match-records-fixture');
    const nativeState=()=>node.evaluate(el=>({type:typeof el.matches,inherited:el.matches===Element.prototype.matches,
      own:Object.hasOwn(el,'matches'),prototypeOwn:Object.hasOwn(Object.getPrototypeOf(el),'matches'),
      matches:el.matches('sa-match-list.selector-fixture'),rejects:el.matches('.not-this-element')}));
    const expected={type:'function',inherited:true,own:false,prototypeOwn:false,matches:true,rejects:false};
    await expect(node.locator('.loading-shimmer')).toHaveCount(1);expect(await nativeState()).toEqual(expected);
    await page.evaluate(()=>{const s=window.matchRecordsFixture;s.node.matchRecords=s.records;});
    await expect(node.locator('.match-container')).toHaveCount(20);
    await expect(node.locator('.match-list-more-btn')).toHaveText('더보기 (20/45)');
    await node.locator('.match-list-more-btn').click();
    await expect(node.locator('.match-container')).toHaveCount(40);expect(await nativeState()).toEqual(expected);
    await node.locator('.match-list-more-btn').click();
    await expect(node.locator('.match-container')).toHaveCount(45);
    await expect(node.locator('.match-list-more-btn')).toHaveCount(0);
    const first=node.locator('.match-item').first();
    await first.press('Enter');await expect(first).toHaveAttribute('aria-expanded','true');
    await node.locator('.match-detail-view').first().locator('.clickable-name').first().click();
    expect(await page.evaluate(()=>window.matchRecordsFixture.events)).toEqual(['Subject']);
    await first.press('Space');await expect(first).toHaveAttribute('aria-expanded','false');
    expect(await nativeState()).toEqual(expected);
    await page.evaluate(()=>{const s=window.matchRecordsFixture;s.node.matchRecords=[];});
    await expect(node.locator('.no-data')).toContainText('최근 상세 매치 기록이 없습니다');
    expect(await nativeState()).toEqual(expected);
    await page.evaluate(()=>{const s=window.matchRecordsFixture;s.node.remotePagination=true;s.node.matchRecords=[...s.records];});
    await expect(node.locator('.match-container')).toHaveCount(45);
    await expect(node.locator('.match-list-more-btn')).toHaveCount(0);
    await page.evaluate(()=>{const s=window.matchRecordsFixture;s.node.remotePagination=false;s.node.matchRecords=s.records.slice(0,3);});
    await expect(node.locator('.match-container')).toHaveCount(3);
    expect(await nativeState()).toEqual(expected);
  });
}

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`compact result search preserves flow and one-row controls at ${width}px ${theme}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await seedMeasurementProfile(context);
    await context.addInitScript(theme => {
      localStorage.setItem('theme', theme);
      localStorage.setItem('sa_favorite_searches', JSON.stringify(['Tracking', '즐겨찾기닉네임이긴플레이어', '다른선수']));
    }, theme);
    await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName);
    await expect(page.locator('#loading')).toBeHidden();
    const card = page.locator('.sa-home-search-card'), slot = page.locator('#publicSearchSlot');
    const toggle = page.locator('#searchToolsToggle'), tools = page.locator('#publicSearchTools');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(card).not.toHaveClass(/is-search-docked/);
    await expect(tools).toBeVisible(); await expect(toggle).toBeHidden();
    const before = await page.locator('#resultsShell').evaluate(el => el.getBoundingClientRect().top + scrollY);
    const expanded = (await card.boundingBox()).height;
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#publicSearchSlot').getBoundingClientRect().top + scrollY + 240));
    await expect(card).toHaveClass(/is-search-docked/);
    await expect(tools).toBeHidden(); await expect(toggle).toBeVisible();
    const layout = await card.evaluate(el => {
      const box = el.getBoundingClientRect();
      const row = ['characterName', 'searchBtn', 'compareBtn', 'searchToolsToggle'].map(id => document.getElementById(id).getBoundingClientRect());
      return { height:box.height, top:box.top, left:box.left, right:box.right,
        rows:row.map(r => ({top:r.top,height:r.height,width:r.width})), overflow:document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(layout.height).toBeLessThanOrEqual(68); expect(layout.height).toBeLessThan(expanded);
    expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.right).toBeLessThanOrEqual(width + 1);
    expect(layout.overflow).toBe(false);
    for (const box of layout.rows) {expect(box.height).toBeGreaterThanOrEqual(44);expect(Math.abs(box.top-layout.rows[0].top)).toBeLessThanOrEqual(2);}
    expect(await page.locator('#resultsShell').evaluate(el => el.getBoundingClientRect().top + scrollY)).toBeCloseTo(before, 0);
    expect((await slot.boundingBox()).height).toBeCloseTo(expanded, 0);
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true'); await expect(tools).toBeVisible();
    const popup = await tools.boundingBox(); expect(popup.x).toBeGreaterThanOrEqual(0); expect(popup.x+popup.width).toBeLessThanOrEqual(width+1);
    expect(await tools.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path:testInfo.outputPath('compact-search-tools.png') });
    await page.keyboard.press('Escape'); await expect(tools).toBeHidden(); await expect(toggle).toBeFocused();
    await toggle.click(); await expect(tools).toBeVisible();
    // Use the page gutter: on mobile the disclosure can cover the result card.
    await page.mouse.click(width - 1, 830);
    await expect(tools).toBeHidden(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path:testInfo.outputPath('compact-search.png') });
    await page.evaluate(() => window.scrollTo(0,0)); await expect(card).not.toHaveClass(/is-search-docked/);
    await expect(tools).toBeVisible(); await expect(toggle).toBeHidden();
  });
}

test('compact search preserves mobile refresh, keyboard search, VS focus and reset across viewport changes', async ({ page, context }) => {
  await page.setViewportSize({ width:320, height:780 }); await seedMeasurementProfile(context); await mockZeroMatchNetwork(page);
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/stats/sudden-attack/?n=' + measurementFixtureName); await expect(page.locator('#loading')).toBeHidden();
  const card=page.locator('.sa-home-search-card'), toggle=page.locator('#searchToolsToggle'), tools=page.locator('#publicSearchTools');
  await page.evaluate(() => window.scrollTo(0,document.querySelector('#publicSearchSlot').offsetTop+260));
  await expect(card).toHaveClass(/is-search-docked/);
  const input=page.locator('#characterName'); await input.fill(measurementFixtureName); await input.press('Enter');
  await expect(input).toBeEnabled(); await expect(page.locator('#loading')).toBeHidden(); await expect(card).toHaveClass(/is-search-docked/);
  await toggle.click(); await expect(page.locator('#compactRefreshSlot #refreshBtn')).toBeVisible();
  await page.locator('#favoriteBtn').click(); await expect(page.locator('#favoriteSearches .chip-with-remove')).toHaveCount(1);
  await page.locator('#favoriteSearches .chip-remove').click(); await expect(page.locator('#favoriteSearches .chip-with-remove')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(toggle).toBeFocused();
  await page.locator('#compareBtn').click(); await expect(page.locator('#vsTargetName')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#compareBtn')).toBeFocused();
  await page.setViewportSize({width:1280,height:844}); await expect(card).toHaveClass(/is-search-docked/);
  await expect(page.locator('.search-btns #refreshBtn')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  await page.setViewportSize({width:320,height:780}); await expect(card).toHaveClass(/is-search-docked/);
  await toggle.click(); await page.locator('#refreshBtn').click(); await expect(page.locator('#loading')).toBeHidden();
  await expect(input).toBeEnabled(); await expect(card).toHaveClass(/is-search-docked/);
  await toggle.click(); await page.locator('#resetSearchBtn').click();
  await expect(page.locator('.sa-home-shell')).not.toHaveClass(/results-active/);
  await expect(toggle).toBeHidden(); await expect(input).toBeFocused(); await expect(input).toHaveValue('');
  await expect(page.locator('.search-btns #refreshBtn')).toBeHidden();
  expect(errors).toEqual([]);
});
