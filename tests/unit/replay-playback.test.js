import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRound, makeReplay } from '../fixtures/replay-context.js';
import { buildReplayPlayback, getPlaybackFrame, calculateSituationIndex, findPlaybackTurningPoints, getPlaybackEventWindow, resolvePlaybackReviewTarget, resolvePlaybackMomentTarget } from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import { analyzeReplay, getKeyMoments } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingReview } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import { renderReplayPlayback } from '../../src/domains/stats/sudden-attack/replay/ui/replay-playback.js';
const round = (events=[],options={}) => ({...makeRound(events,options),replayBombInfo:[]});
const model = (...rounds) => buildReplayPlayback(makeReplay(rounds));

test('key moments use the selected player recorded event and keep the five-second prelude inside its round',()=>{
  const raw=makeReplay([round([[80,'focus','enemy1'],[90,'enemy2','focus']]),
    round([[160,'focus','enemy1'],[180,'focus','enemy2'],[190,'enemy3','focus']],{no:2})]);
  const playback=buildReplayPlayback(raw),moments=getKeyMoments(analyzeReplay(raw,'focus'));
  assert.deepEqual(resolvePlaybackMomentTarget(playback,moments[0],'focus'),{roundNo:2,localMs:11000,anchorMs:16000});
  assert.deepEqual(resolvePlaybackMomentTarget(playback,moments[1],'focus'),{roundNo:1,localMs:4000,anchorMs:9000});
  const early=model(round([[10,'focus','enemy1']]));
  assert.deepEqual(resolvePlaybackMomentTarget(early,{round:1,playbackAnchor:{type:'kill',timeSeconds:1}},'focus'),{roundNo:1,localMs:0,anchorMs:1000});
});

test('key-moment navigation rejects fabricated anchors, missing players and unavailable playback',()=>{
  const playback=model(round([[80,'focus','enemy1']]));
  const candidate={round:1,playbackAnchor:{type:'kill',timeSeconds:8}};
  for(const edit of [m=>m.round=2,m=>m.playbackAnchor.timeSeconds=7.9,m=>m.playbackAnchor.timeSeconds=-1,
    m=>m.playbackAnchor.timeSeconds=21,m=>m.playbackAnchor.timeSeconds=NaN,m=>m.playbackAnchor.timeSeconds='8',
    m=>m.playbackAnchor.type='death',m=>m.playbackAnchor.type='unsupported']){
    const changed=structuredClone(candidate);edit(changed);assert.equal(resolvePlaybackMomentTarget(playback,changed,'focus'),null);
  }
  assert.equal(resolvePlaybackMomentTarget(playback,candidate,'enemy2'),null);
  assert.equal(resolvePlaybackMomentTarget(playback,candidate,'missing'),null);
  assert.equal(resolvePlaybackMomentTarget({status:'unavailable'},candidate,'focus'),null);
});

test('alone and survival anchors retain their meaning while partial-context event jumps do not invent counts',()=>{
  const raw=makeReplay([round([[10,'enemy1','mate'],[20,'enemy2','spare']])]),playback=buildReplayPlayback(raw);
  assert.deepEqual(resolvePlaybackMomentTarget(playback,{round:1,playbackAnchor:{type:'alone',timeSeconds:2}},'focus'),{roundNo:1,localMs:0,anchorMs:2000});
  assert.equal(resolvePlaybackMomentTarget(playback,{round:1,playbackAnchor:{type:'alone',timeSeconds:1}},'focus'),null);
  assert.deepEqual(resolvePlaybackMomentTarget(playback,{round:1,playbackAnchor:{type:'round-end',timeSeconds:20}},'focus'),{roundNo:1,localMs:15000,anchorMs:20000});
  assert.equal(resolvePlaybackMomentTarget(playback,{round:1,playbackAnchor:{type:'round-end',timeSeconds:19}},'focus'),null);
  const partial=round([[80,'focus','enemy1']]);partial.replayRoundSummaryInfo.find(p=>p.nexonSN==='focus').kill=9;
  const model=buildReplayPlayback(makeReplay([partial]));
  assert.equal(getPlaybackFrame(model,8000).alive,null);
  assert.deepEqual(resolvePlaybackMomentTarget(model,{round:1,playbackAnchor:{type:'kill',timeSeconds:8}},'focus'),{roundNo:1,localMs:3000,anchorMs:8000});
  assert.equal(getPlaybackFrame(model,3000).indexA,null);
});

