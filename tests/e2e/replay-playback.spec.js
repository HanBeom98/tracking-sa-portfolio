import { test, expect } from '@playwright/test';
import { makeRound, makeReplay } from '../fixtures/replay-context.js';
import fs from 'node:fs/promises';
const PAGE='/stats/sudden-attack/replay/';
function fixture(fullTeams=false){
  const teams=fullTeams?{focus:0,mate:0,spare:0,extraA:0,extraB:0,enemy1:1,enemy2:1,enemy3:1,enemy4:1,enemy5:1}:undefined;
  const a={...makeRound([[10,'enemy1','mate'],[40,'focus','enemy1'],[70,'enemy2','spare']],{teams}),replayBombInfo:[
    {timeStamp:80,bombEventType:0,teamNo:0,nexonSN:'focus',nickName:'focus'}, {timeStamp:150,bombEventType:2,teamNo:1,nexonSN:'enemy2',nickName:'enemy2'}]};
  return makeReplay([a,{...makeRound([[30,'enemy1','focus']],{no:2,offenseTeam:1,winTeam:0,teams}),replayBombInfo:[]}],teams);
}
test.beforeEach(async({context})=>{
  await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
});
async function load(page,data=fixture()){
  await page.goto(PAGE);
  await page.locator('#replayFile').setInputFiles({name:'local-playback.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('#replayPlayer').selectOption('focus');await page.locator('#analyzeReplayButton').click();
  await expect(page.locator('#replayPlayback')).toBeVisible();
}
async function openPlaybackDetails(root){
  const detail=root.locator('.playback-detail');
  if(!await detail.evaluate(el=>el.open))await detail.locator('summary').click();
}
async function seek(page,ms){await page.locator('[data-playback-seek]').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},ms);}
async function savePreviewPNG(page) {
  const dialog=page.locator('#replayImageShareDialog'); await expect(dialog).toBeVisible();
  await dialog.locator('[data-image-save]').click(); await dialog.locator('[data-image-close]').click();
}

function rankedFixture(winners) {
  let half = [0,0], switched = false;
  const rounds = winners.map((winner,i) => {
    const round = {...makeRound([], {no:i+1,winTeam:winner,offenseTeam:switched?1:0}),replayBombInfo:[]};
    half[winner]++;
    if(!switched && half[winner]===3){switched=true;half=[0,0];}
    return round;
  });
  const data=makeReplay(rounds),score=[winners.filter(w=>w===0).length,winners.filter(w=>w===1).length];
  Object.assign(data.replay_info.replayMatchSummaryInfo,{matchType:'R',teamAWinCnt:score[0],teamBWinCnt:score[1],winTeam:score[0]>score[1]?0:1});
  return data;
}

