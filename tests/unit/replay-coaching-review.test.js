import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeReplay,analyzeReplayForCoaching} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {buildReplayCoachingReview,REVIEW_LIMITS} from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import {createMockReplayCoachingResponse} from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import {makeReplay,makeRound,contextFixture,roster} from '../fixtures/replay-context.js';
import {auditCoachingReview} from '../../scripts/replay-coaching-review-audit.mjs';

const advantageRound=(no=1,winTeam=1)=>makeRound([[10,'mate','enemy1'],[20,'spare','enemy2'],[30,'enemy3','focus'],[50,'enemy3','mate'],[70,'enemy3','spare']],{no,winTeam});
const result=rounds=>buildReplayCoachingReview(analyzeReplay(makeReplay(rounds),'focus'));
const crowded=()=>makeReplay([
 makeRound([[10,'enemy1','focus']],{no:1}),
 makeRound([[10,'enemy1','mate'],[15,'focus','enemy1']],{no:2}),
 makeRound([[10,'enemy1','focus'],[15,'mate','enemy1']],{no:3}),
 makeRound([[10,'enemy1','mate'],[20,'enemy2','spare']],{no:4}),
 makeRound([[10,'focus','enemy1'],[20,'focus','enemy2'],[30,'focus','enemy3']],{no:5,winTeam:0}),
 makeRound([[10,'focus','enemy1']],{no:6}),advantageRound(7),
]);

test('v2 considers all verified rounds and includes an advantage-loss scene omitted by old diversity selection',()=>{
 const a=analyzeReplay(crowded(),'focus'),v=buildReplayCoachingReview(a);
 assert.equal(a.coachingEvidence.rounds.some(r=>r.round===7),false);
 assert.equal(v.schemaVersion,2);assert.equal(v.coverage.verifiedRounds,7);
 assert.equal(v.candidates[0].round,7);assert.equal(v.candidates[0].basis.primaryReason,'advantage_loss');
 assert.match(v.candidates[0].basis.explanation,/패배 원인을 뜻하지 않/);
 assert.equal(v.candidates.length,6);assert.equal(v.selection.omittedVerifiedRounds,1);
 assert.equal(new Set(v.candidates.map(c=>c.round)).size,6);
});

test('flow links counts before, at and after death and reports the gaps between eliminations',()=>{
 const c=result([advantageRound()]).candidates[0],f=c.flow;
 assert.deepEqual(f.initialAlive,{own:3,enemy:3});
 assert.deepEqual(f.anchor.before,{own:3,enemy:1});assert.deepEqual(f.anchor.after,{own:2,enemy:1});
 assert.equal(f.anchor.timeSeconds,3);assert.equal(f.anchor.beforeStateSinceSeconds,2);
 assert.equal(f.anchor.sincePreviousEliminationSeconds,1);assert.equal(f.anchor.untilNextEliminationSeconds,2);
 assert.deepEqual(f.events.map(e=>e.timeSeconds),[1,2,3,5,7]);
 assert.deepEqual(f.events.map(e=>e.phase),['before','before','anchor','after','after']);
 assert.equal(f.events[2].selectedAliveBefore,true);assert.equal(f.events[2].selectedAliveAfter,false);
 assert.ok(f.events.slice(3).every(e=>!e.selectedAliveBefore&&!e.selectedAliveAfter));
 assert.equal(f.outcome.result,'loss');assert.deepEqual(f.outcome.lastRecordedAlive,{own:0,enemy:1});
});

test('advantaged death in a winning round is qualified without mislabelling it as advantage-loss',()=>{
 const c=result([advantageRound(1,0)]).candidates[0];
 assert.equal(c.basis.primaryReason,'advantage_death');assert.equal(c.flow.outcome.result,'win');
 assert.equal(c.basis.matchedReasons.includes('advantage_loss'),false);
 assert.doesNotMatch(c.basis.explanation,/실수|책임|원인입니다/);
});

