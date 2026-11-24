import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRound,makeReplay } from '../fixtures/replay-context.js';
import { analyzeRoundContext } from '../../src/domains/stats/sudden-attack/replay/domain/replay-context.js';
import { trackReplayParticipants } from '../../src/domains/stats/sudden-attack/replay/domain/replay-participants.js';
import { buildReplayPlayback,getPlaybackFrame,getPlaybackEventWindow,createReplayPlaybackShare } from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
const states=(raw,id,values)=>{raw.replayCharacterInfo.find(p=>p.nexonSN===id).replayCharacterStateInfo=values.map(([timeStamp,state])=>({timeStamp,state}));};
const summary=(raw,id)=>raw.replayRoundSummaryInfo.find(p=>p.nexonSN===id);
const returning=()=>{
  const raw={...makeRound([[50,'focus','enemy1'],[100,'enemy2','focus']]),replayBombInfo:[]};
  summary(raw,'focus').reJoin=1;states(raw,'focus',[[0,1],[10,3],[30,1],[100,2]]);return raw;
};
const model=raw=>buildReplayPlayback(makeReplay([raw]));
const bombRound=()=>{
  const raw={...makeRound([[200,'system','focus']],{offenseTeam:1,winTeam:1}),replayBombInfo:[
    {timeStamp:100,bombEventType:0,teamNo:1,nexonSN:'enemy1'},
    {timeStamp:200,bombEventType:1,teamNo:1,nexonSN:0}]};
  Object.assign(raw.replayAttackInfo[0],{attackerNexonSN:0,attackerTeamNo:1,itemID:6104,itemName:'킬타입_폭파미션 자살'});
  summary(raw,'focus').death=0;
  return raw;
};

test('explicit late re-entry gates prefilled alive samples and preserves input',()=>{
  const raw={...makeRound([[80,'enemy1','focus']]),replayBombInfo:[]},before=structuredClone(raw);
  summary(raw,'focus').reJoin=1;raw.replayEnterInfo=[{nexonSN:'focus',teamNo:0,timeStamp:31}];
  states(raw,'focus',[[5,1],[30,1],[35,1],[80,1],[80,2]]);
  const snapshot=structuredClone(raw),m=model(raw);assert.equal(m.verifiedRounds,1);
  assert.deepEqual(getPlaybackFrame(m,3099).alive,[2,3]);assert.deepEqual(getPlaybackFrame(m,3100).alive,[3,3]);
  assert.equal(m.rounds[0].events[0].timeMs,3100);assert.equal(m.rounds[0].events[0].type,'join');
  assert.deepEqual(getPlaybackFrame(m,8000).alive,[2,3]);assert.deepEqual(raw,snapshot);
  assert.notDeepEqual(raw,before);assert.equal(analyzeRoundContext(raw,'focus').status,'partial');
});

test('prefilled re-entry still rejects prior combat, missing alive evidence and conflicting entry records',()=>{
  for(const edit of [r=>r.replayEnterInfo[0].timeStamp=90,r=>r.replayEnterInfo[0].teamNo=1,
    r=>states(r,'focus',[[5,1],[30,1],[50,1],[80,2]]),r=>summary(r,'focus').reJoin=0,
    r=>r.replayEnterInfo.push({nexonSN:'focus',teamNo:0,timeStamp:40})]){
    const raw={...makeRound([[80,'enemy1','focus']]),replayBombInfo:[]};
    summary(raw,'focus').reJoin=1;raw.replayEnterInfo=[{nexonSN:'focus',teamNo:0,timeStamp:31}];
    states(raw,'focus',[[5,1],[30,1],[35,1],[80,2]]);edit(raw);assert.equal(model(raw).verifiedRounds,0);
  }
  const raw={...makeRound([[20,'focus','enemy1'],[80,'enemy2','focus']]),replayBombInfo:[]};
  summary(raw,'focus').reJoin=1;raw.replayEnterInfo=[{nexonSN:'focus',teamNo:0,timeStamp:31}];
  assert.equal(model(raw).verifiedRounds,0);
});

test('equal-time alive then dead samples require matching victim event; other simultaneous changes stay held',()=>{
  const raw=returning();states(raw,'focus',[[0,1],[10,3],[30,1],[100,1],[100,2]]);
  assert.equal(model(raw).verifiedRounds,1);
  states(raw,'focus',[[0,1],[10,3],[30,1],[90,1],[90,2]]);assert.equal(model(raw).verifiedRounds,0);
  states(raw,'focus',[[0,1],[10,1],[10,3],[30,1],[100,2]]);assert.equal(model(raw).verifiedRounds,0);
});

