import { test, expect } from '@playwright/test';
import { contextFixture, makeRound, makeReplay } from '../fixtures/replay-context.js';

const PAGE = '/stats/sudden-attack/replay/';
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin !== 'http://127.0.0.1:4173' || url.pathname.startsWith('/api/') ? route.abort() : route.continue();
  });
});

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`first action and result layout at ${width}px ${theme}`, async ({ page }, info) => {
    const height = width === 390 ? 844 : 720;
    await page.setViewportSize({ width, height });
    await page.addInitScript(theme => localStorage.setItem('theme', theme), theme);
    const errors = [], apis = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/api/')) apis.push(path); });
    await page.goto(PAGE);
    const drop = await page.locator('#replayDropzone').boundingBox();
    expect(drop.y).toBeGreaterThan(55);
    expect(drop.y + drop.height).toBeLessThanOrEqual(height - 8);
    await expect(page.locator('#replayFile')).toHaveAttribute('accept', '.json,application/json');
    await expect(page.getByRole('link', { name: 'JSON 파일 받는 방법·사용법 ↗' })).toHaveAttribute('href', '/guides/replay-analysis-guide/');
    await page.screenshot({ path: info.outputPath(`start-${width}-${theme}.png`) });
    await page.locator('#replayCompareTab').click();
    const files = await page.locator('[data-comparison-files]').boundingBox();
    expect(files.y + files.height).toBeLessThanOrEqual(height - 8);
    await page.locator('[data-replay-sample="single"]').click();
    await expect(page.locator('#replayPlayback')).toBeVisible();
    const playback=page.locator('#replayPlayback');
    await expect(playback.locator('.playback-detail')).not.toHaveAttribute('open','');
    await expect(playback.locator('[data-playback-round-jump][aria-pressed="true"]')).toHaveCount(1);
    const sceneBox=await playback.locator('.playback-scene').boundingBox(),graphBox=await playback.locator('.playback-main').boundingBox();
    if(width===1280)expect(sceneBox.x).toBeGreaterThan(graphBox.x+graphBox.width);
    else expect(sceneBox.y).toBeGreaterThanOrEqual(graphBox.y+graphBox.height);
    await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','ready');
    await expect(page.locator('#replayDropzone')).toContainText('파일 선택 완료');
    await expect(page.locator('#replayDropzone #replaySelectedFileName')).toContainText('가상-체험-1.json');
    await expect(page.locator('#replayPlayerHelp')).toContainText('플레이어 선택 완료');
    await expect(page.locator('#replayResults')).toBeFocused();
    await expect.poll(() => page.locator('#replayResults').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(height);
    await page.evaluate(()=>window.scrollTo(0,0));
    const uploadBounds=await page.locator('.upload-card').boundingBox();
    await page.screenshot({path:info.outputPath(`selected-file-${width}-${theme}.png`),fullPage:true,clip:uploadBounds});
    await page.locator('#replayResults').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    const nav = page.getByRole('navigation', { name: '분석 결과 바로가기', exact: true });
    await expect(nav.locator('a')).toHaveText(['핵심 장면', '경기 재생', '세부 기록']);
    await expect(page.locator('[data-share-replay]')).toHaveText('이미지 공유');
    await expect(page.locator('.result-player strong')).toHaveText('체험 플레이어');
    await expect(page.locator('.result-score')).toContainText('패배');
    await expect(page.locator('.result-metric-source')).toHaveText(['경기 총계 · JSON 선수 요약', '라운드 기록 집계']);
    const featured = page.locator('.result-featured-moment');
    await expect(featured).not.toHaveAttribute('open', '');
    await featured.locator('summary').click();
    await expect(featured.locator('p')).toContainText('라운드');
    await featured.locator('[data-key-moment]').click();
    await expect(page.locator('#replayPlayback')).toBeFocused();
    await expect(page.locator('[data-playback-moment-context]')).toContainText('복기 중');
    await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-playback-action="play"]').click();
    await page.locator('[data-playback-seek]').evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('[data-playback-moment-context]')).toBeHidden();
    await featured.locator('[data-round-jump]').click();
    await expect(page.locator('.round:focus')).toHaveCount(1);
    await featured.locator('summary').click();
    await page.locator('.result-source summary').click();
    await expect(page.locator('.result-source')).toContainText('가상-체험-1.json');
    await page.locator('.result-source summary').click();
    const metrics = await page.locator('#replayResults .stats>div').evaluateAll(elements => elements.map(el => ({ top: Math.round(el.getBoundingClientRect().top), left: Math.round(el.getBoundingClientRect().left) })));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].top).toBe(metrics[1].top);
    if (width === 390) { expect(metrics[2].top).toBeGreaterThan(metrics[0].top); expect(metrics[2].left).toBe(metrics[0].left); }
    else expect(new Set(metrics.map(metric => metric.top)).size).toBe(1);
    const order = await page.locator('#replayResults, #replayCoach, #replayPlayback, #replayRecords').evaluateAll(elements => Object.fromEntries(elements.map(el => [el.id, el.getBoundingClientRect().top])));
    expect(order.replayCoach - order.replayResults).toBeLessThan(800);
    expect(order.replayCoach).toBeLessThan(order.replayPlayback);
    expect(order.replayPlayback).toBeLessThan(order.replayRecords);
    await page.locator('#replayResults').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: info.outputPath(`results-${width}-${theme}.png`) });
    await nav.getByRole('link', { name: '경기 재생', exact: true }).click();
    if (width === 1280) {
      await expect.poll(async () => { const box = await page.locator('#replayPlayback').boundingBox(); return box.y + box.height; }).toBeLessThanOrEqual(height - 8);
    }
    await nav.getByRole('link', { name: '세부 기록', exact: true }).click();
    await expect(page.getByRole('navigation', { name: '세부 기록 바로가기' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(apis).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('key moments replay their own anchors, clear obsolete context and retain record-only fallbacks',async({page})=>{
  const errors=[],apis=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apis.push(r.url());});
  const data=makeReplay([
    {...makeRound([[80,'focus','enemy1'],[90,'enemy2','focus']]),replayBombInfo:[]},
    {...makeRound([[160,'focus','enemy1'],[180,'focus','enemy2'],[190,'enemy3','focus']],{no:2}),replayBombInfo:[]}
  ]);
  await page.goto(PAGE);
  const upload=async(name,value)=>{
    await page.locator('#replayFile').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
  };
  await upload('moment-anchors.json',data);
  const clickAndRead=button=>button.evaluate(el=>{
    el.click();return {seek:Number(document.querySelector('[data-playback-seek]').value),playing:document.querySelector('[data-playback-action="play"]').getAttribute('aria-pressed')};
  });
  expect(await clickAndRead(page.locator('.moment-grid [data-key-moment="0"]'))).toEqual({seek:31000,playing:'true'});
  await expect(page.locator('[data-playback-moment-context]')).toContainText('2라운드 2킬');
  await expect(page.locator('[data-playback-moment-context]')).toContainText('00:16.0');
  expect(await clickAndRead(page.locator('.moment-grid [data-key-moment="1"]'))).toEqual({seek:4000,playing:'true'});
  await expect(page.locator('[data-playback-moment-context]')).toContainText('1라운드 처치 직후 사망');
  await page.locator('[data-playback-action="play"]').click();
  await page.locator('[data-playback-action="next"]').click();
  await expect(page.locator('[data-playback-moment-context]')).toBeHidden();
  await page.locator('.moment-grid [data-key-moment="0"]').click();
  await page.locator('#replayPlayer').selectOption('mate');await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('[data-playback-moment-context]')).toBeHidden();
  const unsupported=structuredClone(data);unsupported.replay_info.replayRoundInfo[0].playTime=0;
  await upload('record-only.json',unsupported);
  await expect(page.locator('[data-key-moment]')).toHaveCount(0);
  await expect(page.locator('.moment-grid')).toContainText('재생 시점 확인 불가');
  await page.locator('.moment-grid [data-round-jump]').first().click();await expect(page.locator('.round:focus')).toHaveCount(1);
  expect(errors).toEqual([]);expect(apis).toEqual([]);
});