test('local playback preserves input, batches equal-time eliminations and can seek backwards',()=>{
  const replay=makeReplay([round([[10,'enemy1','mate'],[10,'focus','enemy1'],[30,'enemy2','spare']])]),before=structuredClone(replay);
  const m=buildReplayPlayback(replay);assert.equal(m.status,'ready');assert.equal(m.verifiedRounds,1);assert.deepEqual(replay,before);
  assert.deepEqual(getPlaybackFrame(m,0).alive,[3,3]);
  const simultaneous=getPlaybackFrame(m,1000);assert.deepEqual(simultaneous.alive,[2,2]);assert.equal(simultaneous.indexA,50);assert.equal(simultaneous.eventCount,2);
  assert.deepEqual(getPlaybackFrame(m,3000).alive,[1,2]);assert.deepEqual(getPlaybackFrame(m,0).alive,[3,3]);
});
test('new rounds reset survivors, change attack side and count only already finished winners',()=>{
  const m=model(round([[10,'enemy1','focus']],{winTeam:1}),round([],{no:2,offenseTeam:1,winTeam:0}));
  assert.deepEqual(getPlaybackFrame(m,19999).score,[0,0]);
  const next=getPlaybackFrame(m,20000);assert.equal(next.round.no,2);assert.deepEqual(next.score,[0,1]);assert.deepEqual(next.alive,[3,3]);assert.equal(next.round.offense,1);
  const end=getPlaybackFrame(m,999999);assert.equal(end.finished,true);assert.deepEqual(end.score,[1,1]);
});
test('future winners never influence earlier situation values or event lists',()=>{
  const a=round([[100,'focus','enemy1']],{winTeam:0}),b=structuredClone(a);b.winTeam=1;
  const ma=model(a),mb=model(b);
  for(const at of [0,5000,10000,19999]){assert.equal(getPlaybackFrame(ma,at).indexA,getPlaybackFrame(mb,at).indexA);assert.deepEqual(getPlaybackFrame(ma,at).score,[0,0]);}
  assert.equal(getPlaybackFrame(ma,0).eventCount,0);assert.equal(getPlaybackFrame(ma,10000).eventCount,1);
});
test('bomb plant and defuse use official decisecond event codes without inventing a countdown',()=>{
  const r=round([],{offenseTeam:0,winTeam:1});r.replayBombInfo=[{timeStamp:50,bombEventType:0,teamNo:0,nickName:'focus'},{timeStamp:150,bombEventType:2,teamNo:1,nickName:'enemy1'}];
  const m=model(r);assert.equal(m.verifiedRounds,1);assert.equal(getPlaybackFrame(m,4999).bomb,'none');assert.equal(getPlaybackFrame(m,5000).bomb,'planted');
  assert.equal(getPlaybackFrame(m,5000).indexA,60);assert.equal(getPlaybackFrame(m,15000).bomb,'defused');assert.equal(getPlaybackFrame(m,15000).indexA,50);
});
test('bomb drop and explosion are recorded, contradictory bomb sequences withhold the index',()=>{
  const r=round([]);r.replayBombInfo=[{timeStamp:10,bombEventType:3},{timeStamp:20,bombEventType:0,teamNo:0},{timeStamp:30,bombEventType:1}];
  const m=model(r);assert.equal(m.verifiedRounds,1);assert.equal(getPlaybackFrame(m,3000).bomb,'exploded');
  for(const bombs of [[{timeStamp:10,bombEventType:2,teamNo:1}],[{timeStamp:10,bombEventType:0,teamNo:1}],[{timeStamp:10,bombEventType:99}],
    [{timeStamp:10,bombEventType:0,teamNo:0},{timeStamp:10,bombEventType:1}]]){
    const bad=model({...round([]),replayBombInfo:bombs});assert.equal(bad.verifiedRounds,0);assert.equal(getPlaybackFrame(bad,0).indexA,null);assert.equal(getPlaybackFrame(bad,5000).bomb,'unknown');
  }
});
test('missing bomb records preserve verified survivors while withholding the situation index',()=>{
  const m=model(makeRound([[10,'enemy1','focus']]));const frame=getPlaybackFrame(m,1000);
  assert.deepEqual(frame.alive,[2,3]);assert.equal(frame.indexA,null);assert.equal(frame.bomb,'unknown');
});
test('re-entry, incomplete summaries and duplicate deaths never become confident alive counts',()=>{
  const reentry=round([[10,'enemy1','focus']]);reentry.replayRoundSummaryInfo[0].reJoin=1;
  const mismatch=round([[10,'enemy1','focus']]);mismatch.replayRoundSummaryInfo[0].death=0;
  const duplicateDeath=round([[10,'enemy1','focus'],[20,'enemy2','focus']]);
  for(const r of [reentry,mismatch,duplicateDeath]){const m=model(r);assert.equal(getPlaybackFrame(m,5000).alive,null);assert.equal(getPlaybackFrame(m,5000).indexA,null);}
});
test('a posthumous grenade or delayed kill keeps the recorded victim loss without resurrecting the attacker',()=>{
  const m=model(round([[10,'enemy1','focus'],[20,'focus','enemy2']]));assert.equal(m.verifiedRounds,1);assert.deepEqual(getPlaybackFrame(m,2000).alive,[2,2]);assert.ok(!getPlaybackFrame(m,2000).aliveIds.includes('focus'));
});
test('unknown event codes and out-of-range times are withheld without invalid graph numbers',()=>{
  for(const edit of [r=>r.replayAttackInfo[0].eventType=99,r=>r.replayAttackInfo[0].timeStamp=-1,r=>r.replayAttackInfo[0].timeStamp=99999]){
    const r=round([[10,'focus','enemy1']]);edit(r);const m=model(r);assert.equal(m.verifiedRounds,0);const markup=renderReplayPlayback(m);assert.ok(!/NaN|Infinity/.test(markup));assert.ok(markup.includes('상태 확인 보류'));
  }
});
test('missing or duplicate round numbers and invalid durations stop playback without guessing time',()=>{
  assert.equal(buildReplayPlayback({}).status,'unavailable');assert.equal(buildReplayPlayback({replay_info:{replayRoundInfo:[null]}}).status,'unavailable');
  assert.equal(model(round(),round()).status,'unavailable');
  for(const playTime of [0,-1,null,'no',0.0000001,3601])assert.equal(model({...round(),playTime}).status,'unavailable');
  assert.equal(buildReplayPlayback(makeReplay(Array.from({length:101},(_,i)=>round([],{no:i+1})))).status,'unavailable');
});
test('round gaps do not invent a cumulative score or an advantage based on missing results',()=>{
  const m=model(round([]),round([],{no:3}));const frame=getPlaybackFrame(m,20000);assert.equal(frame.round.no,3);assert.equal(frame.score,null);assert.equal(frame.indexA,null);assert.deepEqual(frame.alive,[3,3]);
});
test('situation index is complementary and bounded, including unequal rosters',()=>{
  assert.equal(calculateSituationIndex([3,3],[3,3],[0,0],'none',0),50);
  assert.equal(calculateSituationIndex([5,0],[5,5],[10,0],'planted',0),95);
  assert.equal(calculateSituationIndex([0,5],[5,5],[0,10],'planted',1),5);
  assert.equal(calculateSituationIndex([0,0],[0,0],[0,0],'none',0),null);
  for(const a of [0,1,3])for(const b of [0,2,3]){const left=calculateSituationIndex([a,b],[3,3],[2,1],'none',0),right=calculateSituationIndex([b,a],[3,3],[1,2],'none',1);assert.ok(Math.abs(left+right-100)<0.001);}
});
test('seeking clamps to match boundaries, rejects nonfinite time and limits recent events',()=>{
  const m=model(round());assert.equal(getPlaybackFrame(m,-200).timeMs,0);assert.equal(getPlaybackFrame(m,Infinity),null);assert.equal(getPlaybackFrame({status:'unavailable'},0),null);
  assert.equal(getPlaybackFrame(m,m.durationMs).finished,true);assert.equal(getPlaybackFrame(m,0).finished,false);
});