test('corroborated terminal C4 deaths reduce victims without inventing an attacker or kill credit',()=>{
  const raw=bombRound(),before=structuredClone(raw),tracked=trackReplayParticipants(raw),m=model(raw);
  assert.equal(tracked.status,'complete');assert.equal(tracked.bombDeaths.length,1);assert.equal(m.verifiedRounds,1);
  assert.deepEqual(getPlaybackFrame(m,19999).alive,[3,3]);assert.deepEqual(getPlaybackFrame(m,20000).alive,[2,3]);
  assert.equal(getPlaybackFrame(m,20000).bomb,'exploded');assert.deepEqual(raw,before);
  const event=getPlaybackEventWindow(m.rounds[0],20000,'focus').events[0];
  assert.equal(event.type,'bomb-death');assert.equal(event.victimId,'focus');assert.equal(event.attackerId,undefined);
  assert.equal(getPlaybackEventWindow(m.rounds[0],20000,'enemy1').events.some(e=>e.type==='bomb-death'),false);
  const share=createReplayPlaybackShare(m,20000);assert.ok(share.scene.events.some(e=>e.type==='bomb-death'&&e.victim==='focus'));
  assert.doesNotMatch(JSON.stringify(share),/victimId|attackerId|nexonSN|6104|posX/);
  assert.equal(analyzeRoundContext(raw,'focus').status,'partial');
});

test('unknown system attacks need all C4 identity, timing, bomb, winner and death evidence',()=>{
  for(const edit of [r=>r.replayAttackInfo[0].attackerNexonSN=99,r=>r.replayAttackInfo[0].itemID=999,
    r=>r.replayAttackInfo[0].itemName='unknown',r=>r.replayAttackInfo[0].attackerTeamNo=0,
    r=>r.replayBombInfo.pop(),r=>r.replayBombInfo[1].timeStamp=190,r=>r.replayBombInfo[1].nexonSN='enemy1',
    r=>r.replayBombInfo[0].teamNo=0,r=>r.replayBombInfo.push({timeStamp:150,bombEventType:2,teamNo:0}),
    r=>r.winTeam=0,r=>r.playTime=21,r=>summary(r,'focus').death=1,
    r=>states(r,'focus',[[0,1],[200,1]])]){
    const raw=bombRound();edit(raw);assert.equal(model(raw).verifiedRounds,0);
  }
});

test('recorded live departures and returns change survivors only at their timestamps, without mutating raw input',()=>{
  const raw=returning(),before=structuredClone(raw),m=model(raw);
  assert.equal(m.verifiedRounds,1);assert.equal(m.rounds[0].participantTracking,'recorded');
  assert.deepEqual(getPlaybackFrame(m,999).alive,[3,3]);assert.deepEqual(getPlaybackFrame(m,1000).alive,[2,3]);
  assert.ok(getPlaybackFrame(m,1000).leftIds.includes('focus'));assert.deepEqual(getPlaybackFrame(m,3000).alive,[3,3]);
  assert.deepEqual(getPlaybackFrame(m,3000).leftIds,[]);assert.deepEqual(getPlaybackFrame(m,10000).alive,[2,2]);
  assert.deepEqual(raw,before);assert.equal(analyzeRoundContext(raw,'focus').status,'partial');
});

test('leaving after death never removes a second living player; a returned life can later die again',()=>{
  const raw={...makeRound([[10,'enemy1','focus'],[40,'enemy2','focus']]),replayBombInfo:[]};
  summary(raw,'focus').reJoin=1;summary(raw,'focus').breakType=1;
  states(raw,'focus',[[0,1],[10,2],[20,3],[30,1],[40,2],[60,3]]);
  const m=model(raw);assert.equal(m.verifiedRounds,1);
  assert.deepEqual(getPlaybackFrame(m,1000).alive,[2,3]);assert.deepEqual(getPlaybackFrame(m,2000).alive,[2,3]);
  assert.deepEqual(getPlaybackFrame(m,3000).alive,[3,3]);assert.deepEqual(getPlaybackFrame(m,4000).alive,[2,3]);
  assert.deepEqual(getPlaybackFrame(m,6000).alive,[2,3]);assert.equal(getPlaybackFrame(m,6000).eventCount,5);
});

