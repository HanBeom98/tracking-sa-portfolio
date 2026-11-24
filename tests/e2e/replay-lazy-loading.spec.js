import {test,expect} from '@playwright/test';
import {contextFixture} from '../fixtures/replay-context.js';
import {analyzeReplay} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {createMockReplayCoachingResponse} from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
const PAGE='/stats/sudden-attack/replay/';
const comparisonPath='/ui/replay-comparison.js';
const mockPath='/ui/replay-coaching-local.js';
const upload=(name='old.json')=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(contextFixture()))});

test.beforeEach(async({context})=>{
 await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
});
const requests=page=>{
 const paths=[];page.on('request',r=>paths.push(new URL(r.url()).pathname));return paths;
};

test('normal single analysis defers comparison and local mock modules; opening twice preserves the session',async({page})=>{
 const paths=requests(page);await page.goto(PAGE);await page.waitForLoadState('networkidle');
 expect(paths.some(p=>p.endsWith(comparisonPath)||p.endsWith(mockPath)||p.endsWith('/application/replay-coaching-session.js'))).toBe(false);
 await page.locator('[data-replay-sample="single"]').click();await expect(page.locator('#replayPlayback')).toBeVisible();
 expect(paths.some(p=>p.endsWith(comparisonPath)||p.endsWith(mockPath))).toBe(false);
 await page.locator('[data-replay-sample="compare"]').click();
 await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
 await page.locator('[data-comparison-player]').selectOption('sample-ally-1');
 await page.locator('#replaySingleTab').click();await page.locator('#replayCompareTab').click();
 await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
 await expect(page.locator('[data-comparison-player]')).toHaveValue('sample-ally-1');
 expect(paths.filter(p=>p.endsWith(comparisonPath))).toHaveLength(1);
 expect(paths.some(p=>p.endsWith(mockPath))).toBe(false);
});

test('keyboard opening triggers comparison without moving focus out of its tab',async({page})=>{
 const paths=requests(page);await page.goto(PAGE);await page.locator('#replaySingleTab').focus();await page.keyboard.press('ArrowRight');
 await expect(page.locator('#replayCompareTab')).toBeFocused();
 await expect(page.locator('#replayComparison')).toHaveAttribute('aria-busy','false');
 await expect(page.locator('[data-comparison-files]')).toBeEnabled();
 expect(paths.filter(p=>p.endsWith(comparisonPath))).toHaveLength(1);
});

test('a slow comparison import keeps single analysis usable and accepts early file selection once',async({page})=>{
 let release;const paths=requests(page);
 await page.route('**/ui/replay-comparison.js*',route=>new Promise(resolve=>{release=async()=>{await route.continue();resolve();};}));
 await page.goto(PAGE);await page.locator('#replayCompareTab').click();
 await expect.poll(()=>Boolean(release)).toBe(true);
 await expect(page.locator('#replayComparison')).toHaveAttribute('aria-busy','true');
 await expect(page.locator('[data-comparison-files]')).toBeDisabled();
 const second=contextFixture();second.replay_info.replayMatchSummaryInfo.matchID='second-lazy-file';
 // Simulate a restored/programmatic FileList before the event handlers mount.
 await page.locator('[data-comparison-files]').setInputFiles([upload(),{...upload('second.json'),buffer:Buffer.from(JSON.stringify(second))}]);
 await page.locator('#replaySingleTab').click();await page.locator('[data-replay-sample="single"]').click();
 await expect(page.locator('#replayPlayback')).toBeVisible();
 await release();await page.locator('#replayCompareTab').click();
 await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
 expect(paths.filter(p=>p.endsWith(comparisonPath))).toHaveLength(1);
});

