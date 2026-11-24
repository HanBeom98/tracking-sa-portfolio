import {test,expect} from '@playwright/test';
import {contextFixture} from '../fixtures/replay-context.js';
const PAGE='/stats/sudden-attack/replay/';
const upload=(raw,name='test.json')=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});

// Deterministic response ordering without a single Nexon, DB or paid-AI request.
const delayedForecast=`
globalThis.auditTypes=[];globalThis.auditProfiles=[];globalThis.auditForecastCalls=0;
export const getReplayForecastWindow=()=>({eligible:true,matchDate:new Date('2026-10-28')});
export const resolveReplayCategory=()=>new Promise((resolve,reject)=>auditTypes.push({resolve,reject}));
export const loadTeamStrengthProfiles=(_players,_client,category,options)=>{
 auditForecastCalls++;return new Promise((resolve,reject)=>auditProfiles.push({category,resolve,reject,progress:options.onProgress}));
};
export const buildTeamStrengthForecast=profiles=>profiles[0]||null;`;

test.beforeEach(async({context})=>{
 await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
});
async function openDelayed(page){
 await page.route('**/team-strength-forecast.js*',route=>route.fulfill({contentType:'application/javascript',body:delayedForecast}));
 await page.goto(PAGE);await page.locator('#replayFile').setInputFiles(upload(contextFixture()));
 await expect.poll(()=>page.evaluate(()=>auditTypes.length)).toBe(1);
 await page.locator('#replayPlayer').selectOption('focus');
}
async function resolveType(page,index=0,category='solo'){
 await page.evaluate(({index,category})=>auditTypes[index].resolve(category),{index,category});
 await expect.poll(()=>page.evaluate(()=>auditProfiles.length)).toBe(index+1);
}
const forecast=label=>({tone:'neutral',categoryLabel:'solo',confidence:1,verdict:label,basis:'테스트 전력',
 resolved:0,total:0,winner:{won:true,probability:50,available:0,members:[],average:50},loser:null});