for(const width of [390,1280])test(`ranked match estimate preserves halftime lead, clinches and exports at ${width}px`,async({page},info)=>{
  await downloadOnly(page);await page.setViewportSize({width,height:900});
  await page.addInitScript(theme=>localStorage.setItem('theme',theme),width===390?'light':'dark');
  const calls=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await load(page,rankedFixture([0,0,0,0]));const root=page.locator('#replayPlayback');
  await seek(page,60000);
  await expect(root.locator('[data-playback-score]')).toHaveText('3 : 0');
  await expect(root.locator('[data-playback-round]')).toContainText('후반');
  await expect(root.locator('[data-playback-index-a]')).toHaveText('93.8%');
  await expect(root.locator('[data-playback-dominance]')).toContainText('경기 승리 추정');
  await root.getByText('경기 승리 추정치 계산 기준 · 실측 승률이 아닙니다',{exact:true}).click();
  await expect(root.locator('.playback-method')).toContainText('골든라운드');
  await root.getByText('경기 승리 추정치 계산 기준 · 실측 승률이 아닙니다',{exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  const bounds=await root.boundingBox();
  await page.screenshot({path:info.outputPath(`ranked-match-${width}.png`),fullPage:true,clip:bounds});
  const waiting=page.waitForEvent('download');await root.locator('[data-share-playback]').click();await savePreviewPNG(page);
  await checkPNG(await waiting,info.outputPath(`ranked-share-${width}.png`),1080,1080);
  await seek(page,80000);await expect(root.locator('[data-playback-index-a]')).toHaveText('100.0%');
  await expect(root.locator('[data-playback-index-b]')).toHaveText('0.0%');
  await expect(root.locator('[data-playback-round]')).toContainText('승리 확정');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(calls).toEqual([]);expect(errors).toEqual([]);
});

test('ranked 4:2 stays in progress and 5:5 enters golden round before the final result',async({page})=>{
  await load(page,rankedFixture([0,1,0,1,0,0,1,1,0,1,1]));
  const root=page.locator('#replayPlayback');await seek(page,120000);
  await expect(root.locator('[data-playback-score]')).toHaveText('4 : 2');
  await expect(root.locator('[data-playback-round]')).toContainText('후반');
  await expect(root.locator('[data-playback-index-a]')).not.toHaveText('100.0%');
  await seek(page,200000);await expect(root.locator('[data-playback-score]')).toHaveText('5 : 5');
  await expect(root.locator('[data-playback-round]')).toContainText('골든라운드');
  await expect(root.locator('[data-playback-index-a]')).toHaveText('50.0%');
  await seek(page,220000);await expect(root.locator('[data-playback-index-b]')).toHaveText('100.0%');
});
for(const width of [390,1280])for(const theme of ['light','dark'])test(`local playback synchronizes graph, survivors, bomb and events at${width}px ${theme}`,async({page},info)=>{
  const api=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  const desktop=width>=980,size=desktop?5:3,height=desktop?720:900;
  await page.setViewportSize({width,height});await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);await load(page,fixture(desktop));
  const root=page.locator('#replayPlayback');await expect(root.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  await expect(root.locator('[data-playback-dot-b]')).toHaveCount(0);
  await expect(root.locator('.playback-dot')).toHaveCount(1);
  await expect(root.locator('#playback-chart-desc')).toContainText('50보다 높으면 A팀 우세');
  await expect(root.locator('[data-playback-index-a]')).toHaveText('50.0점');await expect(root.locator('[data-playback-alive-a]')).toContainText(`${size} / ${size}명`);
  await seek(page,10000);await expect(root.locator('[data-playback-alive-a]')).toContainText(`${size-2} / ${size}명`);await expect(root.locator('[data-playback-alive-b]')).toContainText(`${size-1} / ${size}명`);
  await expect(root.locator('[data-playback-scene-title]')).toHaveText('C4 설치 · focus');
  await expect(root.locator('[data-playback-scene-body]')).toContainText('00:08.0');
  await expect(root.locator('[data-playback-bomb]')).toHaveText('C4 설치됨');await expect(root.locator('[data-playback-event-count]')).toContainText('4 / 5건');
  if(desktop){
    await page.locator('.result-nav a[href="#replayPlayback"]').click();
    const visible=await root.boundingBox();
    expect(visible.height).toBeLessThanOrEqual(height-100);
    expect(visible.y).toBeGreaterThanOrEqual(60);
    expect(visible.y+visible.height).toBeLessThanOrEqual(height-8);
  }
  // Capture the document region with the page at its top so the fixed header
  // does not cover the middle of a panel taller than the viewport.
  await page.evaluate(()=>window.scrollTo(0,0));
  const bounds=await root.boundingBox();
  await page.screenshot({path:info.outputPath(`playback-${width}-${theme}.png`),fullPage:true,clip:bounds});
  await root.getByText('지수 계산 기준 · 승리 확률이 아닙니다',{exact:true}).click();await expect(root.locator('.playback-method')).toContainText('실측 승리 확률이나 AI 예측이 아니며');
  await root.getByText('지수 계산 기준 · 승리 확률이 아닙니다',{exact:true}).click();
  await seek(page,0);await expect(root.locator('[data-playback-alive-a]')).toContainText(`${size} / ${size}명`);await expect(root.locator('[data-playback-events]')).toContainText('사건이 없습니다');
  await root.locator('[data-playback-round-jump="1"]').click();
  await expect(root.locator('[data-playback-round-jump="1"]')).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('[data-playback-scene-title]')).toHaveText('기록된 사건 없음');
  await expect(root.locator('[data-playback-score]')).toHaveText('0 : 1');await expect(root.locator('[data-playback-round]')).toHaveText('2라운드');
  await root.locator('[data-playback-action="previous"]').click();await expect(root.locator('[data-playback-score]')).toHaveText('0 : 0');
  await root.locator('[data-playback-seek]').focus();await page.keyboard.press('ArrowRight');await expect(root.locator('[data-playback-time]')).toHaveText('00:00.1');
  await page.keyboard.press('End');await expect(root.locator('[data-playback-state]')).toHaveText('재생 완료');await expect(root.locator('[data-playback-score]')).toHaveText('1 : 1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(api).toEqual([]);expect(errors).toEqual([]);
});
test('play, speed, pause and pagehide never fetch data and reset disposes the running playback',async({page})=>{
  const calls=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await load(page);const root=page.locator('#replayPlayback'),play=root.locator('[data-playback-action="play"]');await root.locator('[data-playback-speed]').selectOption('4');
  await play.click();await expect.poll(()=>root.locator('[data-playback-seek]').inputValue().then(Number)).toBeGreaterThan(500);
  await play.click();const paused=await root.locator('[data-playback-seek]').inputValue();await page.waitForTimeout(200);expect(await root.locator('[data-playback-seek]').inputValue()).toBe(paused);
  await play.click();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await expect(play).toHaveAttribute('aria-pressed','false');
  await play.click();await page.locator('#resetReplayButton').click();await expect(root).toHaveCount(0);await expect(page.locator('#replayResults')).toBeHidden();
  await page.waitForTimeout(150);expect(calls).toEqual([]);expect(errors).toEqual([]);
});
test('incomplete rounds keep event records but display no invented survivors or advantage',async({page})=>{
  const data=fixture();data.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin=1;await load(page,data);
  const root=page.locator('#replayPlayback');await expect(root.locator('[data-playback-warning]')).toContainText('1R');await expect(root.locator('[data-playback-index-a]')).toHaveText('확인 보류');
  await expect(root.locator('[data-playback-alive-track-a]')).toBeHidden();
  await expect(root.locator('[data-playback-scene-body]')).toContainText('생존 인원 확인 보류');
  await seek(page,10000);await expect(root.locator('[data-playback-alive-a]')).toHaveText('인원 확인 보류');await expect(root.locator('[data-playback-events]')).toContainText('enemy1');
  await root.locator('[data-playback-round-select]').selectOption('1');await expect(root.locator('[data-playback-alive-a]')).toContainText('3 / 3명');await expect(root.locator('[data-playback-index-a]')).not.toHaveText('확인 보류');
});
test('names and weapons are literal text and changing the selected player clears the old playback',async({page})=>{
  const data=fixture(),bad='<img src=x onerror="window.playbackInjected=1">';
  data.replay_info.replayCharacterSummaryInfo.find(p=>p.nexonSN==='focus').nickName=bad;
  data.replay_info.replayRoundInfo[0].replayRoundSummaryInfo.find(p=>p.nexonSN==='focus').nickName=bad;
  data.replay_info.replayRoundInfo[0].replayAttackInfo[1].itemName='<svg onload="window.playbackInjected=1">';
  await load(page,data);await seek(page,5000);const root=page.locator('#replayPlayback');await expect(root.locator('[data-playback-roster-a]')).toContainText(bad);await expect(root.locator('[data-playback-events]')).toContainText('<svg onload=');
  await expect(root.locator('[data-playback-player-filter] option[value="focus"]')).toContainText(bad);
  await expect(root.locator('img,svg:not([data-playback-chart])')).toHaveCount(0);expect(await page.evaluate(()=>window.playbackInjected)).toBeUndefined();
  await page.locator('#replayPlayer').selectOption('mate');await expect(root).toHaveCount(0);await page.locator('#analyzeReplayButton').click();await expect(root).toBeVisible();
});

test('player filtering keeps playback state, follows round changes and resets with new analysis',async({page})=>{
  const calls=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});
  await load(page);await seek(page,10000);const root=page.locator('#replayPlayback'),filter=root.locator('[data-playback-player-filter]');
  await openPlaybackDetails(root);
  const scene=await root.locator('[data-playback-scene-title]').textContent();
  const before=await root.locator('[data-playback-index-a]').textContent();
  await filter.selectOption('focus');await expect(root.locator('[data-playback-events] li')).toHaveCount(2);
  await expect(root.locator('[data-playback-events]')).toContainText('C4 설치');
  await expect(root.locator('[data-playback-events]')).not.toContainText('enemy1 → mate');
  await expect(root.locator('[data-playback-event-count]')).toContainText('2 / 2건 · 선택 선수');
  await expect(root.locator('[data-playback-seek]')).toHaveValue('10000');
  await expect(root.locator('[data-playback-index-a]')).toHaveText(before);
  await expect(root.locator('[data-playback-scene-title]')).toHaveText(scene);
  await filter.selectOption('mate');await expect(root.locator('[data-playback-event-count]')).toContainText('1 / 1건');
  await filter.selectOption('enemy3');await expect(root.locator('[data-playback-events]')).toContainText('선택 선수로 확인된 사건이 없습니다');
  await filter.selectOption('');await expect(root.locator('[data-playback-event-count]')).toContainText('4 / 5건');
  await filter.selectOption('focus');await root.locator('[data-playback-round-select]').selectOption('1');
  await expect(filter).toHaveValue('focus');await expect(root.locator('[data-playback-event-count]')).toContainText('0 / 1건');
  await seek(page,24000);await expect(root.locator('[data-playback-events]')).toContainText('enemy1 → focus');
  const play=root.locator('[data-playback-action="play"]');await play.click();await filter.selectOption('mate');
  await expect(play).toHaveAttribute('aria-pressed','true');await play.click();
  await page.locator('#analyzeReplayButton').click();await expect(filter).toHaveValue('');
  expect(calls).toEqual([]);
});