// Shared keyboard and playback behavior is independent of layout/theme.
test('keyboard comparison, active playback, record filtering and report work together', async ({page}) => {
  const errors=[],apis=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/api/'))apis.push(path);});
  await page.goto(PAGE);
  await page.locator('#replaySingleTab').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#replayCompareTab')).toBeFocused();
  await expect(page.locator('#replayCompareTab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-replay-sample="compare"]').click();
  await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
  await page.locator('[data-replay-sample="single"]').click();
  await expect(page.locator('#replayPlayback')).toBeVisible();
  const nav=page.getByRole('navigation', { name: '분석 결과 바로가기', exact: true });
  await nav.getByRole('link', { name: '경기 재생', exact: true }).click();
  await page.locator('[data-playback-action="play"]').click();
  await expect.poll(() => page.locator('[data-playback-seek]').inputValue()).not.toBe('0');
  await nav.getByRole('link', { name: '세부 기록', exact: true }).click();
  await expect(page.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('navigation', { name: '세부 기록 바로가기' })).toBeVisible();
  await page.locator('[data-playback-action="play"]').click();
  await page.locator('.records-nav a[href="#replayRounds"]').click();
  await page.locator('[data-round-filter="death"]').click();
  await expect(page.locator('.round:not([hidden])')).toHaveCount(6);
  await page.locator('[data-print-replay]').click();
  await expect(page.locator('#replayPrintDialog tbody tr')).toHaveCount(6);
  await page.keyboard.press('Escape');
  expect(apis).toEqual([]);
  expect(errors).toEqual([]);
});

test('reordered records preserve partial-context disclosure, source totals and reset', async ({ page }) => {
  const fixture = contextFixture();
  fixture.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin = 1;
  await page.goto(PAGE);
  await page.locator('#replayFile').setInputFiles({ name: 'partial-context.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#replayPlayer').selectOption('focus');
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayInsights')).toContainText('1/2개 라운드');
  await expect(page.locator('#replayInsights')).toContainText('판정을 보류');
  await expect(page.locator('#replayResults .stats strong').first()).toHaveText('1 / 2 / 0');
  await expect(page.locator('#replayForecast')).toBeAttached();
  await expect(page.locator('#replayCoachingPreview')).toContainText('AI 미연결');
  await page.locator('#resetReplayButton').click();
  await expect(page.locator('#replayResults')).toBeHidden();
  await expect(page.locator('#replayFileStatus')).toHaveText('아직 선택한 파일이 없습니다.');
  await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','idle');
  await expect(page.locator('#replaySelectedFileName')).toBeHidden();
});

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`map background keeps the replay heading and actions clear at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    const fixture = contextFixture(); fixture.replay_info.replayMatchSummaryInfo.mapName = '이탈리아-폭파';
    await page.goto(PAGE);
    await page.locator('#replayFile').setInputFiles({ name: 'italy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.locator('#replayPlayer').selectOption('focus'); await page.locator('#analyzeReplayButton').click();
    const hero = page.locator('.result-hero');
    await expect(hero).toHaveClass('result-hero has-map-background');
    await expect(hero.getByRole('heading')).toHaveText('이탈리아-폭파');
    await expect(hero.locator('.result-player strong')).toHaveText('focus');
    expect(await hero.locator('.result-map').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('/assets/maps/5v5/italy.jpg');
    const asset = await page.request.get('/stats/sudden-attack/assets/maps/5v5/italy.jpg');
    expect(asset.ok()).toBe(true);
    await hero.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await hero.screenshot({ path: info.outputPath(`map-hero-${width}-${theme}.png`) });
    await hero.locator('[data-print-replay]').click(); await expect(page.locator('#replayPrintDialog')).toBeVisible();
    await page.keyboard.press('Escape'); await hero.locator('[data-new]').click();
    await expect(page.locator('#replayResults')).toBeHidden();
  });
}

test('home replay uses its map image and an unknown next map clears the background', async ({ page }) => {
  const fixture = contextFixture(); fixture.replay_info.replayMatchSummaryInfo.mapName = '이탈리아-폭파';
  await page.goto('/');
  await page.locator('[data-home-replay-files]').setInputFiles({ name: 'italy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#replayPlayer').selectOption('focus'); await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('.result-hero')).toHaveClass('result-hero has-map-background');
  await page.locator('[data-new]').click();
  fixture.replay_info.replayMatchSummaryInfo.mapName = '새로운 미등록 맵';
  await page.locator('#replayFile').setInputFiles({ name: 'unknown-map.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#replayPlayer').selectOption('focus'); await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('.result-hero')).toHaveClass('result-hero');
  expect(await page.locator('.result-map').evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
});

test('a missing decorative map image keeps the title and actions usable', async ({ page }) => {
  await page.route('**/assets/maps/5v5/italy.jpg', route => route.abort());
  const fixture = contextFixture(); fixture.replay_info.replayMatchSummaryInfo.mapName = '이탈리아-폭파';
  await page.goto(PAGE);
  await page.locator('#replayFile').setInputFiles({ name: 'missing-image.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#replayPlayer').selectOption('focus'); await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('.result-hero h2')).toContainText('이탈리아-폭파');
  await page.locator('[data-print-replay]').click(); await expect(page.locator('#replayPrintDialog')).toBeVisible();
});

test('file selection distinguishes pending reads, errors and replacement without retaining a stale success',async({page})=>{
  await page.goto(PAGE);
  await page.evaluate(()=>{
    const read=File.prototype.text;
    File.prototype.text=function(){return this.name==='pending.json'
      ? new Promise(resolve=>{window.finishFileRead=()=>read.call(this).then(resolve);}) : read.call(this);};
  });
  const upload=name=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(contextFixture()))});
  await page.locator('#replayFile').setInputFiles(upload('pending.json'));
  await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','reading');
  await expect(page.locator('#replayDropzone')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#replayDropzone')).toContainText('파일 확인 중');
  await page.locator('#replayFile').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','error');
  await expect(page.locator('#replayDropzone')).not.toContainText('파일 선택 완료');
  await page.locator('#replayFile').setInputFiles(upload('replacement-매우긴파일이름'.repeat(8)+'.json'));
  await expect(page.locator('#replayDropzone')).toHaveAttribute('data-file-state','ready');
  await expect(page.locator('#replayDropzone')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#playerStep')).toHaveAttribute('data-needs-player','true');
  await page.evaluate(()=>window.finishFileRead());
  await expect(page.locator('#replaySelectedFileName')).toContainText('replacement-');
  await page.locator('#replayPlayer').selectOption('focus');
  await expect(page.locator('#replayPlayerHelp')).toContainText('플레이어 선택 완료');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

async function shareSample(page, home = false) {
  await page.goto(home ? '/' : PAGE);
  await page.locator(home ? '[data-home-replay-sample]' : '[data-replay-sample="single"]').first().click();
  await page.locator('[data-share-replay]').click();
  const dialog = page.getByRole('dialog', { name: '리플레이 이미지 공유' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator('img').evaluate(image => image.complete && image.naturalWidth)).toBe(1080);
  return dialog;
}

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`image preview copies actual PNG data at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { async write(items) {
        const blob = await items[0].getType('image/png');
        window.copiedReplayImage = { types: items[0].types, size: blob.size, bytes: [...new Uint8Array(await blob.arrayBuffer()).slice(0, 8)] };
      } } });
    }, theme);
    const dialog = await shareSample(page, width === 390);
    expect(await dialog.evaluate(el => el.getBoundingClientRect().width <= innerWidth)).toBe(true);
    await dialog.locator('[data-image-copy]').click();
    await expect(dialog.locator('[data-image-status]')).toContainText('이미지를 복사했습니다.');
    const copied = await page.evaluate(() => window.copiedReplayImage);
    expect(copied.types).toEqual(['image/png']); expect(copied.size).toBeGreaterThan(1000);
    expect(copied.bytes).toEqual([137,80,78,71,13,10,26,10]);
    await dialog.screenshot({ path: info.outputPath(`replay-image-share-${width}-${theme}.png`) });
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-share-replay]')).toBeFocused();
  });
}

