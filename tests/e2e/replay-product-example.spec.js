import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173' || url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
});

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`guest product example is clear and stays within the page at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const apis = [], errors = [], modules = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/')) apis.push(path);
      if (path.endsWith('.js')) modules.push(path);
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/ai-replay-pass/');
    await expect(page.locator('#purchase')).toHaveAttribute('data-purchase-mode', 'TEST');
    await expect(page.locator('#purchase')).toHaveAttribute('data-guest-test-enabled', 'true');
    await expect(page.locator('#purchase-accept')).not.toBeChecked();
    await expect(page.locator('#purchase-pay')).toBeDisabled();
    await page.getByRole('link', { name: '결과 예시', exact: true }).click();
    const example = page.locator('#result-example');
    await expect(example).toBeVisible();
    await expect(example.locator('.pass-example-card')).toHaveCount(3);
    await expect(example.locator('.pass-example-disclosure')).toContainText('수동 선택한 구성 예시이며, 실제 AI 생성 결과가 아닙니다.');
    await expect(example).toContainText('18.0초 사망 직전 본인 포함 5대4');
    await expect(example).toContainText('항상 예시처럼 3장을 제공하는 것은 아니며');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const card of await example.locator('.pass-example-card').all()) {
      expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await example.evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await example.screenshot({ path: info.outputPath(`product-example-${width}-${theme}.png`) });
    expect(apis).toEqual([]);
    expect(modules.some(path => /replay-coaching|replay-review|replay-product-example/.test(path))).toBe(false);
    await example.getByRole('link', { name: '같은 가상 경기로 무료 기본 분석 체험하기 →' }).click();
    await expect(page).toHaveURL(/\/stats\/sudden-attack\/replay\/$/);
    await page.waitForLoadState('load');
    await page.locator('[data-replay-sample="single"]').click();
    await expect(page.locator('#replayResults .result-map h2')).toHaveText('체험용 가상 경기');
    await expect(page.locator('#replayResults .result-player strong')).toHaveText('체험 플레이어');
    await expect(page.locator('#replayPlayback')).toBeVisible();
    expect(apis).toEqual([]);
    expect(errors).toEqual([]);
  });
}