test('turning point buttons pause playback and seek within the correct round without API calls',async({page})=>{
  const calls=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});
  const data=makeReplay([{...makeRound([[80,'enemy1','mate']]),replayBombInfo:[]},
    {...makeRound([[90,'focus','enemy1']],{no:2}),replayBombInfo:[]}]);
  await load(page,data);const root=page.locator('#replayPlayback'),buttons=root.locator('[data-playback-turn]');
  await expect(buttons).toHaveCount(2);await expect(root.locator('.playback-turn-marker')).toHaveCount(2);
  await expect(buttons.nth(0)).toContainText('1R · 00:08.0');
  await root.locator('[data-playback-action="play"]').click();await buttons.nth(0).click();
  await expect(root.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  await expect(root.locator('[data-playback-seek]')).toHaveValue('3000');
  await page.waitForTimeout(200);await expect(root.locator('[data-playback-seek]')).toHaveValue('3000');
  await buttons.nth(1).focus();await page.keyboard.press('Enter');
  await expect(root.locator('[data-playback-seek]')).toHaveValue('24000');
  await expect(root.locator('[data-playback-round]')).toHaveText('2라운드');
  await expect(root.locator('[data-playback-events]')).toContainText('사건이 없습니다');
  await root.locator('[data-playback-action="play"]').click();
  await expect.poll(()=>root.locator('[data-playback-seek]').inputValue().then(Number)).toBeGreaterThan(24000);
  expect(calls).toEqual([]);
});