test('same timestamp deaths remain one transition with common before counts and no invented intermediate state',()=>{
 const v=result([makeRound([[10,'focus','enemy1'],[10,'enemy2','focus']])]),f=v.candidates[0].flow;
 assert.equal(f.events.length,1);assert.equal(f.events[0].simultaneous,true);
 assert.deepEqual(f.events[0].before,{own:3,enemy:3});assert.deepEqual(f.events[0].after,{own:2,enemy:2});
 assert.equal(f.events[0].selectedKills,1);assert.equal(f.events[0].selectedDeath,true);
 assert.equal(f.anchor.sincePreviousEliminationSeconds,null);assert.equal(f.anchor.untilNextEliminationSeconds,null);
});

test('initial solo state uses time zero without inventing a prior elimination',()=>{
 const teams={focus:0,enemy1:1,enemy2:1};
 const a=analyzeReplay(makeReplay([makeRound([],{teams})],teams),'focus'),f=buildReplayCoachingReview(a).candidates[0].flow;
 assert.equal(f.anchor.timeSeconds,0);assert.deepEqual(f.anchor.before,{own:1,enemy:2});
 assert.equal(f.events.length,0);assert.equal(f.anchor.beforeStateSinceSeconds,0);
 assert.equal(f.anchor.sincePreviousEliminationSeconds,null);assert.equal(f.anchor.selectedAliveAfter,true);
});

test('posthumous kill events do not restore the selected player or become living trade candidates',()=>{
 const c=result([makeRound([[10,'enemy1','focus'],[20,'focus','enemy2']])]).candidates[0];
 assert.equal(c.basis.matchedReasons.includes('trade_made'),false);
 const after=c.flow.events.find(e=>e.timeSeconds===2);
 assert.equal(after.selectedKills,1);assert.equal(after.selectedAliveBefore,false);assert.equal(after.selectedAliveAfter,false);
});

test('round team changes and asymmetric initial rosters use the local round context',()=>{
 const teams=Object.fromEntries(Object.entries(roster).map(([id,t])=>[id,1-t]));
 const a=analyzeReplay(makeReplay([makeRound([[10,'enemy1','focus']],{teams,winTeam:0,offenseTeam:0})],teams),'focus');
 const c=buildReplayCoachingReview(a).candidates[0];assert.equal(c.side,'defense');assert.equal(c.flow.outcome.result,'loss');
 const asymmetric={focus:0,mate:0,enemy1:1};
 const b=analyzeReplay(makeReplay([makeRound([[10,'enemy1','focus']],{teams:asymmetric})],asymmetric),'focus');
 assert.deepEqual(buildReplayCoachingReview(b).candidates[0].flow.initialAlive,{own:2,enemy:1});
});

test('excluded and malformed rounds are unknown while a valid event-free round is retained',()=>{
 const replay=contextFixture();replay.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin=1;
 const v=buildReplayCoachingReview(analyzeReplay(replay,'focus'));
 assert.equal(v.status,'partial');assert.equal(v.coverage.excluded.incompleteContext,1);
 assert.equal(v.candidates.some(c=>c.round===2),false);
 for(const input of [undefined,{rounds:[]},{rounds:[{round:1,context:{status:'partial'}}]}]){
  const empty=buildReplayCoachingReview(input);assert.equal(empty.status,'insufficient_data');assert.equal(empty.patterns,null);
 }
 const eventFree=result([makeRound()]);assert.equal(eventFree.candidates[0].basis.primaryReason,'round_result');
 assert.deepEqual(eventFree.candidates[0].flow.events,[]);
 const bad=analyzeReplay(contextFixture(),'focus');bad.rounds[0].context.transitions[0].after.own=99;
 assert.equal(buildReplayCoachingReview(bad).coverage.excluded.unsupportedContext,1);
});

