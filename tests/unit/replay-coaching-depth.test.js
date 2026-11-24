import test from 'node:test';
import assert from 'node:assert/strict';
import depth from '../../cloud-functions/replay-coaching-depth.js';
import legacy from '../../cloud-functions/replay-coaching-facts.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import openai from '../../cloud-functions/replay-coaching-openai.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import runner from '../../cloud-functions/replay-coaching-runner.js';
import {analyzeReplay} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {createMockReplayCoachingResponse} from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import {makeReplay,makeRound,contextFixture} from '../fixtures/replay-context.js';
import {coachingMemoryDb} from '../helpers/coaching-memory-db.js';
import {testAccess} from '../helpers/coaching-test-access.js';
import {openAIEnvelope} from '../helpers/coaching-openai-fixture.js';
import {auditCoachingDepth} from '../../scripts/replay-coaching-depth-audit.mjs';

const NOW=Date.parse('2026-10-26T00:00:00Z');
const evidence=rounds=>analyzeReplay(makeReplay(rounds),'focus').coachingEvidence;
const pick=(factId,questionId,practiceId,kind='review')=>({schemaVersion:2,cards:[{kind,factId,questionId,practiceId}]});
const code=expected=>error=>error.code===expected;
const render=(e,s)=>depth.renderCoachingDepthSelection(s,e).cards[0];

test('death context links initial counts, death-before counts and team result without inventing intermediate events',()=>{
  const e=evidence([makeRound([[10,'enemy1','mate'],[20,'enemy2','focus']])]);
  const catalog=depth.createCoachingDepthCatalog(e),f=catalog.facts.find(f=>f.id==='depth1_r1_death');
  assert.match(f.observation,/시작 3대3.*2\.0초 사망 직전 본인 포함 2대3.*팀 패배/);
  assert.match(f.reviewReason,/시작보다 불리해진/);
  const card=render(e,pick(f.id,'dq1_team','dp1_team'));
  assert.match(card.practice,/생존 팀원/);assert.match(card.practice,/다음 3라운드.*목표.*직접 세어/);
  assert.match(card.limitation,/원인은 확정할 수 없/);assert.ok(card.practice.length<=80);
  assert.equal(Object.hasOwn(f,'position'),false);
});

test('relative count improvement and unchanged counts are distinct from a claim of absolute advantage',()=>{
  const improved=evidence([makeRound([[10,'focus','enemy1'],[20,'enemy2','focus']],{winTeam:0})]);
  const f=depth.createCoachingDepthCatalog(improved).facts.find(f=>f.id==='depth1_r1_death');
  assert.match(f.reviewReason,/개선된/);assert.match(f.observation,/팀 승리/);
  const same=evidence([makeRound([[10,'enemy1','focus']])]);
  assert.match(depth.createCoachingDepthCatalog(same).facts.find(f=>f.id==='depth1_r1_death').reviewReason,/인원차가 같은/);
});

test('dead-teammate regroup exercises are unavailable while solo-start review invents no preceding losses',()=>{
  const e=evidence([makeRound([[10,'enemy1','mate'],[20,'enemy2','spare'],[30,'enemy3','focus']])]);
  const f=depth.createCoachingDepthCatalog(e).facts.find(f=>f.id==='depth1_r1_death');
  assert.equal(f.questions.includes('dq1_team'),false);assert.equal(f.practices.includes('dp1_team'),false);
  assert.throws(()=>render(e,pick(f.id,'dq1_team','dp1_team')),code('COACHING_SELECTION_NOT_ALLOWED'));
  const teams={focus:0,enemy1:1,enemy2:1};
  const solo=analyzeReplay(makeReplay([makeRound([],{teams})],teams),'focus').coachingEvidence;
  const fact=depth.createCoachingDepthCatalog(solo).facts.find(f=>f.id==='depth1_r1_solo');
  assert.match(fact.reviewReason,/처음부터 혼자인/);
  const card=render(solo,pick(fact.id,'dq1_solo','dp1_solo'));
  assert.doesNotMatch(card.practice,/합류|팀원 사망/);assert.match(card.practice,/직접 세세요/);
});

