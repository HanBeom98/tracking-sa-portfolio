import { test, expect } from '@playwright/test';
import { makeRound, makeReplay } from '../fixtures/replay-context.js';

const PAGE = '/stats/sudden-attack/replay/';
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173' ? route.continue() : route.abort());
});
async function sample(page) {
  await page.goto(PAGE);
  await page.locator('[data-replay-sample="single"]').click();
  await expect(page.locator('#replayPlayback')).toBeVisible();
}

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`report screen and print layout: ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const paths = [];
    page.on('request', request => paths.push(new URL(request.url()).pathname));
    await sample(page);
    expect(paths.some(path => path.endsWith('/ui/replay-print-report.js'))).toBe(false);
    await page.locator('[data-print-replay]').click();
    const dialog = page.getByRole('dialog', { name: '분석 보고서 미리보기' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('tbody tr')).toHaveCount(6);
    await expect(dialog).toContainText('샘플 체험 · 가상의 경기 기록');
    await expect(dialog).toContainText('18.0초');
    expect(await dialog.evaluate(el => el.getBoundingClientRect().width <= innerWidth)).toBe(true);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.replay-shell')).toBeHidden();
    await expect(dialog.locator('.report-toolbar')).toBeHidden();
    const dimensions = await dialog.locator('table').evaluate(el => ({ width: el.getBoundingClientRect().width, container: el.closest('dialog').getBoundingClientRect().width }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.container + 1);
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-print-replay]')).toBeFocused();
    expect(paths.filter(path => path.includes('/api/'))).toHaveLength(0);
  });
}

test('a delayed report module cannot open a stale player report', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/ui/replay-print-report.js*', async route => { await gate; await route.continue(); });
  await sample(page);
  await page.locator('[data-print-replay]').click();
  await page.locator('#replayPlayer').selectOption('sample-ally-1');
  release();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#replayPrintDialog')).toHaveCount(0);
  await page.locator('#analyzeReplayButton').click();
  await page.locator('[data-print-replay]').click();
  await expect(page.locator('#replayPrintDialog h1')).toContainText('팀원 1');
  await expect(page.locator('#replayPrintDialog')).toBeVisible();
});

test('failed report loading leaves analysis usable with refresh guidance', async ({ page }) => {
  await sample(page);
  await page.route('**/ui/replay-print-report.js*', route => route.abort());
  await page.locator('[data-print-replay]').click();
  await expect(page.locator('[data-share-status]')).toContainText('보고서를 열지 못했습니다.');
  await expect(page.locator('[data-print-replay]')).toBeEnabled();
  await expect(page.locator('#replayPlayback')).toBeVisible();
});

test('report print lifecycle preserves filtered results, playback, focus, title and reset cleanup', async ({ page }) => {
  await sample(page);
  await page.locator('[data-playback-action="play"]').click();
  await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed', 'true');
  const title = await page.title();
  await page.locator('[data-round-filter="kill"]').click();
  await page.locator('[data-print-replay]').click();
  const dialog=page.locator('#replayPrintDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(6);
  await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => {
    window.print = () => {
      dispatchEvent(new Event('beforeprint'));
      window.printCalls = (window.printCalls || 0) + 1;
      window.printTitle = document.title;
      dispatchEvent(new Event('afterprint'));
    };
  });
  await dialog.locator('[data-report-print]').click();
  expect(await page.evaluate(() => window.printCalls)).toBe(1);
  expect(await page.evaluate(() => window.printTitle)).toBe('TrackingSA 리플레이 분석 보고서');
  await expect(page).toHaveTitle(title);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-print-replay]')).toBeFocused();
  await page.locator('[data-print-replay]').click();
  await expect(dialog).toHaveCount(1);
  await dialog.locator('[data-report-close]').click();
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-print-replay]').click();
  await expect(dialog).toBeVisible();
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await expect(page).toHaveTitle('TrackingSA 리플레이 분석 보고서');
  // A file/analysis invalidation can occur while the modal is open.
  await page.locator('#resetReplayButton').evaluate(button => button.click());
  await expect(page.locator('#replayPrintDialog')).toHaveCount(0);
  await expect(page).toHaveTitle(title);
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await expect(page).toHaveTitle(title);
});

test('long report retains every round and a partial round is visibly held', async ({ page }) => {
  const rounds = Array.from({ length: 40 }, (_, index) => makeRound([[20, 'enemy1', 'focus']], { no: index + 1 }));
  rounds[9].replayEnterInfo = [{ nexonSN: 'focus', timeStamp: 10 }];
  await page.goto(PAGE);
  await page.locator('#replayFile').setInputFiles({ name: 'report-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeReplay(rounds))) });
  await page.locator('#replayPlayer').selectOption('focus');
  await page.locator('#analyzeReplayButton').click();
  await page.locator('[data-print-replay]').click();
  await expect(page.locator('#replayPrintDialog tbody tr')).toHaveCount(40);
  await expect(page.locator('#replayPrintDialog tbody tr').nth(9)).toContainText('검증 보류');
  await expect(page.locator('#replayPrintDialog tbody tr').last()).toContainText('40R');
});
