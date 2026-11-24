import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {analyzeReplay,getReplayPlayers,parseReplayText} from '../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {buildReplayCoachingReview,REVIEW_LIMITS} from '../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import {rawRoundFacts} from './replay-coaching-quality.mjs';

export function auditCoachingReview(replay, { buildReview = buildReplayCoachingReview } = {}) {
 let candidatesChecked=0,transitionsChecked=0,maxReviewBytes=0;
 const reasonChecks={
  advantage_loss:r=>r.death&&r.death.ownAlive>r.death.enemyAlive&&r.result==='loss',
  opening_death:r=>r.opening?.selectedDeath,outnumbered_solo:r=>r.alone,
  trade_received:r=>r.tradesReceived.length,trade_made:r=>r.tradesMade.length,
  opening_kill:r=>r.opening?.selectedKill,advantage_death:r=>r.death&&r.death.ownAlive>r.death.enemyAlive,
  death:r=>r.death,recorded_kill:r=>r.kills-r.killsAfterDeath>0,round_result:()=>true,
 };
 const players=getReplayPlayers(replay);
 for(const player of players){
  const review=buildReview(analyzeReplay(replay,player.nexonSN));
  maxReviewBytes=Math.max(maxReviewBytes,Buffer.byteLength(JSON.stringify(review)));
  assert.ok(review.candidates.length<=REVIEW_LIMITS.maxCandidates);
  assert.equal(new Set(review.candidates.map(c=>c.round)).size,review.candidates.length);
  for(const [i,c]of review.candidates.entries()){
   assert.equal(c.rank,i+1);const round=replay.replay_info.replayRoundInfo.find(r=>Number(r.no)===c.round);
   const raw=rawRoundFacts(round,player.nexonSN),f=c.flow,at=f.anchor.timeSeconds;
   assert.ok(reasonChecks[c.basis.primaryReason](raw));
   for(const reason of c.basis.matchedReasons)assert.ok(reasonChecks[reason](raw));
   assert.deepEqual(f.initialAlive,raw.initialAlive);assert.equal(f.outcome.result,raw.result);
   assert.equal(f.outcome.durationSeconds,raw.durationSeconds);assert.equal(c.side,raw.side);
   const teams=new Map(round.replayRoundSummaryInfo.map(p=>[String(p.nexonSN),Number(p.teamNo)]));
   const ownTeam=teams.get(player.nexonSN),events=round.replayAttackInfo;
   const times=[...new Set(events.map(e=>Number(e.timeStamp)/10))].sort((a,b)=>a-b);
   const counts=(t,inclusive)=>{
    const dead=new Set(events.filter(e=>inclusive?Number(e.timeStamp)/10<=t:Number(e.timeStamp)/10<t).map(e=>String(e.victimNexonSN)));
    const alive=[...teams].filter(([id])=>!dead.has(id));
    return {own:alive.filter(([,team])=>team===ownTeam).length,enemy:alive.filter(([,team])=>team!==ownTeam).length};
   };
   const deaths=events.filter(e=>String(e.victimNexonSN)===player.nexonSN).map(e=>Number(e.timeStamp)/10);
   const deathAt=deaths[0]??Infinity,prev=times.filter(t=>t<at).at(-1),next=times.find(t=>t>at);
   assert.deepEqual(f.anchor.before,counts(at,false));assert.deepEqual(f.anchor.after,counts(at,true));
   assert.equal(f.anchor.beforeStateSinceSeconds,prev??0);
   assert.equal(f.anchor.selectedAliveBefore,at<=deathAt);assert.equal(f.anchor.selectedAliveAfter,at<deathAt);
   assert.equal(f.anchor.sincePreviousEliminationSeconds,prev===undefined?null:Number((at-prev).toFixed(1)));
   assert.equal(f.anchor.untilNextEliminationSeconds,next===undefined?null:Number((next-at).toFixed(1)));
   assert.deepEqual(f.outcome.lastRecordedAlive,counts(Infinity,true));
   assert.ok(f.events.length<=7);assert.ok(f.events.filter(e=>e.phase==='before').length<=2);
   assert.ok(f.events.filter(e=>e.phase==='after').length<=4);
   assert.equal(f.events.length+f.omittedEarlierEvents+f.omittedLaterEvents,times.length);
   assert.deepEqual(f.events.map(e=>e.timeSeconds),times.slice(f.omittedEarlierEvents,times.length-f.omittedLaterEvents));
   for(const e of f.events){
    const group=events.filter(x=>Number(x.timeStamp)/10===e.timeSeconds);
    assert.deepEqual(e.before,counts(e.timeSeconds,false));assert.deepEqual(e.after,counts(e.timeSeconds,true));
    assert.equal(e.simultaneous,group.length>1);assert.equal(e.selectedDeath,e.timeSeconds===deathAt);
    assert.equal(e.selectedKills,group.filter(x=>String(x.attackerNexonSN)===player.nexonSN).length);
    assert.equal(e.selectedAliveBefore,e.timeSeconds<=deathAt);assert.equal(e.selectedAliveAfter,e.timeSeconds<deathAt);
    transitionsChecked++;
   }
   candidatesChecked++;
  }
 }
 return {schemaVersion:1,mode:'offline_review_v2_raw_event_audit',players:players.length,candidatesChecked,transitionsChecked,maxReviewBytes,externalCalls:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const arg=name=>process.argv[process.argv.indexOf(name)+1];
 assert.ok(process.argv.includes('--replay')&&process.argv.includes('--report'));
 const report=auditCoachingReview(parseReplayText(fs.readFileSync(arg('--replay'),'utf8')));
 fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}