test('made and received trade flows keep actors separate and next-round goals do not instruct a dead player',()=>{
  const received=evidence([makeRound([[10,'enemy1','focus'],[16,'mate','enemy1']])]);
  const r=render(received,pick('depth1_r1_received1','dq1_received','dp1_received'));
  assert.match(r.observation,/1\.0초 본인 사망.*0\.6초 뒤 1\.6초 팀원 후속/);
  assert.match(r.practice,/다음 3라운드/);assert.doesNotMatch(r.practice,/즉시 합류|지금 합류/);
  const made=evidence([makeRound([[10,'enemy1','mate'],[16,'focus','enemy1']])]);
  const m=render(made,pick('depth1_r1_made1','dq1_made','dp1_made','strength'));
  assert.match(m.observation,/아군 사망 1건.*본인 후속 처치/);assert.doesNotMatch(m.practice,/본인 사망/);
  assert.throws(()=>render(made,pick('depth1_r1_made1','dq1_received','dp1_received')),code('COACHING_SELECTION_NOT_ALLOWED'));
});

test('simultaneous and posthumous records stay qualified instead of becoming ordered event or causal claims',()=>{
  const e=evidence([makeRound([[10,'focus','enemy1'],[10,'enemy2','focus']])]);
  const card=render(e,pick('depth1_r1_opening','dq1_opening','dp1_opening'));
  assert.match(card.observation,/동시 첫 사건/);assert.match(card.limitation,/동시 사건 내부 순서/);
  assert.throws(()=>render(e,pick('depth1_r1_opening','dq1_opening','dp1_opening','strength')),code('COACHING_SELECTION_NOT_ALLOWED'));
  const post=evidence([makeRound([[10,'enemy1','focus'],[20,'focus','enemy2']])]);
  assert.match(render(post,pick('depth1_r1_result','dq1_result','dp1_result')).observation,/개인 종료 1킬·1사망/);
});

test('current generation rejects omitted candidates while old saved prose still reproduces exactly',async()=>{
  const e=evidence(Array.from({length:6},(_,i)=>makeRound([[10,'enemy1','mate'],[16,'focus','enemy1'],[30,'enemy2','focus']],{no:i+1})));
  const current=depth.createCoachingDepthCatalog(e),old=legacy.createCoachingFactCatalog(e);
  const omitted=old.facts.find(f=>!current.facts.some(c=>c.id===f.id));assert.ok(omitted);
  const selection=pick(omitted.id,omitted.questions[0],omitted.practices[0],omitted.kinds[0]);
  const response=legacy.renderCoachingSelection(selection,e);
  const saved={providerResponseId:'resp_old_rendering',selection,response};
  assert.deepEqual((await openai.validateResultForEvidence(saved,e)).response,response);
  assert.throws(()=>depth.validateCurrentDepthSelection(selection,e),code('COACHING_SELECTION_NOT_ALLOWED'));
  const request=preflight.buildCoachingRequest(e).request,quote=cost.makeCostQuote(1000,request,NOW);
  const decoded=await openai.decodeOpenAIResponse(openAIEnvelope(quote,selection),quote,e);
  assert.equal(decoded.result,null);assert.equal(decoded.chargedUnits,200);
});

test('old and depth variants of the same fact cannot occupy two slots',()=>{
  const e=analyzeReplay(contextFixture(),'focus').coachingEvidence;
  const selection={schemaVersion:2,cards:[
    {kind:'strength',factId:'r1_made1',questionId:'q_trade_made',practiceId:'p_trade_made'},
    {kind:'review',factId:'depth1_r1_made1',questionId:'dq1_made',practiceId:'dp1_made'},
  ]};
  assert.throws(()=>depth.validateCurrentDepthSelection(selection,e),code('COACHING_SELECTION_NOT_ALLOWED'));
  assert.throws(()=>depth.renderCoachingDepthSelection(selection,e),code('COACHING_SELECTION_NOT_ALLOWED'));
});

test('new practice candidates all include a next-three-round goal while old generic practice remains recoverable',async()=>{
  const e=analyzeReplay(contextFixture(),'focus').coachingEvidence,catalog=depth.createCoachingDepthCatalog(e);
  for(const f of catalog.facts.filter(f=>f.kinds.includes('practice'))) {
    assert.ok(f.id.startsWith('depth1_'));
    assert.match(render(e,pick(f.id,f.questions[0],f.practices[0],'practice')).practice,/다음 3라운드/);
  }
  const selection=pick('summary','q_summary','p_summary','practice'),response=legacy.renderCoachingSelection(selection,e);
  assert.throws(()=>depth.validateCurrentDepthSelection(selection,e),code('COACHING_SELECTION_NOT_ALLOWED'));
  assert.deepEqual((await openai.validateResultForEvidence({providerResponseId:'resp_old_practice',selection,response},e)).response,response);
});