test('real clipboard copy can be pasted as an image in a local editor', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  const dialog = await shareSample(page);
  await dialog.locator('[data-image-copy]').click();
  await expect(dialog.locator('[data-image-status]')).toContainText('이미지를 복사했습니다.');
  await dialog.locator('[data-image-close]').click();
  await page.evaluate(() => {
    const input = document.createElement('textarea'); input.id = 'replayPasteCheck'; input.setAttribute('aria-label','로컬 붙여넣기 확인');
    input.addEventListener('paste', async event => {
      event.preventDefault();
      const image = [...event.clipboardData.items].find(item => item.kind === 'file')?.getAsFile();
      window.replayPasteResult = image ? { type: image.type, bytes: [...new Uint8Array(await image.arrayBuffer()).slice(0,8)] } : null;
    });
    document.body.append(input);
  });
  await page.locator('#replayPasteCheck').click(); await page.keyboard.press('ControlOrMeta+V');
  await expect.poll(() => page.evaluate(() => window.replayPasteResult)).toEqual({ type:'image/png', bytes:[137,80,78,71,13,10,26,10] });
});

test('clipboard denial offers an explicit PNG save without claiming copy success', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{throw new DOMException('denied','NotAllowedError');}}}));
  const dialog = await shareSample(page);
  await dialog.locator('[data-image-copy]').click();
  await expect(dialog.locator('[data-image-status]')).toContainText('이미지를 복사하지 못했습니다.');
  const waiting = page.waitForEvent('download'); await dialog.locator('[data-image-save]').click();
  const download = await waiting; expect(download.suggestedFilename()).toMatch(/\.png$/);
  await expect(dialog.locator('[data-image-status]')).toContainText('PNG 저장을 요청했습니다.');
});

