import { test, expect } from '@playwright/test';
import { contextFixture } from '../fixtures/replay-context.js';

const localOrigin = 'http://127.0.0.1:4173';

test('home replay bypasses a stale unversioned entry after deployment', async ({ page }) => {
  await page.route('**/home/replay-entry.js', route => route.fulfill({ contentType:'text/javascript', body:'throw new Error("stale unversioned replay entry");' }));
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      if (typeof input === 'string' && input === '/stats/sudden-attack/replay/' && options?.cache !== 'no-cache') {
        return Promise.resolve(new Response('<main>older cached replay markup</main>', {status:200}));
      }
      return fetch(input, options);
    };
  });
  await page.goto('/');
  await expect(page.locator('script[src*="home/replay-entry.js"]')).toHaveAttribute('src', /^\.\/home\/replay-entry\.js\?v=[a-f0-9]{12}$/);
  await page.locator('[data-home-replay-entry] [data-home-replay-sample]').click();
  await expect(page.locator('#replayResults')).toBeVisible();
  await page.locator('[data-share-replay]').click();
  await expect(page.locator('#replayImageShareDialog')).toBeVisible();
});
const file = (name = 'first-game.json', match = 'first-match', nick = 'focus') => {
  const data = contextFixture();
  data.replay_info.replayMatchSummaryInfo.matchID = match;
  data.replay_info.replayCharacterSummaryInfo[0].nickName = nick;
  return { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) };
};

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== localOrigin) return route.abort();
    if (url.pathname.startsWith('/api/soop-live')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ready', mode: 'page', page: 1, pageCount: 1, broadcasts: [] }) });
    if (url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
});

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`home file entry and sample stay clear at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const errors = [], replayAssets = [], apis = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/stats/sudden-attack/replay/')) replayAssets.push(url.pathname);
      if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/soop-live')) apis.push(url.pathname);
      // Existing notice reads use Firestore's POST runQuery transport. They are
      // blocked by the external-service route above and are not a replay upload.
      const existingNoticeRead = url.hostname === 'firestore.googleapis.com' && url.pathname.endsWith('/documents:runQuery');
      if (request.method() !== 'GET' && !existingNoticeRead) writes.push(url.origin + url.pathname);
    });
    await page.goto('/');
    await expect(page.locator('#homeHub')).toBeVisible();
    await expect(page.locator('[data-home-replay-files]')).toHaveAttribute('multiple', '');
    const drop = await page.locator('[data-home-replay-drop]').boundingBox();
    expect(drop.y + drop.height).toBeLessThan(844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(replayAssets).toEqual([]);
    await page.screenshot({ path: info.outputPath(`home-${width}-${theme}.png`) });
    await page.getByText('파일 받는 방법', { exact: true }).click();
    await expect(page.locator('.home-download-help')).toContainText('다운로드한 원본 파일');
    await expect(page.locator('.home-download-help a').first()).toHaveAttribute('target', '_blank');
    await page.locator('[data-home-replay-entry] [data-home-replay-sample]').click();
    await expect(page.locator('#homeReplayWorkspace')).toBeVisible();
    await expect(page.locator('#homeHub')).toBeHidden();
    await expect(page.locator('#replayResults')).toBeVisible();
    await expect(page.locator('#replaySampleNotice')).toContainText('가상의 경기');
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await page.getByRole('navigation', { name: '분석 결과 바로가기', exact: true }).getByRole('link', { name: '경기 재생', exact: true }).click();
    await expect(page.locator('#homeReplayWorkspace')).toBeVisible();
    await expect(page.locator('#homeHub')).toBeHidden();
    await page.locator('[data-playback-action="play"]').click();
    await expect.poll(() => page.locator('[data-playback-seek]').inputValue()).not.toBe('0');
    await page.locator('[data-home-replay-close]').click();
    await expect(page.locator('#homeHub')).toBeVisible();
    await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed', 'false');
    await page.goBack();
    await expect(page.locator('#homeReplayWorkspace')).toBeVisible();
    await expect(page.locator('#replayResults')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(apis).toEqual([]);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('one local file reaches existing analysis and report without a second chooser', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#replaySelectedFileName')).toHaveText('선택한 파일: first-game.json');
  await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','ready');
  await expect(page.locator('#replayPlayerHelp')).toContainText('분석할 플레이어를 선택');
  await page.locator('#replayPlayer').selectOption('focus');
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayResults .stats strong').first()).toHaveText('1 / 2 / 0');
  await expect(page.locator('#replayPlayback')).toBeVisible();
  await expect(page.locator('#replaySampleNotice')).toBeHidden();
  await page.locator('[data-print-replay]').click();
  await expect(page.locator('#replayPrintDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-home-replay-close]').click();
  await expect(page.locator('[data-home-replay-files]')).toHaveValue('');
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#playerStep')).toBeVisible();
  await expect(page.locator('#replayPlayer')).toHaveValue('');
  await expect(page.locator('#replayResults')).toBeHidden();
});

test('multiple files reuse player-ID comparison and tolerate aliases', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles([file(), file('second-game.json', 'second-match', 'temporary-name')]);
  await expect(page.locator('#replayCompareTab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-comparison-files-list] li')).toHaveText(['first-game.json', 'second-game.json']);
  await page.locator('[data-comparison-player]').selectOption('focus');
  await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
  await expect(page.locator('.comparison-scope')).toContainText('focus / temporary-name');
  await page.locator('[data-home-replay-close]').click();
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#replaySingleTab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#playerStep')).toBeVisible();
});

test('dragging a downloaded file uses the same entry flow', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-home-replay-drop]').evaluate((drop, content) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], 'dropped.json', { type: 'application/json' }));
    drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, JSON.stringify(contextFixture()));
  await expect(page.locator('#replaySelectedFileName')).toHaveText('선택한 파일: dropped.json');
  await expect(page.locator('#playerStep')).toBeVisible();
});

test('wrong extension, size and JSON structure retain actionable existing errors', async ({ page }) => {
  await page.goto('/');
  for (const [selected, message] of [
    [{ name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('invalid') }, 'JSON 파일만 사용할 수 있습니다.'],
    [{ name: 'too-large.json', mimeType: 'application/json', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) }, '파일이 너무 큽니다.'],
    [{ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') }, 'JSON 형식을 읽을 수 없습니다.'],
    [{ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{}') }, '지원하는 병영수첩 리플레이 형식이 아닙니다.']
  ]) {
    await page.locator('[data-home-replay-files]').setInputFiles(selected);
    await expect(page.locator('#replayFileStatus')).toContainText(message);
    await expect(page.locator('#analyzeReplayButton')).toBeDisabled();
    await page.locator('[data-home-replay-close]').click();
    await expect(page.locator('#homeHub')).toBeVisible();
  }
});

test('six files and duplicate games cannot become a misleading comparison', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles(Array.from({ length: 6 }, (_, i) => file(`${i}.json`, `match-${i}`)));
  await expect(page.locator('[data-comparison-status]')).toContainText('최대 5개');
  await expect(page.locator('#replayComparison tbody tr')).toHaveCount(0);
  await page.locator('[data-home-replay-close]').click();
  await page.locator('[data-home-replay-files]').setInputFiles([file(), file('copy.json')]);
  await expect(page.locator('[data-comparison-issues]')).toContainText('중복 제외');
  await expect(page.locator('#replayComparison tbody tr')).toHaveCount(0);
});

test('static UI failure leaves home and fallback usable and can retry', async ({ page }) => {
  await page.route('**/stats/sudden-attack/replay/', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#homeReplayStatus')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#homeHub')).toBeVisible();
  await expect(page.locator('[data-home-replay-open]')).toHaveAttribute('href', '/stats/sudden-attack/replay/');
  await page.unroute('**/stats/sudden-attack/replay/');
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#playerStep')).toBeVisible();
});

test('latest chosen files win while the static replay page is slow', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let reads = 0;
  await page.route('**/stats/sudden-attack/replay/', async route => { reads++; await gate; await route.continue(); });
  await page.goto('/');
  try {
    await page.locator('[data-home-replay-files]').setInputFiles(file('old.json'));
    await page.locator('[data-home-replay-files]').setInputFiles(file('latest.json', 'latest'));
  } finally { release(); }
  await expect(page.locator('#replaySelectedFileName')).toHaveText('선택한 파일: latest.json');
  expect(reads).toBe(1);
});

test('search remains a normal GET form and does not start a replay', async ({ page }) => {
  await page.route('**/stats/sudden-attack/?n=*', route => route.fulfill({ contentType: 'text/html', body: '<h1>검색 경로 확인</h1>' }));
  await page.goto('/');
  await page.locator('input[name="n"]').fill('Tracking');
  await page.locator('.hero-search button').click();
  await expect(page).toHaveURL(/\/stats\/sudden-attack\/\?n=Tracking$/);
});

test('browser back and forward preserve a file session and refresh requires selecting again', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles(file());
  await expect(page.locator('#playerStep')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#homeHub')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#replaySelectedFileName')).toContainText('first-game.json');
  expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('first-match')))).toBe(false);
  await page.reload();
  await expect(page.locator('#homeReplayWorkspace')).toBeVisible();
  await expect(page.locator('#playerStep')).toBeHidden();
  await expect(page.locator('#replayFileStatus')).toHaveText('아직 선택한 파일이 없습니다.');
});

test('home product preview opens the shared real sample without new API calls', async ({ page }) => {
  const calls=[];
  page.on('request',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/api/')&&!p.startsWith('/api/soop-live'))calls.push(p);});
  await page.goto('/');
  await expect(page.locator('[data-home-preview-chart] .home-preview-line')).toHaveCount(6);
  await expect(page.locator('[data-home-preview-chart]')).toHaveAttribute('data-home-preview-metric','match-estimate');
  await expect(page.locator('.home-preview-axis-title')).toContainText('경기 승리 추정치');
  await expect(page.locator('.home-preview')).toContainText('내 전적이 아닙니다');
  await page.locator('.home-preview [data-home-replay-sample]').click();
  await expect(page.locator('#replayPlayback')).toBeVisible();
  await expect(page.locator('#replayResults')).toContainText('가상의 경기');
  await expect(page.locator('[data-playback-index-a]')).toHaveText('50.0%');
  await expect(page.locator('[data-playback-dominance]')).toContainText('경기 승리 추정');
  await page.locator('[data-playback-round-select]').selectOption('4');
  await expect(page.locator('[data-playback-index-a]')).toHaveText('21.9%');
  await expect(page.locator('[data-playback-round]')).toContainText('후반');
  await expect(page.locator('header')).toHaveCount(1);
  expect(calls).toEqual([]);
});
