import test from 'node:test';
import assert from 'node:assert/strict';
import depth from '../../cloud-functions/replay-coaching-depth.js';
import openai from '../../cloud-functions/replay-coaching-openai.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import runner from '../../cloud-functions/replay-coaching-runner.js';
import {analyzeReplay} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {makeReplay,makeRound} from '../fixtures/replay-context.js';
import {openAIEnvelope} from '../helpers/coaching-openai-fixture.js';
import {coachingMemoryDb} from '../helpers/coaching-memory-db.js';
import {testAccess} from '../helpers/coaching-test-access.js';

const NOW=Date.parse('2026-10-26T00:00:00Z');
const evidence=()=>analyzeReplay(makeReplay([
  makeRound([[10,'enemy1','mate'],[16,'focus','enemy1'],[30,'enemy2','focus']]),
  makeRound([[10,'enemy1','focus'],[16,'mate','enemy1']],{no:2}),
  makeRound([[10,'focus','enemy1'],[30,'enemy2','focus']],{no:3}),
]),'focus').coachingEvidence;
const card=(kind,factId,questionId,practiceId)=>({kind,factId,questionId,practiceId});
const select=(...cards)=>({schemaVersion:2,cards});
const made=kind=>card(kind,'depth1_r1_made1','dq1_made','dp2_made');
const received=kind=>card(kind,'depth1_r2_received1','dq1_received','dp2_received');
const opening=kind=>card(kind,'depth1_r3_opening','dq1_opening','dp2_opening');
const code=expected=>error=>error.code===expected;
const quote=e=>cost.makeCostQuote(1000,preflight.buildCoachingRequest(e).request,NOW);

test('current facts expose a shared topic across made/received and legacy/depth variants, and versioned action goals',()=>{
 const e=evidence(),catalog=depth.createCoachingDepthCatalog(e),input=depth.coachingDepthInput(catalog);
 assert.equal(catalog.facts.find(f=>f.id==='depth1_r1_made1').topic,'trade');
 assert.equal(catalog.facts.find(f=>f.id==='depth1_r2_received1').topic,'trade');
 assert.ok(input.facts.every(f=>typeof f.topic==='string'));
 assert.ok(input.practices.some(p=>p.id==='dp2_made'));
 assert.equal(input.practices.some(p=>p.id.startsWith('dp1_')),false);
 for(const f of catalog.facts.filter(f=>f.id.startsWith('depth1_')))for(const questionId of f.questions)for(const practiceId of f.practices){
  assert.match(practiceId,/^dp2_/);
  const rendered=depth.renderCoachingDepthSelection(select(card(f.kinds[0],f.id,questionId,practiceId)),e).cards[0];
  assert.ok(rendered.practice.length<=80);assert.match(rendered.practice,/다음 3라운드.*확인/);
  assert.doesNotMatch(rendered.practice,/시각을 구분해 적|승패를 나눠 기록/);
 }
 const request=preflight.buildCoachingRequest(e).request;
 assert.match(request.instructions,/서로 다른 topic/);assert.match(request.instructions,/슬롯을 null/);
});

test('same trade topic in different rounds is reduced without replacing any model-selected fact',()=>{
 const e=evidence(),selection=select(made('strength'),received('review'),opening('practice')),before=structuredClone(selection);
 const curated=depth.curateCurrentDepthSelection(selection,e);
 assert.deepEqual(curated,select(received('review'),opening('practice')));
 assert.deepEqual(selection,before);
 assert.deepEqual(depth.curateCurrentDepthSelection(curated,e),curated);
});

test('practice wins over a same-topic review and strength; a missing practice prefers review to strength',()=>{
 const e=evidence();
 assert.deepEqual(depth.curateCurrentDepthSelection(select(made('strength'),received('review'),
  card('practice','depth1_r1_death','dq1_team','dp2_team')),e),
  select(received('review'),card('practice','depth1_r1_death','dq1_team','dp2_team')));
 assert.deepEqual(depth.curateCurrentDepthSelection(select(made('strength'),received('practice')),e),select(received('practice')));
 assert.deepEqual(depth.curateCurrentDepthSelection(select(made('strength'),received('review')),e),select(received('review')));
});

test('distinct topics keep all slots while legacy and new survival facts share one theme',()=>{
 const e=evidence(),catalog=depth.createCoachingDepthCatalog(e);
 const selected=select(opening('strength'),received('review'),card('practice','depth1_r1_death','dq1_team','dp2_team'));
 assert.deepEqual(depth.curateCurrentDepthSelection(selected,e),selected);
 assert.equal(catalog.facts.find(f=>f.id==='depth1_r1_death').topic,'survival');
 // Current catalog is bounded; legacy survival topics are checked when offered.
 for(const f of catalog.facts.filter(f=>['death','round_start'].includes(f.type)))assert.equal(f.topic,'survival');
});

