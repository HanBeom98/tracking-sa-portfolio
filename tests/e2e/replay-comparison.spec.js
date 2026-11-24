import { test,expect } from '@playwright/test';
import { makeRound,makeReplay } from '../fixtures/replay-context.js';
const PAGE='/stats/sudden-attack/replay/';
function fixtures(){
  const a=makeReplay([makeRound([[10,'enemy1','focus']])]),b=makeReplay([makeRound([[10,'focus','enemy1']]),makeRound([],{no:2}),makeRound([],{no:3})]);
  for(const [i,raw] of [a,b].entries()){
    raw.replay_info.replayMatchSummaryInfo.matchID=`comparison-${i}`;
    raw.replay_info.replayCharacterSummaryInfo[0].nickName=i?'disguise':'Tracking';
  }
  return [a,b];
}
const upload=(raw,i=0)=>({name:`comparison-${i}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
});
async function open(page){await page.goto(PAGE);await page.locator('#replayCompareTab').click();}

for(const width of [390,1280])for(const theme of ['light','dark'])test(`local multi-match table preserves identity, weighted metrics and viewport at ${width}px ${theme}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  const api=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await open(page);await page.locator('[data-comparison-files]').setInputFiles(fixtures().map(upload));
  await expect(page.locator('#replaySinglePanel')).toBeHidden();await expect(page.locator('#replayComparePanel')).toBeVisible();
  await expect(page.locator('#replayCompareTab')).toHaveAttribute('aria-selected','true');
  const root=page.locator('#replayComparison');await expect(root.locator('[data-comparison-status]')).toHaveAttribute('data-state','ready');
  await expect(root.locator('tbody tr')).toHaveCount(2);await expect(root.locator('tbody')).toContainText('Tracking');await expect(root.locator('tbody')).toContainText('disguise');
  await expect(root.locator('.comparison-totals')).toContainText('4 / 4');await expect(root.locator('.comparison-totals')).toContainText('15.3초');
  await expect(root.locator('tfoot')).toContainText('0.25');await expect(root.locator('tfoot')).toContainText('75.0%');
  await page.locator('#replayCompareTab').focus();await page.keyboard.press('Home');
  await expect(page.locator('#replaySingleTab')).toBeFocused();await expect(root).toBeHidden();
  await page.keyboard.press('ArrowRight');await expect(page.locator('#replayCompareTab')).toBeFocused();
  await expect(root).toBeVisible();await expect(root.locator('tbody tr')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await root.locator('.comparison-table-scroll').focus();await page.keyboard.press('ArrowRight');
  if(width===390)await expect.poll(()=>root.locator('.comparison-table-scroll').evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  await root.locator('.comparison-table-scroll').evaluate(el=>el.scrollLeft=0);
  await page.evaluate(()=>window.scrollTo(0,0));const bounds=await root.boundingBox();
  await page.screenshot({path:info.outputPath(`comparison-${width}-${theme}.png`),fullPage:true,clip:bounds});
  await root.locator('[data-comparison-player]').selectOption('mate');await expect(root.locator('tfoot')).toContainText('100.0%');
  await root.locator('[data-comparison-clear]').click();await expect(root.locator('[data-comparison-status]')).toHaveAttribute('data-state','empty');
  await expect(root.locator('table')).toHaveCount(0);await expect(root.locator('[data-comparison-player]')).toBeDisabled();
  expect(api).toEqual([]);expect(errors).toEqual([]);
});

test('comparison rejects duplicates and excessive files, escapes strings and preserves valid files beside invalid input',async({page})=>{
  await open(page);const raws=fixtures(),root=page.locator('#replayComparison'),input=root.locator('[data-comparison-files]');
  await input.setInputFiles(upload(raws[0]));await expect(root.locator('[data-comparison-status]')).toContainText('파일 1개');
  await input.setInputFiles([upload(raws[0]),upload(raws[0],1)]);
  await expect(root.locator('[data-comparison-status]')).toHaveAttribute('data-state','insufficient');
  await expect(root.locator('[data-comparison-issues]')).toContainText('중복 제외');
  await input.setInputFiles(Array.from({length:6},(_,i)=>upload(raws[0],i)));
  await expect(root.locator('[data-comparison-status]')).toHaveAttribute('data-state','limit');await expect(root.locator('table')).toHaveCount(0);
  const bad='<img src=x onerror="window.comparisonInjected=1">';raws[0].replay_info.replayCharacterSummaryInfo[0].nickName=bad;raws[0].replay_info.replayMatchSummaryInfo.mapName=bad;
  await input.setInputFiles([...raws.map(upload),{name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')}]);
  await expect(root.locator('[data-comparison-status]')).toHaveAttribute('data-state','ready');
  await expect(root.locator('[data-comparison-issues]')).toContainText('broken.json');await expect(root.locator('tbody')).toContainText(bad);
  await expect(root.locator('img')).toHaveCount(0);expect(await page.evaluate(()=>window.comparisonInjected)).toBeUndefined();
});

test('multi-match comparison and clearing it leave the existing single-match playback available',async({page})=>{
  await page.goto(PAGE);await page.locator('#replayFile').setInputFiles(upload(fixtures()[0]));
  await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
  const playback=page.locator('#replayPlayback');await expect(playback).toBeVisible();
  const seek=playback.locator('[data-playback-seek]');await seek.evaluate(el=>{el.value='500';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await playback.locator('[data-playback-action="play"]').click();
  await page.locator('#replayCompareTab').click();
  await expect(playback).toBeHidden();await expect(playback.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  const paused=await seek.inputValue();await page.waitForTimeout(150);await expect(seek).toHaveValue(paused);
  await page.locator('[data-comparison-files]').setInputFiles(fixtures().map(upload));
  await expect(page.locator('[data-comparison-status]')).toHaveAttribute('data-state','ready');
  await page.locator('[data-comparison-player]').selectOption('mate');
  await page.locator('#replaySingleTab').click();await expect(playback).toBeVisible();await expect(seek).toHaveValue(paused);
  await expect(page.locator('#replayPlayer')).toHaveValue('focus');
  await page.locator('#replayCompareTab').click();await expect(page.locator('[data-comparison-player]')).toHaveValue('mate');
  await expect(page.locator('#replayComparison tbody tr')).toHaveCount(2);
  await page.locator('[data-comparison-clear]').click();await expect(seek).toHaveValue(paused);
  await page.locator('#replaySingleTab').click();
  await playback.locator('[data-playback-action="play"]').click();await expect.poll(()=>seek.inputValue().then(Number)).toBeGreaterThan(Number(paused));
});

for(const width of [390,1280])for(const theme of ['light','dark'])test(`manual before/after goals preserve focus, weighted changes and reset at ${width}px ${theme}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  const requests=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await open(page);const input=page.locator('[data-comparison-files]');await input.setInputFiles(fixtures().map(upload));
  const panel=page.locator('[data-progress-panel]');await panel.locator('summary').click();
  await expect(panel.locator('[data-progress-result]')).toContainText('각각 1개 이상');
  const first=panel.locator('[data-progress-group="0"]'),second=panel.locator('[data-progress-group="1"]');
  await first.focus();await first.selectOption('before');await expect(first).toBeFocused();
  await second.focus();await second.selectOption('after');await expect(second).toBeFocused();
  await expect(panel.locator('.progress-status')).toContainText('목표 방향');
  await expect(panel.locator('.progress-table')).toContainText('-100.0%p');
  await panel.locator('[data-progress-goal]').focus();await panel.locator('[data-progress-goal]').selectOption('survivedPercent');
  await expect(panel.locator('[data-progress-goal]')).toBeFocused();await expect(panel.locator('.progress-selected')).toContainText('+100.0%p');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));const bounds=await panel.boundingBox();
  await page.screenshot({path:info.outputPath(`progress-${width}-${theme}.png`),fullPage:true,clip:bounds});
  await page.locator('[data-comparison-player]').selectOption('mate');await expect(first).toHaveValue('before');await expect(second).toHaveValue('after');
  await expect(panel.locator('.progress-status')).toContainText('표시 정밀도에서 차이가 없습니다');
  await panel.locator('[data-progress-reset]').click();await expect(first).toHaveValue('unassigned');await expect(panel.locator('table')).toHaveCount(0);
  await expect(page.locator('[data-comparison-result]>.comparison-table-scroll table')).toHaveCount(1);
  await first.selectOption('before');await second.selectOption('after');await input.setInputFiles(fixtures().map(upload));
  await expect(first).toHaveValue('unassigned');await expect(second).toHaveValue('unassigned');
  await page.locator('[data-comparison-clear]').click();await expect(panel).toHaveCount(0);
  expect(requests).toEqual([]);expect(errors).toEqual([]);
});