test('turning points choose the strongest simultaneous event batch, with round-local lead-in',()=>{
  const m=model(round([[10,'focus','enemy1'],[80,'enemy2','mate'],[80,'enemy3','spare']]),
    round([[10,'focus','enemy1']],{no:2}));
  const before=structuredClone(m),points=findPlaybackTurningPoints(m);
  assert.equal(points.length,2);assert.deepEqual(m,before);
  assert.deepEqual(points.map(p=>[p.roundNo,p.localMs,p.seekMs,p.deltaA,p.events.length]),[[1,8000,3000,-26.6,2],[2,1000,20000,13.3,1]]);
  assert.equal(getPlaybackFrame(m,points[0].seekMs).eventCount,1);
});

test('turning points ignore cancelling simultaneous kills, final score changes and round resets',()=>{
  const m=model(round([[10,'focus','enemy1'],[10,'enemy2','mate']]),round([],{no:2}));
  assert.deepEqual(findPlaybackTurningPoints(m),[]);
  assert.deepEqual(findPlaybackTurningPoints(model(round([[200,'focus','enemy1']]))),[]);
  assert.deepEqual(findPlaybackTurningPoints({status:'unavailable'}),[]);
});

test('turning points omit partial rounds and deterministically select at most three distinct rounds',()=>{
  const rounds=Array.from({length:5},(_,i)=>round([[10,'focus','enemy1']],{no:i+1}));
  rounds[0].replayRoundSummaryInfo[0].reJoin=1;
  assert.deepEqual(findPlaybackTurningPoints(model(...rounds)).map(p=>p.roundNo),[2,3,4]);
  rounds[4]=round([[70,'focus','enemy1'],[70,'mate','enemy2']],{no:5});
  assert.deepEqual(findPlaybackTurningPoints(model(...rounds)).map(p=>p.roundNo),[2,3,5]);
  const bomb=round([]);bomb.replayBombInfo=[{timeStamp:70,bombEventType:0,teamNo:0}];
  assert.deepEqual(findPlaybackTurningPoints(model(bomb)).map(p=>[p.localMs,p.deltaA,p.seekMs]),[[7000,10,2000]]);
});