test('an invalid pair or old practice ID cannot be hidden in a card that curation would discard',async()=>{
 const e=evidence(),invalid={...made('strength'),questionId:'dq1_received'};
 assert.throws(()=>depth.curateCurrentDepthSelection(select(invalid,received('practice')),e),code('COACHING_SELECTION_NOT_ALLOWED'));
 const q=quote(e),decoded=await openai.decodeOpenAIResponse(openAIEnvelope(q,select(invalid,received('practice'))),q,e);
 assert.equal(decoded.result,null);assert.equal(decoded.chargedUnits,200);
 const old={...made('strength'),practiceId:'dp1_made'};
 assert.throws(()=>depth.curateCurrentDepthSelection(select(old,received('practice')),e),code('COACHING_SELECTION_NOT_ALLOWED'));
 const alias=card('strength','r1_made1','q_trade_made','p_trade_made');
 assert.throws(()=>depth.curateCurrentDepthSelection(select(alias,made('practice')),e),code('COACHING_SELECTION_NOT_ALLOWED'));
});

test('decoder returns a valid smaller selection and accounts for the one original response',async()=>{
 const e=evidence(),q=quote(e),selection=select(made('strength'),received('review'),opening('practice'));
 const decoded=await openai.decodeOpenAIResponse(openAIEnvelope(q,selection),q,e);
 assert.equal(decoded.chargedUnits,200);assert.equal(decoded.measured.usage.output_tokens,200);
 assert.deepEqual(decoded.result.selection,select(received('review'),opening('practice')));
 assert.equal(decoded.result.response.cards.length,2);
 assert.match(decoded.result.response.cards[1].practice,/첫 교전 전 엄폐·생존 인원을 확인/);
});

test('curated result is saved once and recovered unchanged after stop without new tokens, generation or writes',async()=>{
 const e=evidence(),db=coachingMemoryDb();let counts=0,generations=0;
 db.data.set(cost.controlRef(db).path,{schemaVersion:1,enabled:true,period:'202610',allocatedMicros:10000,rateVersion:cost.POLICY.rateVersion});
 const opts={db,uid:'curation-test',requestId:'202610-curation_saved_result',evidence:e,now:()=>NOW,
  access:testAccess({successLimit:50,attemptLimit:70}),userMicros:cost.POLICY.maxUserMicros,globalMonthly:10,
  countTokens:async()=>{counts++;return 1000;},generate:async(_r,q)=>{generations++;return openAIEnvelope(q,select(made('strength'),received('review'),opening('practice')));}};
 const first=await runner.runCostedCoaching(opts);assert.equal(first.response.cards.length,2);
 const user=[...db.data].find(([k])=>k.startsWith('_replay_coaching_users/'))[1];
 assert.equal(user.used,1);assert.equal(user.attempts,1);assert.equal(user.spentUnits,200);
 db.data.get(cost.controlRef(db).path).enabled=false;
 const tx=db.runTransaction.bind(db);let reads=0,writes=0;
 db.runTransaction=fn=>tx(t=>fn({get:ref=>{reads++;return t.get(ref);},set:(ref,v)=>{writes++;return t.set(ref,v);}}));
 assert.deepEqual((await runner.runCostedCoaching(opts)).response,first.response);
 assert.equal(counts,1);assert.equal(generations,1);assert.equal(reads,2);assert.equal(writes,0);
});

test('historical dp1 texts and same-topic saved cards remain exact and are not retrospectively curated',async()=>{
 const e=evidence(),selection=select({...made('strength'),practiceId:'dp1_made'},{...received('review'),practiceId:'dp1_received'});
 const response=depth.renderCoachingDepthSelection(selection,e);
 assert.equal(response.cards[0].practice,'복기: 아군 사망 뒤 본인 처치까지 간격은?\n다음 3라운드 아군 사망·본인 처치 시각을 구분해 적는 것을 목표로 하세요.');
 assert.equal(response.cards[1].practice,'복기: 본인 사망 뒤 팀원의 후속 처치는?\n다음 3라운드 교전 전 팀원 수 확인을 목표로, 경기 후 본인 사망·후속 처치를 구분하세요.');
 const recovered=await openai.validateResultForEvidence({providerResponseId:'resp_old_same_topic',selection,response},e);
 assert.deepEqual(recovered.response,response);assert.equal(recovered.response.cards.length,2);
 const tampered=structuredClone(response);tampered.cards[0].practice+='!';
 await assert.rejects(openai.validateResultForEvidence({providerResponseId:'resp_tampered',selection,response:tampered},e),code('COACHING_RESULT_MISMATCH'));
});

test('action goals keep solo and dead-team restrictions, and never count a missing situation as a failed goal',()=>{
 const e=analyzeReplay(makeReplay([makeRound([[10,'enemy1','mate'],[20,'enemy2','spare'],[30,'enemy3','focus']])]),'focus').coachingEvidence;
 const catalog=depth.createCoachingDepthCatalog(e),death=catalog.facts.find(f=>f.id==='depth1_r1_death');
 assert.equal(death.practices.includes('dp2_team'),false);
 assert.throws(()=>depth.validateCurrentDepthSelection(select(card('practice',death.id,'dq1_team','dp2_team')),e),code('COACHING_SELECTION_NOT_ALLOWED'));
 const solo=catalog.facts.find(f=>f.id==='depth1_r1_solo');
 assert.equal(solo.topic,'solo');assert.equal(death.topic,'survival');
 const rendered=depth.renderCoachingDepthSelection(select(card('practice',solo.id,'dq1_solo','dp2_solo')),e).cards[0];
 assert.match(rendered.practice,/상황이 없으면 제외/);assert.doesNotMatch(rendered.practice,/팀원과 합류|승률|보장/);
});