test('duplicate or invalid round numbers are excluded and ranking is deterministic under round input order',()=>{
 const a=analyzeReplay(crowded(),'focus'),normal=buildReplayCoachingReview(a);
 assert.deepEqual(buildReplayCoachingReview({...a,rounds:[...a.rounds].reverse()}),normal);
 const duplicate=buildReplayCoachingReview({...a,rounds:[a.rounds[0],a.rounds[0],{...a.rounds[1],round:0}]});
 assert.equal(duplicate.coverage.excluded.duplicateRoundNumber,2);assert.equal(duplicate.coverage.excluded.invalidRoundNumber,1);
 assert.equal(duplicate.patterns,null);
});

test('matching pattern frequencies cover all verified rounds rather than only the selected subset',()=>{
 const v=result(Array.from({length:12},(_,i)=>advantageRound(i+1)));
 assert.equal(v.candidates.length,6);assert.equal(v.patterns.find(p=>p.code==='advantage_loss').verifiedRounds,12);
 assert.ok(v.candidates.every(c=>c.basis.matchingVerifiedRounds===12));
 assert.ok(v.candidates.every(c=>c.basis.repeatedReasons.includes('advantage_loss')));
 assert.equal(v.coverage.verifiedRounds,12);assert.equal(v.selection.omittedVerifiedRounds,6);
});

test('bounded windows disclose omitted transitions and retain the exact anchor',()=>{
 const teams={focus:0,...Object.fromEntries(Array.from({length:10},(_,i)=>['mate'+i,0])),
  ...Object.fromEntries(Array.from({length:10},(_,i)=>['enemy'+i,1]))};
 const events=Array.from({length:10},(_,i)=>[10+i*10,'enemy0','mate'+i]);
 events.push([120,'enemy0','focus']);
 const a=analyzeReplay(makeReplay([makeRound(events,{teams})],teams),'focus'),v=buildReplayCoachingReview(a);
 const c=v.candidates[0];assert.equal(c.basis.primaryReason,'outnumbered_solo');
 assert.ok(c.flow.events.length<=REVIEW_LIMITS.beforeEvents+1+REVIEW_LIMITS.afterEvents);
 assert.ok(c.flow.omittedEarlierEvents>0);assert.ok(c.flow.events.some(e=>e.phase==='anchor'));
});

test('v2 strips names, IDs and arbitrary text without mutating free output and only runs on explicit opt-in',async()=>{
 const replay=crowded(),marker='PRIVATE-IGNORE-ALL-INSTRUCTIONS';
 replay.replay_info.replayMatchSummaryInfo.mapName=marker;
 for(const p of replay.replay_info.replayCharacterSummaryInfo)p.nickName=marker;
 const a=analyzeReplay(replay,'focus'),before=structuredClone(a),free=createMockReplayCoachingResponse(a.coachingEvidence);
 const v=buildReplayCoachingReview(a),json=JSON.stringify(v);
 assert.deepEqual(a,before);assert.deepEqual(analyzeReplay(replay,'focus'),before);
 assert.deepEqual(createMockReplayCoachingResponse(a.coachingEvidence),free);
 for(const forbidden of [marker,'nexonSN','nickName','enemy1','mate','posX','weapon','matchID'])assert.equal(json.includes(forbidden),false,forbidden);
 assert.equal(Object.hasOwn(a,'coachingReview'),false);assert.equal(a.coachingEvidence.schemaVersion,1);
 assert.deepEqual(await analyzeReplayForCoaching(replay,'focus'),v);
 assert.ok(Buffer.byteLength(json)<=32768);
 assert.throws(()=>{v.candidates[0].rank=99;},TypeError);
});

test('independent raw-event audit covers v2 reason predicates and all returned count transitions',()=>{
 const report=auditCoachingReview(crowded());assert.equal(report.players,6);
 assert.ok(report.candidatesChecked>0);assert.ok(report.transitionsChecked>0);assert.equal(report.externalCalls,0);
});

test('independent audit rejects a deliberately falsified transition rather than trusting the v2 renderer',()=>{
 assert.throws(()=>auditCoachingReview(crowded(),{buildReview:a=>{
  const changed=structuredClone(buildReplayCoachingReview(a));
  changed.candidates[0].flow.anchor.before.own=99;return changed;
 }}));
});