test('player event filtering distinguishes identical nicknames and follows IDs across nickname changes',()=>{
  const a=round([[10,'focus','enemy1'],[20,'enemy2','mate']]),b=round([[10,'enemy1','focus']],{no:2});
  for(const p of a.replayRoundSummaryInfo)p.nickName='same name';
  b.replayRoundSummaryInfo.find(p=>p.nexonSN==='focus').nickName='disguise';
  const m=model(a,b),before=structuredClone(m);
  assert.equal(getPlaybackEventWindow(m.rounds[0],5000,'focus').count,1);
  assert.equal(getPlaybackEventWindow(m.rounds[0],5000,'mate').events[0].victimId,'mate');
  assert.equal(getPlaybackEventWindow(m.rounds[1],5000,'focus').events[0].victimId,'focus');
  assert.equal(getPlaybackEventWindow(m.rounds[0],5000,'same name').count,0);
  assert.deepEqual(m,before);
});

test('bomb attribution requires a known actor ID and consistent side, never a matching nickname',()=>{
  const r=round([]);r.replayBombInfo=[{timeStamp:20,bombEventType:0,teamNo:0,nexonSN:'focus',nickName:'disguise'},
    {timeStamp:50,bombEventType:2,teamNo:1,nexonSN:'enemy1',nickName:'enemy1'}];
  let m=model(r);assert.equal(getPlaybackEventWindow(m.rounds[0],6000,'focus').events[0].type,'plant');
  assert.equal(getPlaybackEventWindow(m.rounds[0],6000,'enemy1').events[0].type,'defuse');
  for(const actor of [undefined,'unknown','enemy1']){
    r.replayBombInfo[0].nexonSN=actor;r.replayBombInfo[0].nickName='focus';m=model(r);
    assert.equal(getPlaybackEventWindow(m.rounds[0],6000,'focus').count,0);
    assert.equal(getPlaybackEventWindow(m.rounds[0],6000).count,2);
  }
});