test('free explanation and raw evidence stay unchanged; new context remains bounded, private and immutable',()=>{
  const e=analyzeReplay(contextFixture(),'focus').coachingEvidence,before=structuredClone(e),free=createMockReplayCoachingResponse(e);
  const catalog=depth.createCoachingDepthCatalog(e),input=depth.coachingDepthInput(catalog),request=preflight.buildCoachingRequest(e).request;
  assert.deepEqual(e,before);assert.deepEqual(createMockReplayCoachingResponse(e),free);
  assert.ok(input.facts.some(f=>f.reviewReason));assert.equal(input.metrics,undefined);
  assert.throws(()=>{catalog.facts[0].title='changed';},TypeError);
  assert.ok(Buffer.byteLength(JSON.stringify(request))<=32768);
  for(const forbidden of ['nexonSN','nickName','synthetic-context-match','enemy1'])assert.equal(JSON.stringify(request).includes(forbidden),false);
  const many=evidence(Array.from({length:64},(_,i)=>makeRound([[10,'enemy1','mate'],[16,'focus','enemy1'],[30,'enemy2','focus']],{no:i+1})));
  const capped=depth.createCoachingDepthCatalog(many);
  assert.equal(capped.facts.length,24);assert.ok(capped.selection.omittedFacts>0);
  for(const r of many.rounds)assert.ok(capped.facts.some(f=>f.evidenceRefs.includes(r.evidenceId)));
  assert.match(capped.facts.find(f=>f.id==='summary').observation,/64라운드/);
  assert.ok(Buffer.byteLength(JSON.stringify(preflight.buildCoachingRequest(many).request))<=32768);
});

test('new depth result stores and recovers after stop without another count or generation',async()=>{
  const e=evidence([makeRound([[10,'enemy1','mate'],[20,'enemy2','focus']])]);
  const selection=pick('depth1_r1_death','dq1_team','dp2_team','practice'),db=coachingMemoryDb();
  const control={schemaVersion:1,enabled:true,period:'202610',allocatedMicros:10000,rateVersion:cost.POLICY.rateVersion};
  db.data.set(cost.controlRef(db).path,control);let count=0,generate=0;
  const opts={db,uid:'depth-test',requestId:'202610-depth_result_recovery',evidence:e,access:testAccess({successLimit:50,attemptLimit:70}),
    userMicros:cost.POLICY.maxUserMicros,globalMonthly:10,now:()=>NOW,
    countTokens:async()=>{count++;return 1000;},generate:async(_r,q)=>{generate++;return openAIEnvelope(q,selection);}};
  const first=await runner.runCostedCoaching(opts);assert.equal(first.outcome,'completed');
  db.data.get(cost.controlRef(db).path).enabled=false;
  assert.deepEqual((await runner.runCostedCoaching(opts)).response,first.response);
  assert.equal(count,1);assert.equal(generate,1);
  const state=[...db.data].find(([k])=>k.startsWith('_replay_coaching_users/'))[1];
  assert.equal(state.used,1);assert.equal(state.spentUnits,200);
});

test('independent raw-event audit covers context facts and rejects a deliberate false count',()=>{
  const replay=contextFixture(),report=auditCoachingDepth(replay);assert.ok(report.depthFactsChecked>0);assert.equal(report.externalCalls,0);
  const original=depth.createCoachingDepthCatalog;
  try{
    depth.createCoachingDepthCatalog=e=>{const changed=structuredClone(original(e));
      changed.facts.find(f=>f.type==='depth_death').observation='1라운드 시작 16대16 → 1.0초 사망 직전 본인 포함 16대16 → 팀 패배.';return changed;};
    assert.throws(()=>auditCoachingDepth(replay));
  }finally{depth.createCoachingDepthCatalog=original;}
});

test('stored depth trade rendering keeps the semantic timestamp conflict guard',()=>{
  const e=evidence([makeRound([[10,'enemy1','focus'],[16,'mate','enemy1']])]);
  const corrupted=structuredClone(e);corrupted.rounds[0].tradesReceived.examples[0].gapSeconds=0.5;
  assert.throws(()=>depth.renderCoachingDepthSelection(pick('depth1_r1_received1','dq1_received','dp1_received'),corrupted),code('FACT_EVIDENCE_CONFLICT'));
});
