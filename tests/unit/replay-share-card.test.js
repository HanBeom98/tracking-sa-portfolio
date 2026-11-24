import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createReplayShareCardModel, drawReplayShareCard } from '../../src/domains/stats/sudden-attack/replay/ui/replay-share-card.js';
import { buildReplayPlayback, createReplayPlaybackShare } from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import { makeRound,makeReplay } from '../fixtures/replay-context.js';

const analysis = {
  match: { id: 'secret-match-id', mapName: '프로방스-심플', score: '6 : 4', won: true },
  player: { nexonSN: 'secret-player-id', nickName: 'Tracking', kill: 7, death: 4, assist: 2 },
  totals: { averageSurvivalSeconds: 73, throws: 10 },
};

test('creates a replay share model from display-safe summary fields', () => {
  const model = createReplayShareCardModel(analysis, [
    { label: '좋았던 장면', title: '연속 처치', round: 2, tone: 'good' },
  ], 'https://trackingsa.com/stats/sudden-attack/replay/?nickname=Tracking#replayInsights');
  assert.equal(model.nickname, 'Tracking');
  assert.equal(model.mapName, '프로방스-심플');
  assert.equal(model.kda, '7 / 4 / 2');
  assert.equal(model.averageSurvival, '1분 13초');
  assert.equal(model.url, 'https://trackingsa.com/stats/sudden-attack/replay/');
  assert.doesNotMatch(JSON.stringify(model), /secret-match-id|secret-player-id/);
});

test('replay desk does not store missions or analysis results in browser storage', () => {
  const source = fs.readFileSync('src/domains/stats/sudden-attack/replay/main.js', 'utf8');
  assert.doesNotMatch(source, /localStorage|data-mission|MISSION/);
  assert.match(source, /data-share-replay/);
});

test('share card bounds untrusted replay text and handles unavailable canvas', () => {
  const oversized = '가'.repeat(1000);
  const model = createReplayShareCardModel({
    ...analysis,
    player: { ...analysis.player, nickName: oversized },
    match: { ...analysis.match, mapName: oversized },
  }, [{ label: oversized, title: oversized }]);
  assert.equal(model.nickname.length, 80);
  assert.equal(model.mapName.length, 100);
  assert.equal(model.moments[0].label.length, 60);
  assert.equal(model.moments[0].title.length, 160);
  assert.throws(() => drawReplayShareCard({ getContext: () => null }), /CANVAS_UNAVAILABLE/);
});

function replay(){
  const raw=makeReplay([{...makeRound([[10,'focus','enemy1']]),replayBombInfo:[]},{...makeRound([],{no:2}),replayBombInfo:[]}]);
  for(const r of raw.replay_info.replayRoundInfo)r.replayRoundSummaryInfo.forEach((p,i)=>p.nickName=`display-${i}`);
  return raw;
}
function canvas(){
  const texts=[],gradient={addColorStop(){}},ctx=new Proxy({measureText:text=>({width:String(text).length*12}),createLinearGradient:()=>gradient,
    fillText:(text,x,y)=>texts.push({text,x,y})},{get:(obj,key)=>key in obj?obj[key]:(()=>{}),set:(obj,key,value)=>{obj[key]=value;return true;}});
  return {texts,getContext:()=>ctx};
}

test('playback sharing projects the exact current scene, never future events, IDs or coordinates',()=>{
  const playback=buildReplayPlayback(replay()),before=structuredClone(playback),snapshot=createReplayPlaybackShare(playback,1000);
  assert.equal(snapshot.scene.roundNo,1);assert.equal(snapshot.scene.localMs,1000);assert.equal(snapshot.scene.events.length,1);
  assert.deepEqual(createReplayPlaybackShare(playback,999).scene.events,[]);
  assert.deepEqual(snapshot.scene.alive,[3,2]);assert.equal(snapshot.scene.events[0].attacker,'display-0');
  assert.doesNotMatch(JSON.stringify(snapshot),/attackerId|victimId|nexonSN|aliveIds|posX|posY|"focus"|"enemy1"/);
  snapshot.scene.alive[0]=0;snapshot.rounds[0].points[0].indexA=99;assert.deepEqual(playback,before);
  assert.equal(createReplayPlaybackShare(playback,20000,1).scene.roundNo,1);
  assert.equal(createReplayPlaybackShare(playback,20000).scene.roundNo,2);
});

test('share snapshots preserve unknown values and omit graph points for unverified rounds',()=>{
  const raw=replay();raw.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin=1;
  const snapshot=createReplayPlaybackShare(buildReplayPlayback(raw),1000);
  assert.equal(snapshot.scene.indexA,null);assert.equal(snapshot.scene.alive,null);assert.deepEqual(snapshot.rounds[0].points,[]);
  assert.equal(snapshot.rounds[1].verified,true);assert.equal(createReplayPlaybackShare({status:'unavailable'},0),null);
});

test('local canvas draws a square playback card with uncertainty labels and preserves the existing summary dimensions',()=>{
  const raw=replay();raw.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin=1;
  const snapshot=createReplayPlaybackShare(buildReplayPlayback(raw),1000),model=createReplayShareCardModel(analysis,[],
    'https://trackingsa.com/stats/sudden-attack/replay/?access=private#scene',{playback:snapshot}),image=canvas();
  drawReplayShareCard(image,model);assert.equal(image.width,1080);assert.equal(image.height,1080);
  assert.ok(image.texts.some(v=>v.text==='현재 지수 확인 보류'));assert.ok(image.texts.some(v=>v.text==='생존 인원 확인 보류'));
  assert.ok(image.texts.some(v=>v.text.includes('승리 확률이나 AI 예측이 아닙니다')));
  assert.doesNotMatch(JSON.stringify(model),/secret-match-id|secret-player-id|access=private/);
  const basic=canvas();drawReplayShareCard(basic,createReplayShareCardModel(analysis));assert.equal(basic.height,675);assert.equal(basic.width,1080);
});

test('long map and nickname text is fitted on both share card variants without nonfinite canvas labels',()=>{
  const long={...analysis,player:{...analysis.player,nickName:'가'.repeat(1000)},match:{...analysis.match,mapName:'지도'.repeat(1000)}};
  for(const playback of [null,createReplayPlaybackShare(buildReplayPlayback(replay()),1000)]){
    const image=canvas();drawReplayShareCard(image,createReplayShareCardModel(long,[],'',{playback}));
    assert.ok(image.texts.some(v=>v.text.endsWith('…')));assert.ok(image.texts.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
    assert.ok(image.texts.find(v=>v.y===166).text.endsWith('6 : 4'));
    assert.doesNotMatch(JSON.stringify(image.texts),/NaN|Infinity/);
  }
});