async function downloadOnly(page){await page.addInitScript(()=>{
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
  Object.defineProperty(navigator,'canShare',{configurable:true,value:undefined});
});}
async function checkPNG(download,file,width,height){
  await download.saveAs(file);const bytes=await fs.readFile(file);
  expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(width);expect(bytes.readUInt32BE(20)).toBe(height);
}

for(const width of [390,1280])test(`current playback exports a detached PNG and freezes the shown time at ${width}px`,async({page},info)=>{
  await downloadOnly(page);await page.setViewportSize({width,height:900});
  await page.addInitScript(theme=>localStorage.setItem('theme',theme),width===390?'light':'dark');
  const calls=[],errors=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  const data=fixture(width>=980);
  if(width===390){data.replay_info.replayCharacterSummaryInfo[0].nickName='아주긴닉네임'.repeat(15);data.replay_info.replayMatchSummaryInfo.mapName='매우긴지도이름'.repeat(15);}
  await load(page,data);await seek(page,10000);const root=page.locator('#replayPlayback');
  await root.locator('[data-playback-action="play"]').click();
  const waiting=page.waitForEvent('download');await root.locator('[data-share-playback]').click();await savePreviewPNG(page);const download=await waiting;
  await checkPNG(download,info.outputPath(`playback-share-${width}.png`),1080,1080);
  await expect(root.locator('[data-playback-action="play"]')).toHaveAttribute('aria-pressed','false');
  const position=await root.locator('[data-playback-seek]').inputValue();
  expect(download.suggestedFilename()).toMatch(new RegExp(`-r1-${position}\\.png$`));
  await page.waitForTimeout(150);await expect(root.locator('[data-playback-seek]')).toHaveValue(position);
  await expect(page.locator('#replayImageShareDialog')).toHaveCount(0);
  expect(calls).toEqual([]);expect(errors).toEqual([]);
});