test('a terminal departure flag with a full alive track does not invent an in-round departure timestamp',()=>{
  const raw={...makeRound([]),replayBombInfo:[]};summary(raw,'focus').breakType=1;
  const m=model(raw);assert.equal(m.verifiedRounds,1);assert.deepEqual(getPlaybackFrame(m,20000).alive,[3,3]);assert.deepEqual(m.rounds[0].events,[]);
  states(raw,'focus',[[0,1],[100,1]]);assert.equal(model(raw).verifiedRounds,0);
});

test('late initial presence needs a matching entry and is absent until the recorded alive entry',()=>{
  const raw={...makeRound([[80,'enemy1','focus']]),replayBombInfo:[]};summary(raw,'focus').reJoin=1;
  states(raw,'focus',[[30,1],[80,2]]);raw.replayEnterInfo=[{nexonSN:'focus',teamNo:0,timeStamp:30}];
  const m=model(raw);assert.equal(m.verifiedRounds,1);assert.deepEqual(getPlaybackFrame(m,0).alive,[2,3]);
  assert.deepEqual(getPlaybackFrame(m,3000).alive,[3,3]);assert.equal(m.rounds[0].events[0].type,'join');
  raw.replayEnterInfo=[];assert.equal(model(raw).verifiedRounds,0);
});

test('unknown states, flag-only returns, missing death evidence and contradictory records still withhold the index',()=>{
  for(const edit of [r=>states(r,'focus',[[0,1],[10,99],[200,1]]),r=>states(r,'focus',[[0,1],[100,2]]),
    r=>states(r,'focus',[[0,1],[10,3],[30,2]]),r=>summary(r,'focus').kill++,r=>summary(r,'focus').breakType=2,
    r=>r.replayCharacterInfo.push(r.replayCharacterInfo[0]),r=>r.replayEnterInfo=[{nexonSN:'focus',teamNo:1,timeStamp:30}],
    r=>states(r,'focus',[[0,1],[10,3],[10,1],[100,2]])]){
    const raw=returning();edit(raw);assert.equal(model(raw).verifiedRounds,0);
  }
  const normal={...makeRound([]),replayBombInfo:[]};summary(normal,'focus').reJoin=1;assert.equal(model(normal).verifiedRounds,0);
});

test('after-death or after-leaving delayed kills do not revive their attacker',()=>{
  const raw={...makeRound([[10,'enemy1','focus'],[30,'focus','enemy2']]),replayBombInfo:[]};summary(raw,'focus').breakType=1;
  states(raw,'focus',[[0,1],[10,2],[20,3]]);
  const m=model(raw);assert.equal(m.verifiedRounds,1);assert.deepEqual(getPlaybackFrame(m,3000).alive,[2,2]);assert.ok(getPlaybackFrame(m,3000).leftIds.includes('focus'));
});

test('participant events work with bombs, per-player filtering and display-only share projection',()=>{
  const raw=returning();raw.replayBombInfo=[{timeStamp:20,bombEventType:0,teamNo:0,nexonSN:'mate',nickName:'mate'}];
  const m=model(raw);assert.equal(m.verifiedRounds,1);assert.equal(getPlaybackFrame(m,2000).bomb,'planted');
  const events=getPlaybackEventWindow(m.rounds[0],3000,'focus');assert.deepEqual(events.events.map(e=>e.type),['rejoin','leave']);
  const share=createReplayPlaybackShare(m,3000);assert.equal(share.scene.events[0].type,'rejoin');assert.equal(share.scene.events[0].actor,'focus');
  assert.doesNotMatch(JSON.stringify(share),/actorId|leftIds|nexonSN|posX/);
});

test('participant bounds and unsafe structures are rejected without accepting unsupported life order',()=>{
  for(const edit of [r=>r.replayCharacterInfo[0].replayCharacterStateInfo=Array(25001).fill({timeStamp:0,state:1}),
    r=>r.replayEnterInfo=Array(5001).fill({}),r=>r.replayRoundSummaryInfo[0].nexonSN={toString:[]},
    r=>r.replayEnterInfo={},r=>r.playTime=3601]){
    const raw=returning();edit(raw);assert.equal(trackReplayParticipants(raw).status,'unavailable');
  }
});
