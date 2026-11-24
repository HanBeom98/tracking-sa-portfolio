import { test, expect } from '@playwright/test';
import { makeReplay, makeRound } from '../fixtures/replay-context.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingReview } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import reviewCatalog from '../../cloud-functions/replay-coaching-review-catalog.js';
import reviewAdapter from '../../cloud-functions/replay-coaching-review-response.js';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort());
});
const replay = () => makeReplay([
  makeRound([[10,'mate','enemy1'],[20,'spare','enemy2'],[30,'enemy3','focus'],[50,'enemy3','mate'],[70,'enemy3','spare']]),
  makeRound([],{no:2}),makeRound([[10,'enemy1','focus']],{no:3}),makeRound([],{no:4}),
]);
async function analyze(page, query = '?coaching=review') {
  await page.goto(`/stats/sudden-attack/replay/${query}`);
  await page.locator('#replayFile').setInputFiles({name:'review-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replay()))});
  await page.locator('#replayPlayer').selectOption('focus');
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayResults')).toBeVisible();
}
async function savedResult(player = 'focus') {
  const evidence=buildReplayCoachingReview(analyzeReplay(replay(),player)),facts=reviewCatalog.createReviewCatalog(evidence).facts;
  const selection={schemaVersion:2,cards:facts.slice(0,2).map((f,i)=>({kind:i?'practice':'review',factId:f.id,questionId:f.questions[0],practiceId:f.practices[0]}))};
  return reviewAdapter.buildReviewClientResult({providerResponseId:'resp_synthetic_browser',selection,response:reviewCatalog.renderReviewSelection(selection,evidence)},evidence);
}
async function importResult(page,value) {
  await page.locator('[data-review-result-file]').setInputFiles({name:'saved-response.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
}

for (const width of [390,1280]) test(`local review focuses the exact count transition and preserves free round navigation at ${width}px`, async ({page},testInfo) => {
  await page.setViewportSize({width,height:844});
  const api=[];page.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url());});
  await analyze(page);
  await expect(page.locator('#replayReviewPreview')).toContainText('로컬 검증 · 추가 호출 없음');
  await expect(page.locator('[data-review-flow="1"]')).not.toHaveAttribute('open');
  await page.locator('[data-review-jump="1"]').click();
  const anchor=page.locator('#reviewAnchor-1');
  await expect(anchor).toBeFocused();await expect(anchor).toHaveClass(/is-focused/);await expect(anchor).toContainText('3.0초');
  await expect(anchor).toContainText('3대1 → 2대1');
  await page.locator('.review-scene').first().screenshot({path:testInfo.outputPath('review-scene.png')});
  await page.locator('[data-round-filter="survived"]').click();
  await expect(page.locator('#replayRound-1')).toBeHidden();
  await page.locator('#replayReviewPreview [data-round-jump="1"]').click();
  await expect(page.locator('#replayRound-1')).toBeFocused();await expect(page.locator('#replayRound-1')).toBeVisible();
  await page.locator('[data-review-jump="2"]').click();
  await expect(page.locator('#reviewAnchor-2')).toBeFocused();await expect(page.locator('#reviewAnchor-2')).toContainText('처치·사망 사건 아님');
  await expect(anchor).not.toHaveClass(/is-focused/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(api).toEqual([]);
  await page.locator('#replayPlayer').selectOption('mate');await expect(page.locator('#replayReviewPreview')).toHaveCount(0);
  await page.locator('#analyzeReplayButton').click();await expect(page.locator('#replayReviewPreview')).toBeVisible();
  await page.locator('#resetReplayButton').click();await expect(page.locator('#replayReviewPreview')).toHaveCount(0);
});

test('changing the player while preview modules load discards the stale result', async ({page}) => {
  let release, moduleUrl;
  await page.route('**/ui/replay-review-panel.js*', route => new Promise(resolve => {
    moduleUrl=route.request().url();
    release=async()=>{await route.continue();resolve();};
  }));
  await analyze(page);
  await expect.poll(()=>Boolean(release)).toBe(true);
  await page.locator('#replayPlayer').selectOption('mate');
  await release();
  await page.evaluate(async url=>{await import(url);},moduleUrl);
  await expect(page.locator('#replayReviewPreview')).toHaveCount(0);
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayReviewPreview')).toHaveCount(1);
});

test('ordinary free analysis does not load the review engine or panel even on loopback', async ({page}) => {
  const loaded=[];page.on('request',r=>{if(/replay-coaching-review\.js|replay-review-(panel|response|result|result-session)\.js/.test(r.url()))loaded.push(r.url());});
  await analyze(page,'');
  await expect(page.locator('#replayCoachingPreview')).toBeVisible();await expect(page.locator('#replayReviewPreview')).toHaveCount(0);
  await page.locator('[data-round-jump="4"]').first().click();await expect(page.locator('#replayRound-4')).toBeFocused();
  expect(loaded).toEqual([]);
});

for (const width of [390,1280]) for (const theme of ['light','dark']) test(`saved response cards open their exact evidence at ${width}px in ${theme} mode`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:844});await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
  await analyze(page);const result=await savedResult();await importResult(page,result);
  const cards=page.locator('[data-review-result-cards]');
  await expect(page.locator('[data-review-result-status]')).toHaveAttribute('data-state','ready');await expect(cards.locator('.coaching-card')).toHaveCount(2);
  await expect(cards).toContainText('우세 중 사망 전후');await expect(cards).toContainText('다음 3라운드');
  await cards.locator('[data-review-jump="1"]').click();await expect(page.locator('#reviewAnchor-1')).toBeFocused();
  await expect(page.locator('#reviewAnchor-1')).toContainText('3대1 → 2대1');
  await expect(page.locator('[data-review-flow="1"]')).toHaveAttribute('open','');
  const playback=page.locator('#replayPlayback');
  await playback.locator('.playback-detail>summary').click();
  await playback.locator('[data-playback-player-filter]').selectOption('mate');
  await playback.locator('[data-playback-action="play"]').click();
  await cards.locator('[data-review-playback="round-1"]').click();
  await expect(playback).toBeFocused();await expect(playback.locator('[data-playback-seek]')).toHaveValue('3000');
  await expect(playback.locator('[data-playback-round]')).toHaveText('1라운드');
  await expect(playback.locator('[data-playback-alive-a]')).toContainText('2 / 3명');
  await expect(playback.locator('[data-playback-alive-b]')).toContainText('1 / 3명');
  await expect(playback.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  await expect(playback.locator('[data-playback-player-filter]')).toHaveValue('');
  await cards.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('saved-response.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-review-result-clear]').click();await expect(cards.locator('.coaching-card')).toHaveCount(0);
  await importResult(page,result);await expect(cards.locator('.coaching-card')).toHaveCount(2);
  await page.locator('#replayPlayer').selectOption('mate');await expect(page.locator('#replayReviewPreview')).toHaveCount(0);
  await page.locator('#analyzeReplayButton').click();await expect(page.locator('[data-review-result-cards] .coaching-card')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('a saved round-end reference stays in its evidence round and resumes into the next round',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
  await analyze(page);const result=await savedResult();
  result.response.cards=[{...result.response.cards[0],evidenceRefs:['round-2']}];
  await importResult(page,result);const playback=page.locator('#replayPlayback');
  await page.locator('[data-review-result-cards] [data-review-playback="round-2"]').focus();
  await page.keyboard.press('Enter');await expect(playback).toBeFocused();
  await expect(playback.locator('[data-playback-seek]')).toHaveValue('40000');
  await expect(playback.locator('[data-playback-round]')).toHaveText('2라운드');
  await expect(playback.locator('[data-playback-time]')).toHaveText('00:20.0');
  await playback.locator('[data-playback-action="play"]').click();
  await expect.poll(()=>playback.locator('[data-playback-seek]').inputValue().then(Number)).toBeGreaterThan(40000);
  await expect(playback.locator('[data-playback-round]')).toHaveText('3라운드');
  expect(requests).toEqual([]);
});

test('imported malformed, unrelated and HTML-bearing results fail safely while free analysis stays usable',async({page})=>{
  await analyze(page);const cards=page.locator('[data-review-result-cards]'),status=page.locator('[data-review-result-status]');
  const result=await savedResult();await importResult(page,result);await expect(cards.locator('.coaching-card')).toHaveCount(2);
  await importResult(page,await savedResult('mate'));await expect(status).toHaveAttribute('data-state','mismatch');await expect(cards.locator('.coaching-card')).toHaveCount(0);
  await importResult(page,{private:'not a response'});await expect(status).toHaveAttribute('data-state','invalid');
  const html=structuredClone(result);html.response.cards[0].title='<img src=x onerror=alert(1)>';
  await importResult(page,html);await expect(status).toHaveAttribute('data-state','ready');
  await expect(cards.locator('img')).toHaveCount(0);await expect(cards.locator('h3').first()).toHaveText('<img src=x onerror=alert(1)>');
  await page.locator('[data-review-result-file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await expect(status).toHaveAttribute('data-state','invalid');await expect(cards.locator('.coaching-card')).toHaveCount(0);
  await page.locator('[data-round-jump="4"]').first().click();await expect(page.locator('#replayRound-4')).toBeFocused();
});