test('pending clipboard completion cannot replace a later PNG save message', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:()=>new Promise(resolve=>{window.finishReplayCopy=resolve;})}}));
  const dialog = await shareSample(page); await dialog.locator('[data-image-copy]').click();
  await expect(dialog.locator('[data-image-status]')).toContainText('권한을 확인');
  const waiting = page.waitForEvent('download'); await dialog.locator('[data-image-save]').click(); await waiting;
  await page.evaluate(() => window.finishReplayCopy());
  await expect(dialog.locator('[data-image-copy]')).toBeEnabled();
  await expect(dialog.locator('[data-image-status]')).toContainText('PNG 저장을 요청했습니다.');
});

test('native share errors keep PNG and clipboard alternatives available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('denied','NotAllowedError');}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async()=>{}}});
  });
  const dialog = await shareSample(page); await dialog.locator('[data-image-native]').click();
  await expect(dialog.locator('[data-image-status]')).toContainText('기기 공유를 열지 못했습니다.');
  await expect(dialog.locator('[data-image-save]')).toBeEnabled(); await dialog.locator('[data-image-copy]').click();
  await expect(dialog.locator('[data-image-status]')).toContainText('이미지를 복사했습니다.');
});

test('leaving the home replay workspace closes and releases its image preview', async ({ page }) => {
  const dialog = await shareSample(page, true);
  await page.goBack();
  await expect(page.locator('#homeHub')).toBeVisible(); await expect(dialog).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('#homeReplayWorkspace')).toBeVisible();
  await page.locator('[data-share-replay]').click(); await expect(dialog).toBeVisible();
});