test('existing summary export stays a 1080 by 675 PNG',async({page},info)=>{
  await downloadOnly(page);await load(page);const waiting=page.waitForEvent('download');
  await page.locator('[data-share-replay]').click();await savePreviewPNG(page);const download=await waiting;
  await checkPNG(download,info.outputPath('summary-share.png'),1080,675);
  expect(download.suggestedFilename()).toBe('tracking-sa-replay-focus.png');
});

test('cancelling native image sharing never downloads a fallback or leaves the button pending',async({page})=>{
  await page.addInitScript(()=>{
    window.shareCalls=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.shareCalls.push({name:data.files[0].name,type:data.files[0].type,size:data.files[0].size});throw new DOMException('cancel','AbortError');}});
  });
  const downloads=[];page.on('download',d=>downloads.push(d));await load(page);await seek(page,10000);
  const button=page.locator('[data-share-playback]');await button.click();
  await page.locator('[data-image-native]').click();
  await expect(page.locator('[data-image-status]')).toContainText('공유를 취소했습니다.');await expect(button).toBeEnabled();
  const calls=await page.evaluate(()=>window.shareCalls);expect(calls).toHaveLength(1);expect(calls[0].type).toBe('image/png');expect(calls[0].size).toBeGreaterThan(0);expect(downloads).toEqual([]);
});

test('changing players while PNG encoding is pending discards the old export',async({page})=>{
  await downloadOnly(page);await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(callback,type){window.releaseShareEncoding=()=>original.call(this,blob=>{callback(blob);queueMicrotask(()=>window.shareEncodingFinished=true);},type);};
  });
  const downloads=[];page.on('download',d=>downloads.push(d));await load(page);await page.locator('[data-share-playback]').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseShareEncoding)).toBe('function');
  await page.locator('#replayPlayer').selectOption('mate');await expect(page.locator('#replayPlayback')).toHaveCount(0);
  await page.evaluate(()=>window.releaseShareEncoding());await expect.poll(()=>page.evaluate(()=>window.shareEncodingFinished)).toBe(true);
  expect(downloads).toEqual([]);
});

