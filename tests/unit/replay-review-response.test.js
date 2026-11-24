import test from 'node:test';
import assert from 'node:assert/strict';
import adapter from '../../cloud-functions/replay-coaching-review-response.js';
import catalog from '../../cloud-functions/replay-coaching-review-catalog.js';
import input from '../../cloud-functions/replay-coaching-review-input.js';
import { hashReplayReviewEvidence, serializeReplayReviewBinding, validateReplayReviewEnvelope, validateReplayReviewCards } from '../../src/domains/stats/sudden-attack/replay/domain/replay-review-response.js';
import { createReplayReviewResultSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-review-result-session.js';
import { renderReplayReviewResultCards } from '../../src/domains/stats/sudden-attack/replay/ui/replay-review-result.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingReview } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import { contextFixture } from '../fixtures/replay-context.js';
const review = player => buildReplayCoachingReview(analyzeReplay(contextFixture(),player??'focus'));
const selection = e => { const f=catalog.createReviewCatalog(e).facts[0];return {schemaVersion:2,cards:[{kind:'review',factId:f.id,questionId:f.questions[0],practiceId:f.practices[0]}]}; };
const stored = e => ({providerResponseId:'resp_offline_ui',selection:selection(e),response:catalog.renderReviewSelection(selection(e),e)});
const envelope = e => adapter.buildReviewClientResult(stored(e),e);
const file = value => { const text=JSON.stringify(value);return {name:'saved-result.json',size:new TextEncoder().encode(text).byteLength,text:async()=>text}; };
const deferred = () => {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('server view adapter binds the browser analyzer evidence and drops accounting/provider/selection fields without changing storage',async()=>{
  const e=review(),record=stored(e),before=structuredClone(record),dto=await adapter.buildReviewClientResult(record,e);
  assert.deepEqual(Object.keys(dto),['schemaVersion','mode','evidenceHash','response']);assert.deepEqual(record,before);
  assert.deepEqual(await validateReplayReviewEnvelope(dto,e),record.response);
  assert.equal(dto.evidenceHash,await hashReplayReviewEvidence(input.normalizeReviewEvidence(e)));
  assert.doesNotMatch(JSON.stringify(dto),/providerResponseId|factId|usage|nexonSN|nickName/);
  const changed=structuredClone(record);changed.response.cards[0].observation='unsupported';
  await assert.rejects(adapter.buildReviewClientResult(changed,e));
  await assert.rejects(adapter.buildReviewClientResult(record,analyzeReplay(contextFixture(),'focus').coachingEvidence));
});

test('binding is stable across object-key order and server-owned prose, but changes with semantic evidence',async()=>{
  const e=review(),n=structuredClone(e);n.limitations=['replacement'];n.candidates[0].basis.explanation='replacement';
  n.coverage=Object.fromEntries(Object.entries(n.coverage).reverse());
  assert.equal(serializeReplayReviewBinding(e),serializeReplayReviewBinding(n));
  const dto=await envelope(e),other=review('mate');
  await assert.rejects(validateReplayReviewEnvelope(dto,other),/REVIEW_EVIDENCE_MISMATCH/);
  for(const mutate of [v=>{v.candidates[0].flow.anchor.timeSeconds+=0.1;},v=>{v.candidates[0].flow.anchor.before.own++;},v=>{v.candidates.reverse();}]){
    const altered=structuredClone(e);mutate(altered);assert.notEqual(await hashReplayReviewEvidence(altered),dto.evidenceHash);
  }
});

test('client contract rejects malformed/versioned/oversized envelopes, unknown refs, impossible kinds and duplicate scenes',async()=>{
  const e=review(),dto=await envelope(e);
  const mutations=[v=>{v.schemaVersion=2;},v=>{v.mode='live';},v=>{v.extra='private';},v=>{v.evidenceHash=['bad'];},
    v=>{v.response.schemaVersion=2;},v=>{v.response.cards=[];},v=>{v.response.cards[0].kind='strength';},
    v=>{v.response.cards[0].evidenceRefs=['round-64'];},v=>{v.response.cards[0].evidenceRefs=['verified-rounds'];},
    v=>{v.response.cards[0].evidenceRefs.push('round-1');},v=>{v.response.cards.push({...v.response.cards[0],kind:'practice'});},
    v=>{v.response.cards[0].title='x'.repeat(31);},v=>{v.response.cards[0].practice='x'.repeat(81);},
    v=>{v.response.cards[0].observation='x'.repeat(9000);},v=>{v.response.cards[0].title=' ';},v=>{v.response.cards[0]=null;}];
  for(const mutate of mutations){const v=structuredClone(dto);mutate(v);await assert.rejects(validateReplayReviewEnvelope(v,e),/INVALID_REVIEW_RESULT/);}
  for(const value of [null,{},[],{...dto,evidenceHash:'0'.repeat(64)}])await assert.rejects(validateReplayReviewEnvelope(value,e));
});

test('rendered saved cards escape imported prose, preserve question/goal breaks and link the precise current anchor',()=>{
  const e=review(),r=stored(e).response;r.cards[0].title='<img src=x onerror=alert(1)>';
  const html=renderReplayReviewResultCards(r,e),ref=e.candidates.find(c=>c.evidenceId===r.cards[0].evidenceRefs[0]);
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/review-practice/);
  assert.ok(html.includes(`data-review-jump="${ref.round}"`));assert.ok(html.includes(`${ref.flow.anchor.timeSeconds.toFixed(1)}초 근거 보기`));
  const linked=renderReplayReviewResultCards(r,e,{playbackRefs:new Set([ref.evidenceId])});
  assert.ok(linked.includes(`data-review-playback="${ref.evidenceId}"`));assert.doesNotMatch(linked,/<img/);
  const unavailable=renderReplayReviewResultCards(r,e,{playbackRefs:new Set()});
  assert.doesNotMatch(unavailable,/data-review-playback/);assert.match(unavailable,/재생 시점 확인 보류/);
  assert.ok(unavailable.includes(`data-review-jump="${ref.round}"`));
  assert.throws(()=>validateReplayReviewCards(r,{...e,status:'insufficient_data'}));
});

test('import session displays only validated evidence-bound cards, clears old cards on failure and never retries',async()=>{
  const e=review(),dto=await envelope(e),states=[],s=createReplayReviewResultSession(e,{onChange:v=>states.push(v.state)});
  assert.equal(s.view().state,'empty');await s.load(file(dto));assert.equal(s.view().state,'ready');assert.deepEqual(s.view().response,dto.response);
  await s.load(file(await envelope(review('mate'))));assert.equal(s.view().state,'mismatch');assert.equal(s.view().response,null);
  await s.load(file(dto));await s.load({name:'broken.json',size:1,text:async()=>'{'});assert.equal(s.view().state,'invalid');assert.equal(s.view().response,null);
  await s.load(file(dto));s.clear();assert.deepEqual(s.view(),{state:'empty',response:null});
  assert.deepEqual(states.slice(0,2),['pending','ready']);
});

test('import checks file size/extension before reading and actual UTF-8 size after reading',async()=>{
  const s=createReplayReviewResultSession(review());let reads=0;
  for(const bad of [{name:'x.json',size:8193},{name:'x.txt',size:10},{name:'x.json',size:0}]){
    await s.load({...bad,text:async()=>{reads++;return '{}';}});assert.equal(s.view().state,'invalid');
  }
  assert.equal(reads,0);await s.load({name:'x.json',size:10,text:async()=>'가'.repeat(3000)});assert.equal(s.view().state,'invalid');
  await s.load({name:'x.json',size:10,text:async()=>{throw new Error('private filesystem text');}});assert.equal(s.view().state,'invalid');
});

test('new imports supersede pending reads and a clear cancels pending successful or failed results',async()=>{
  const e=review(),dto=await envelope(e),s=createReplayReviewResultSession(e),slow=deferred();
  const pending=s.load({...file(dto),text:()=>slow.promise});await s.load(file(dto));assert.equal(s.view().state,'ready');
  slow.resolve('{');await pending;assert.equal(s.view().state,'ready');
  const later=deferred(),load=s.load({...file(dto),text:()=>later.promise});s.clear();later.resolve(JSON.stringify(dto));await load;
  assert.deepEqual(s.view(),{state:'empty',response:null});
});

test('disposal during file read or asynchronous hashing never publishes a stale result',async()=>{
  const e=review(),dto=await envelope(e),states=[],s=createReplayReviewResultSession(e,{onChange:v=>states.push(v.state)}),slow=deferred();
  const loading=s.load({...file(dto),text:()=>slow.promise});s.dispose();slow.resolve(JSON.stringify(dto));await loading;assert.deepEqual(states,['pending']);
  await s.load(file(dto));assert.deepEqual(states,['pending']);
  const states2=[],s2=createReplayReviewResultSession(e,{onChange:v=>states2.push(v.state)});
  const loading2=s2.load(file(dto));await Promise.resolve();s2.dispose();await loading2;assert.deepEqual(states2,['pending']);
});