test('player filtering precedes the recent-12 limit, respects playback time and keeps matching totals',()=>{
  const r={events:[{timeMs:1000,type:'kill',attackerId:'focus',victimId:'other'},
    ...Array.from({length:18},(_,i)=>({timeMs:(i+2)*1000,type:'kill',attackerId:'other',victimId:'unrelated'})),
    {timeMs:30000,type:'kill',attackerId:'other',victimId:'focus'}]};
  assert.equal(getPlaybackEventWindow(r,20000).events.length,12);
  const filtered=getPlaybackEventWindow(r,20000,'focus');
  assert.equal(filtered.count,1);assert.equal(filtered.total,2);assert.equal(filtered.events[0].timeMs,1000);
  assert.equal(getPlaybackEventWindow(r,0,'focus').count,0);
  assert.equal(getPlaybackEventWindow(r,30000,'focus').events[0].timeMs,30000);
});

test('review playback resolves the current verified before/after counts and rejects incompatible evidence',()=>{
  const raw=makeReplay([round([[10,'mate','enemy1'],[20,'spare','enemy2'],[30,'enemy3','focus']])]);
  const m=buildReplayPlayback(raw),review=buildReplayCoachingReview(analyzeReplay(raw,'focus')),candidate=review.candidates[0];
  assert.deepEqual(resolvePlaybackReviewTarget(m,candidate,'focus'),{roundNo:1,localMs:3000});
  for(const edit of [c=>c.flow.anchor.timeSeconds=-1,c=>c.flow.anchor.timeSeconds=NaN,c=>c.flow.anchor.timeSeconds='3',
    c=>c.flow.anchor.timeSeconds=21,c=>c.flow.anchor.timeSeconds=2,c=>c.round=99,c=>c.evidenceId='round-2',
    c=>c.flow.anchor.before.own++,c=>c.flow.anchor.after.enemy++,c=>c.flow.initialAlive.own++]){
    const altered=structuredClone(candidate);edit(altered);assert.equal(resolvePlaybackReviewTarget(m,altered,'focus'),null);
  }
  assert.equal(resolvePlaybackReviewTarget(m,candidate,'absent'),null);
  assert.equal(resolvePlaybackReviewTarget({status:'unavailable'},candidate,'focus'),null);
  const partial=structuredClone(raw);partial.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin=1;
  assert.equal(resolvePlaybackReviewTarget(buildReplayPlayback(partial),candidate,'focus'),null);
  delete raw.replay_info.replayRoundInfo[0].replayBombInfo;
  assert.deepEqual(resolvePlaybackReviewTarget(buildReplayPlayback(raw),candidate,'focus'),{roundNo:1,localMs:3000});
});

test('a round-end evidence target keeps its own score and roster until playback proceeds',()=>{
  const raw=makeReplay([round(),round([],{no:2}),round([],{no:3})]),m=buildReplayPlayback(raw);
  const candidate=buildReplayCoachingReview(analyzeReplay(raw,'focus')).candidates.find(c=>c.round===2);
  assert.deepEqual(resolvePlaybackReviewTarget(m,candidate,'focus'),{roundNo:2,localMs:20000});
  assert.equal(getPlaybackFrame(m,40000).round.no,3);
  const exact=getPlaybackFrame(m,40000,2);assert.equal(exact.round.no,2);assert.equal(exact.localMs,20000);assert.deepEqual(exact.score,[0,2]);
  assert.equal(getPlaybackFrame(m,40001,2).round.no,3);
  assert.equal(getPlaybackFrame(m,30000,1).round.no,2);
});