for(const width of [390,1280])test(`verified leaving and returning states recover playback and image export at ${width}px`,async({page},info)=>{
  await downloadOnly(page);await page.setViewportSize({width,height:900});
  const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});
  const round={...makeRound([[50,'focus','enemy1'],[100,'enemy2','focus']]),replayBombInfo:[]};
  round.replayRoundSummaryInfo.find(p=>p.nexonSN==='focus').reJoin=1;
  round.replayCharacterInfo.find(p=>p.nexonSN==='focus').replayCharacterStateInfo=[[0,1],[10,3],[30,1],[100,2]].map(([timeStamp,state])=>({timeStamp,state}));
  await load(page,makeReplay([round]));const root=page.locator('#replayPlayback');
  await expect(root.locator('[data-playback-warning]')).toBeHidden();
  await seek(page,1000);await expect(root.locator('[data-playback-alive-a]')).toContainText('2 / 3명');
  await expect(root.locator('[data-playback-roster-a] li').first()).toHaveAttribute('data-state','left');
  await expect(root.locator('[data-playback-roster-a] li').first()).toContainText('이탈');
  await openPlaybackDetails(root);await root.locator('[data-playback-player-filter]').selectOption('focus');await expect(root.locator('[data-playback-events]')).toContainText('이탈');
  const waiting=page.waitForEvent('download');await root.locator('[data-share-playback]').click();await savePreviewPNG(page);
  await checkPNG(await waiting,info.outputPath(`participants-${width}.png`),1080,1080);
  await seek(page,3000);await expect(root.locator('[data-playback-alive-a]')).toContainText('3 / 3명');
  await expect(root.locator('[data-playback-roster-a] li').first()).toHaveAttribute('data-state','alive');
  await expect(root.locator('[data-playback-events]')).toContainText('재입장 · 생존 확인');
  await seek(page,10000);await expect(root.locator('[data-playback-roster-a] li').first()).toHaveAttribute('data-state','dead');
  await expect(root.locator('[data-playback-index-a]')).not.toHaveText('확인 보류');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(requests).toEqual([]);
});

test('prefilled re-entry and terminal C4 elimination stay visible with player filtering and PNG export',async({page},info)=>{
  await downloadOnly(page);const requests=[],errors=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  const round={...makeRound([[200,'system','focus']],{offenseTeam:1,winTeam:1}),replayBombInfo:[
    {timeStamp:100,bombEventType:0,teamNo:1,nexonSN:'enemy1'},
    {timeStamp:200,bombEventType:1,teamNo:1,nexonSN:0}]};
  Object.assign(round.replayAttackInfo[0],{attackerNexonSN:0,attackerTeamNo:1,itemID:6104,itemName:'킬타입_폭파미션 자살'});
  Object.assign(round.replayRoundSummaryInfo.find(p=>p.nexonSN==='focus'),{reJoin:1,death:0});
  round.replayEnterInfo=[{timeStamp:31,teamNo:0,nexonSN:'focus'}];
  round.replayCharacterInfo.find(p=>p.nexonSN==='focus').replayCharacterStateInfo=[[5,1],[30,1],[35,1],[200,1],[200,2]].map(([timeStamp,state])=>({timeStamp,state}));
  await load(page,makeReplay([round]));const root=page.locator('#replayPlayback');
  await expect(root.locator('[data-playback-warning]')).toBeHidden();
  await seek(page,3000);await expect(root.locator('[data-playback-alive-a]')).toContainText('2 / 3명');
  await expect(root.locator('[data-playback-roster-a] li').first()).toHaveAttribute('data-state','pending');
  await expect(root.locator('[data-playback-roster-a] li').first()).toContainText('입장 전');
  await seek(page,3100);await expect(root.locator('[data-playback-alive-a]')).toContainText('3 / 3명');
  await expect(root.locator('[data-playback-roster-a] li').first()).toHaveAttribute('data-state','alive');
  await expect(root.locator('[data-playback-events]')).toContainText('입장 · 생존 확인');
  await seek(page,20000);await expect(root.locator('[data-playback-alive-a]')).toContainText('2 / 3명');
  await openPlaybackDetails(root);await root.locator('[data-playback-player-filter]').selectOption('focus');
  await expect(root.locator('[data-playback-events]')).toContainText('C4 폭발 사망 · focus');
  await expect(root.locator('[data-playback-index-a]')).not.toHaveText('확인 보류');
  const waiting=page.waitForEvent('download');await root.locator('[data-share-playback]').click();await savePreviewPNG(page);
  await checkPNG(await waiting,info.outputPath('entry-bomb-share.png'),1080,1080);
  await root.locator('[data-playback-player-filter]').selectOption('enemy1');
  await expect(root.locator('[data-playback-events]')).not.toContainText('C4 폭발 사망');
  await expect(root.locator('[data-playback-events]')).toContainText('C4 설치');
  expect(requests).toEqual([]);expect(errors).toEqual([]);
});