test('basic results are usable before type lookup; forecast replaces only its panel and retains playback',async({page})=>{
 await openDelayed(page);await page.locator('#analyzeReplayButton').click();
 await expect(page.locator('#replayResults')).toBeVisible();
 await expect(page.locator('#replayForecast')).toHaveAttribute('data-forecast-state','loading');
 const seek=page.locator('[data-playback-seek]');
 await seek.evaluate(el=>{el.value='500';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const position=await seek.inputValue();
 await page.locator('#replayPlayback').evaluate(el=>{window.auditPlayback=el;});
 await resolveType(page);
 await page.evaluate(value=>auditProfiles[0].resolve([value]),forecast('전력 갱신 완료'));
 await expect(page.locator('#replayForecast')).toContainText('전력 갱신 완료');
 expect(await page.locator('#replayPlayback').evaluate(el=>el===window.auditPlayback)).toBe(true);
 await expect(seek).toHaveValue(position);
 expect(await page.evaluate(()=>auditForecastCalls)).toBe(1);
});

test('changing players cannot resurrect the old results when a delayed forecast completes',async({page})=>{
 await openDelayed(page);await resolveType(page);await page.locator('#analyzeReplayButton').click();
 await page.locator('#replayPlayer').selectOption('mate');
 await page.evaluate(value=>auditProfiles[0].resolve([value]),forecast('동일 경기 전력'));
 await expect(page.locator('#replayResults')).toBeHidden();
 await expect(page.locator('#replayPlayer')).toHaveValue('mate');
 await page.locator('#analyzeReplayButton').click();
 await expect(page.locator('#replayResults .result-player strong')).toHaveText('mate');
 await expect(page.locator('#replayForecast')).toContainText('동일 경기 전력');
 expect(await page.evaluate(()=>auditForecastCalls)).toBe(1);
});

for(const phase of ['type','profiles'])test(`reset ignores late ${phase} progress, success and failure`,async({page})=>{
 await openDelayed(page);if(phase==='profiles')await resolveType(page);
 await page.locator('#analyzeReplayButton').click();await page.locator('#resetReplayButton').click();
 await page.evaluate(phase=>{
  if(phase==='type')auditTypes[0].reject(new Error('late type failure'));
  else{auditProfiles[0].progress({completed:1,total:1,successful:1});auditProfiles[0].reject(new Error('late forecast failure'));}
 },phase);
 await expect(page.locator('#replayFileStatus')).toHaveText('아직 선택한 파일이 없습니다.');
 await expect(page.locator('#replayFileStatus')).not.toHaveAttribute('data-tone','error');
 await expect(page.locator('#replayResults')).toBeHidden();
 await expect(page.locator('#playerStep')).toBeHidden();
});

test('a new file and its forecast win over earlier progress and completion',async({page})=>{
 await openDelayed(page);await resolveType(page);await page.locator('#analyzeReplayButton').click();
 const next=contextFixture();next.replay_info.replayMatchSummaryInfo.mapName='두 번째 파일';
 next.replay_info.replayMatchSummaryInfo.matchID='second-file';
 await page.locator('#replayFile').setInputFiles(upload(next,'second.json'));
 await expect.poll(()=>page.evaluate(()=>auditTypes.length)).toBe(2);
 await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
 await resolveType(page,1);
 await page.evaluate(value=>auditProfiles[1].resolve([value]),forecast('새 파일 전력'));
 await expect(page.locator('#replayForecast')).toContainText('새 파일 전력');
 await page.evaluate(value=>{auditProfiles[0].progress({completed:9,total:10,successful:9});auditProfiles[0].resolve([value]);},forecast('이전 파일 전력'));
 await expect(page.locator('#replayForecast')).toContainText('새 파일 전력');
 await expect(page.locator('#replayResults h2').first()).toContainText('두 번째 파일');
 await expect(page.locator('#replayFileStatus')).not.toContainText('9/10');
});

test('failed automatic type lookup preserves basic results and permits a manual forecast',async({page})=>{
 await openDelayed(page);await page.locator('#analyzeReplayButton').click();
 await page.evaluate(()=>auditTypes[0].reject(new Error('type unavailable')));
 await expect(page.locator('#replayResults')).toBeVisible();
 await expect(page.locator('#replayCategory')).toBeEnabled();
 await page.locator('#replayCategory').selectOption('party');
 await page.locator('#analyzeReplayButton').click();
 await page.evaluate(value=>auditProfiles[0].resolve([value]),forecast('수동 기준 전력'));
 await expect(page.locator('#replayForecast')).toContainText('수동 기준 전력');
});

test('a newer manual category ignores the previous category response',async({page})=>{
 await openDelayed(page);await page.evaluate(()=>auditTypes[0].resolve(''));
 await expect(page.locator('#replayCategory')).toBeEnabled();
 await page.locator('#replayCategory').selectOption('solo');await page.locator('#analyzeReplayButton').click();
 await page.locator('#replayCategory').selectOption('party');await page.locator('#analyzeReplayButton').click();
 await page.evaluate(value=>auditProfiles[1].resolve([value]),forecast('파티 기준'));
 await expect(page.locator('#replayForecast')).toContainText('파티 기준');
 await page.evaluate(value=>auditProfiles[0].resolve([value]),forecast('솔로 기준'));
 await expect(page.locator('#replayForecast')).toContainText('파티 기준');
 await expect(page.locator('#replayCategory')).toHaveValue('party');
});

for(const width of [390,1280])test(`fictional single and comparison samples run without API calls at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});const api=[],errors=[];
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(PAGE);await page.locator('[data-replay-sample="single"]').click();
 await expect(page.locator('#replayPlayback')).toBeVisible();
 await expect(page.locator('#replaySampleNotice')).toBeVisible();
 await expect(page.locator('#replayResults')).toContainText('샘플 체험 · 가상의 경기 기록');
 await expect(page.locator('#replayResults .result-player strong')).toHaveText('체험 플레이어');
 await expect(page.locator('#replayCategory')).toBeDisabled();
 await expect(page.locator('#replayForecast')).toContainText('외부 전력 조회 없이');
 await page.locator('[data-replay-sample="compare"]').click();
 await expect(page.locator('#replayComparePanel')).toBeVisible();
 await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
 await expect(page.locator('[data-comparison-player]')).toHaveValue('sample-player');
 await expect(page.locator('#replayComparisonSampleNotice')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:info.outputPath(`sample-${width}.png`),fullPage:true});
 await page.locator('[data-comparison-clear]').click();
 await expect(page.locator('#replayComparisonSampleNotice')).toBeHidden();
 await page.locator('#replaySingleTab').click();
 await page.locator('#replayFile').setInputFiles(upload(contextFixture()));
 await expect(page.locator('#replaySampleNotice')).toBeHidden();
 await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
 await expect(page.locator('#replayResults .result-player strong')).toHaveText('focus');
 await expect(page.locator('#replayResults .result-hero')).not.toContainText('샘플 체험');
 expect(api).toEqual([]);expect(errors).toEqual([]);
});

test('switching to a sample invalidates previous type lookup and its network work',async({page})=>{
 await openDelayed(page);await page.locator('[data-replay-sample="single"]').click();
 await expect(page.locator('#replayPlayback')).toBeVisible();
 await page.evaluate(()=>auditTypes[0].resolve('solo'));
 await expect(page.locator('#replayCategory')).toBeDisabled();
 await expect(page.locator('#replayCategory')).toHaveValue('');
 expect(await page.evaluate(()=>auditForecastCalls)).toBe(0);
});

for (const phase of ['type', 'profiles']) test(`page disposal ignores late ${phase} responses and progress`, async ({ page }) => {
  await openDelayed(page);
  if (phase === 'profiles') await resolveType(page);
  await page.locator('#analyzeReplayButton').click();
  const before = await page.locator('#replayFileStatus').textContent();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
  await page.evaluate(phase => {
    if (phase === 'type') auditTypes[0].resolve('solo');
    else {
      auditProfiles[0].progress({ completed: 10, total: 10, successful: 10 });
      auditProfiles[0].resolve([{ verdict: '폐기된 전력' }]);
    }
  }, phase);
  await expect(page.locator('#replayPlayback')).toHaveCount(0);
  await expect(page.locator('#replayFileStatus')).toHaveText(before);
  await expect(page.locator('#replayForecast')).not.toContainText('폐기된 전력');
  expect(await page.evaluate(() => auditForecastCalls)).toBe(phase === 'type' ? 0 : 1);
});

test('BFCache pagehide retains the session and a pending forecast', async ({ page }) => {
  await openDelayed(page); await resolveType(page);
  await page.locator('#analyzeReplayButton').click();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.evaluate(value => auditProfiles[0].resolve([value]), forecast('복귀 가능한 전력'));
  await expect(page.locator('#replayForecast')).toContainText('복귀 가능한 전력');
  await expect(page.locator('#replayPlayback')).toBeVisible();
  await page.locator('#replayPlayer').selectOption('mate');
  await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayResults .result-player strong')).toHaveText('mate');
});