test('a comparison import failure gives an error and leaves single-file analysis available',async({page})=>{
 await page.route('**/ui/replay-comparison.js*',route=>route.abort());await page.goto(PAGE);
 await page.locator('#replayCompareTab').click();
 await expect(page.locator('[data-comparison-status]')).toHaveAttribute('data-state','error');
 await expect(page.locator('[data-comparison-status]')).toContainText('새로고침');
 await expect(page.locator('#replayComparison')).toHaveAttribute('aria-busy','false');
 await page.locator('#replaySingleTab').click();await page.locator('#replayFile').setInputFiles(upload());
 await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
 await expect(page.locator('#replayPlayback')).toBeVisible();
});

test('leaving the page while comparison code loads prevents mounting after disposal',async({page})=>{
 let release,moduleUrl;
 await page.route('**/ui/replay-comparison.js*',route=>new Promise(resolve=>{moduleUrl=route.request().url();release=async()=>{await route.continue();resolve();};}));
 await page.goto(PAGE);await page.locator('#replayCompareTab').click();await expect.poll(()=>Boolean(release)).toBe(true);
 await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
 await release();await page.evaluate(async url=>{await import(url);},moduleUrl);
 await expect(page.locator('[data-comparison-status]')).toHaveText('비교 화면을 준비하고 있습니다…');
 await expect(page.locator('[data-comparison-files]')).toBeDisabled();
});

test('local mock code loads only on the exact opt-in and attaches to the latest analysis after a delay',async({page})=>{
 let release,moduleUrl;const calls=[];
 await page.route('**/auth/infra/auth-gateway.js*',route=>route.fulfill({contentType:'application/javascript',body:`export const getCurrentUser=()=>({uid:'local-fake-user',getIdToken:async()=> 'local-fake-token'});export const subscribeAuthState=listener=>{listener();return()=>{};};`}));
 await page.route('**/api/replay-coaching',async route=>{
  const body=route.request().postDataJSON();calls.push(body);
  await route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'mock',outcome:'completed',requestId:body.requestId,used:1,response:createMockReplayCoachingResponse(body.evidence)})});
 });
 await page.route('**/ui/replay-coaching-local.js*',route=>new Promise(resolve=>{moduleUrl=route.request().url();release=async()=>{await route.continue();resolve();};}));
 const paths=requests(page);await page.goto(PAGE+'?coaching=mock');await expect.poll(()=>Boolean(release)).toBe(true);
 await page.locator('#replayFile').setInputFiles(upload());await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
 await page.locator('#replayPlayer').selectOption('mate');await page.locator('#analyzeReplayButton').click();
 await release();await page.evaluate(async url=>{await import(url);},moduleUrl);
 await expect(page.locator('[data-coaching-request]')).toBeVisible();
 await expect(page.locator('#replayResults .result-player strong')).toHaveText('mate');
 await expect(page.locator('[data-coaching-request]')).toBeEnabled();
 await page.locator('[data-coaching-request]').click();
 await expect(page.locator('[data-coaching-status]')).toContainText('서버 모의 해설 확인 완료');
 expect(calls).toHaveLength(1);
 expect(calls[0].evidence).toEqual(analyzeReplay(contextFixture(),'mate').coachingEvidence);
 expect(paths.filter(p=>p.endsWith(mockPath))).toHaveLength(1);
 expect(paths.some(p=>p.endsWith(comparisonPath))).toBe(false);
});

test('reset or disposal while a mock module loads cannot reattach an old result',async({page})=>{
 let release,moduleUrl;
 await page.route('**/ui/replay-coaching-local.js*',route=>new Promise(resolve=>{moduleUrl=route.request().url();release=async()=>{await route.continue();resolve();};}));
 await page.goto(PAGE+'?coaching=mock');await expect.poll(()=>Boolean(release)).toBe(true);
 await page.locator('#replayFile').setInputFiles(upload());await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
 await page.locator('#resetReplayButton').click();await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
 await release();await page.evaluate(async url=>{await import(url);},moduleUrl);
 await expect(page.locator('#replayResults')).toBeHidden();await expect(page.locator('[data-coaching-request]')).toHaveCount(0);
});
