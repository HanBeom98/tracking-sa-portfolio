import test from 'node:test';
import assert from 'node:assert/strict';
import openai from '../../cloud-functions/replay-coaching-openai.js';
import runner from '../../cloud-functions/replay-coaching-runner.js';
import resultStore from '../../cloud-functions/replay-coaching-result.js';
import budget from '../../cloud-functions/replay-coaching-preflight.js';
import quota from '../../cloud-functions/replay-coaching-quota.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture } from '../fixtures/replay-context.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { testAccess } from '../helpers/coaching-test-access.js';
import { coachingSelection, coachingResponse, openAIEnvelope } from '../helpers/coaching-openai-fixture.js';
const NOW = Date.parse('2026-10-25T00:00:00Z');
const evidence = () => analyzeReplay(contextFixture(), 'focus').coachingEvidence;
const code = expected => error => error.code === expected;
function setup() {
  const db = coachingMemoryDb();
  db.data.set(cost.controlRef(db).path, { schemaVersion: 1, enabled: true, period: '202610',
    allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  return db;
}
const options = (db, overrides = {}) => ({ db, uid: 'provider-tester', requestId: '202610-provider_request_0001', evidence: evidence(),
  access: testAccess({successLimit:50,attemptLimit:70}), userMicros: cost.POLICY.maxUserMicros,
  globalMonthly: 1000, countTokens: async () => 1000, generate: async (_request,q) => openAIEnvelope(q), now: () => NOW, ...overrides });
const pair = () => { const {request,evidence:normalized} = budget.buildCoachingRequest(evidence());
  return {request, evidence:normalized, quote:cost.makeCostQuote(1000,request,NOW)}; };
const user = db => [...db.data].find(([k])=>k.startsWith('_replay_coaching_users/'))?.[1];
const global = db => db.data.get('_replay_coaching_months/usd_micro_v1_202610');

test('generation transport is opt-in, sends the bound payload once, and has no fallback or redirect', async () => {
  assert.throws(()=>openai.createOpenAIGenerator({apiKey:'fixture'}),code('PROVIDER_DISABLED'));
  for(const timeoutMs of [0,45001,NaN]) assert.throws(()=>openai.createOpenAIGenerator({enabled:true,apiKey:'fixture',timeoutMs}));
  const p=pair(); let calls=0;
  const generate=openai.createOpenAIGenerator({enabled:true,apiKey:'fixture-key',fetchImpl:async(url,init)=>{
    calls++; assert.equal(url,'https://api.openai.com/v1/responses'); assert.equal(init.method,'POST');
    assert.equal(init.redirect,'error'); assert.equal(init.headers.Authorization,'Bearer fixture-key');
    assert.equal(init.body,JSON.stringify(p.request)); assert.ok(init.signal);
    return Response.json(openAIEnvelope(p.quote));
  }});
  await assert.rejects(generate({...p.request,model:'gpt-6-astra'},p.quote)); assert.equal(calls,0);
  await assert.rejects(generate({...p.request,instructions:'changed'},p.quote),code('INVALID_COST_REQUEST'));
  assert.equal((await generate(p.request,p.quote)).object,'response'); assert.equal(calls,1);
  await assert.rejects(generate(p.request,p.quote),code('PROVIDER_ALREADY_DISPATCHED')); assert.equal(calls,1);
});

test('HTTP rejection, network errors, oversized/malformed body and deadlines keep outcome unknown without retries or leaked text', async () => {
  const transports=[... [400,401,429,500].map(status=>async()=>new Response('private-key-provider-text',{status})),
    async()=>{throw new Error('private-key-provider-text');},async()=>new Response('{private-key-provider-text'),
    async()=>new Response('x'.repeat(65537)),async()=>new Promise(()=>{}),
    async()=>new Response(new ReadableStream({start(){}}))];
  for(const fetchImpl of transports) {
    const p=pair(); let calls=0;
    const generate=openai.createOpenAIGenerator({enabled:true,apiKey:'fixture',timeoutMs:10,
      fetchImpl:async(...args)=>{calls++; return fetchImpl(...args);}});
    await assert.rejects(generate(p.request,p.quote),error=>error.code==='PROVIDER_OUTCOME_UNCONFIRMED'
      && !JSON.stringify(error).includes('private-key-provider-text') && !error.message.includes('private'));
    assert.equal(calls,1);
    await assert.rejects(generate(p.request,p.quote),code('PROVIDER_ALREADY_DISPATCHED')); assert.equal(calls,1);
  }
});

test('valid terminal response returns only bounded cards and measured expense including nonvisible tokens', async () => {
  const p=pair(), envelope=openAIEnvelope(p.quote); envelope.usage.output_tokens_details.reasoning_tokens=20;
  envelope.metadata={private:'do not persist'}; envelope.output.unshift({type:'reasoning',summary:[]});
  const decoded=await openai.decodeOpenAIResponse(envelope,p.quote,p.evidence);
  assert.equal(decoded.chargedUnits,200); assert.deepEqual(decoded.result.response,coachingResponse());
  assert.equal(decoded.measured.usage.output_tokens,200); assert.equal(decoded.measured.usage.output_tokens_details.reasoning_tokens,20);
  assert.equal(decoded.result.metadata,undefined); assert.equal(decoded.result.output,undefined);
});

test('identity, status, model, tier and every usage mismatch refuse settlement rather than assuming zero cost', async () => {
  const p=pair();
  const mutations=[r=>{r.id=['resp_array'];},r=>{r.object='other';},r=>{r.status='in_progress';},
    r=>{r.model='gpt-6-astra';},r=>{r.model='gpt-6-luna-unreviewed';},r=>{r.service_tier='priority';},
    r=>{r.usage=null;},r=>{r.usage.input_tokens++;},r=>{r.usage.output_tokens=2001;},r=>{r.usage.total_tokens++;},
    r=>{r.usage.input_tokens_details.cached_tokens=1;},r=>{delete r.usage.input_tokens_details.cache_write_tokens;},
    r=>{r.usage.input_tokens_details.cache_write_tokens=1;},r=>{r.usage.output_tokens_details.reasoning_tokens=201;}];
  for(const mutate of mutations) {const raw=openAIEnvelope(p.quote); mutate(raw);
    await assert.rejects(openai.decodeOpenAIResponse(raw,p.quote,p.evidence),code('PROVIDER_OUTCOME_UNCONFIRMED'));}
});

test('refusals, truncation, wrong references, invalid schema, long cards and tools retain known expense but no customer success', async () => {
  const p=pair();
  const mutations=[r=>{r.status='incomplete';},r=>{r.status='failed';},r=>{r.error={message:'private'};},
    r=>{r.output[0].content=[{type:'refusal',refusal:'private'}];},r=>{r.output.push({type:'function_call'});},
    r=>{r.output[0].content[0].text='not JSON';},r=>{r.output[0].content[0].annotations=[{}];},
    r=>{const value=coachingResponse();value.cards[0].evidenceRefs=['round-64'];r.output[0].content[0].text=JSON.stringify(value);},
    r=>{const value=coachingResponse();value.cards[0].title='x'.repeat(31);r.output[0].content[0].text=JSON.stringify(value);},
    r=>{const value=coachingResponse();value.cards.push(value.cards[0]);r.output[0].content[0].text=JSON.stringify(value);},
    r=>{r.output[0].content[0].text=JSON.stringify({schemaVersion:1,cards:[]});}];
  for(const mutate of mutations){const raw=openAIEnvelope(p.quote);mutate(raw);
    const decoded=await openai.decodeOpenAIResponse(raw,p.quote,p.evidence);assert.equal(decoded.result,null);assert.equal(decoded.chargedUnits,200);}
});

test('successful result and cost commit atomically and duplicate returns stored cards even after stop without another count or generation', async () => {
  const db=setup();let counts=0,generations=0;
  const opts=options(db,{countTokens:async()=>{counts++;return 1000;},generate:async(_r,q)=>{generations++;return openAIEnvelope(q);}});
  assert.equal((await runner.runCostedCoaching(opts)).outcome,'completed');
  assert.equal(user(db).used,1); assert.equal(user(db).recent[0].result.providerResponseId,'resp_local_fixture');
  assert.equal(global(db).spentUnits,200);assert.equal(global(db).heldUnits,0);
  db.data.get(cost.controlRef(db).path).enabled=false;
  const again=await runner.runCostedCoaching(opts);assert.equal(again.outcome,'already_completed');assert.deepEqual(again.response,coachingResponse());
  assert.equal(counts,1);assert.equal(generations,1);assert.equal(user(db).used,1);
});

test('simultaneous duplicates cannot call provider twice', async () => {
  const db=setup();let generations=0;
  const opts=options(db,{generate:async(_r,q)=>{generations++;return openAIEnvelope(q);}});
  const outcomes=await Promise.allSettled([runner.runCostedCoaching(opts),runner.runCostedCoaching(opts)]);
  assert.ok(outcomes.some(r=>r.status==='fulfilled'));assert.equal(generations,1);assert.equal(user(db).used,1);assert.equal(global(db).spentUnits,200);
});

test('network ambiguity or invalid usage retains the dispatch reservation and blocks another generation', async () => {
  for(const invalidUsage of [false,true]) {
    const db=setup();let generations=0;
    const opts=options(db,{generate:async(_r,q)=>{generations++;if(!invalidUsage)throw new Error('private');const r=openAIEnvelope(q);r.usage=null;return r;}});
    await assert.rejects(runner.runCostedCoaching(opts),code('PROVIDER_OUTCOME_UNCONFIRMED'));
    assert.equal(user(db).used,0);assert.equal(user(db).active.stage,'dispatching');assert.equal(global(db).heldUnits,1100);
    await assert.rejects(runner.runCostedCoaching(opts),code('REQUEST_IN_PROGRESS'));assert.equal(generations,1);
  }
});

test('unusable output settles expense once, releases the unused maximum and does not use a customer success', async () => {
  const db=setup();let generations=0;
  const opts=options(db,{generate:async(_r,q)=>{generations++;const r=openAIEnvelope(q);r.status='incomplete';return r;}});
  await assert.rejects(runner.runCostedCoaching(opts),code('COACHING_OUTPUT_UNUSABLE'));
  assert.equal(user(db).used,0);assert.equal(user(db).held,0);assert.equal(user(db).recent[0].status,'failed');
  assert.equal(user(db).recent[0].result,undefined);assert.equal(global(db).spentUnits,200);assert.equal(global(db).heldUnits,0);
  await assert.rejects(runner.runCostedCoaching(opts),code('PREVIOUS_ATTEMPT_FAILED'));assert.equal(generations,1);
});

test('lost settlement acknowledgement recovers saved response on retry; failed commit retains expense reservation', async () => {
  for(const committed of [false,true]) {
    const db=setup(), base=db.runTransaction.bind(db);let txs=0,generations=0;
    db.runTransaction=async fn=>{const n=++txs;if(n===4&&!committed)throw new Error('storage failed');
      const result=await base(fn);if(n===4)throw new Error('ack lost');return result;};
    const opts=options(db,{generate:async(_r,q)=>{generations++;return openAIEnvelope(q);}});
    await assert.rejects(runner.runCostedCoaching(opts),code('COACHING_SETTLEMENT_UNCONFIRMED'));
    if(committed){assert.equal((await runner.runCostedCoaching(opts)).outcome,'already_completed');assert.equal(global(db).spentUnits,200);}
    else {await assert.rejects(runner.runCostedCoaching(opts),code('REQUEST_IN_PROGRESS'));assert.equal(global(db).heldUnits,1100);}
    assert.equal(generations,1);
  }
});

test('lost dispatch acknowledgement never starts provider and leaves durable ambiguity for explicit recovery', async () => {
  const db=setup(),base=db.runTransaction.bind(db);let txs=0,generations=0;
  db.runTransaction=async fn=>{const n=++txs,r=await base(fn);if(n===3)throw new Error('ack lost');return r;};
  const opts=options(db,{generate:async()=>{generations++;}});
  await assert.rejects(runner.runCostedCoaching(opts));assert.equal(generations,0);assert.equal(user(db).active.stage,'dispatching');
  await assert.rejects(runner.runCostedCoaching(opts),code('REQUEST_IN_PROGRESS'));assert.equal(generations,0);
});

test('explicit maximum-cost recovery fences a late successful response and cannot double settle', async () => {
  const db=setup();let release,started;
  const ready=new Promise(resolve=>{started=resolve;});
  const running=runner.runCostedCoaching(options(db,{generate:async(_r,q)=>{started();return new Promise(resolve=>{release=()=>resolve(openAIEnvelope(q));});}}));
  await ready;const active=structuredClone(user(db).active);
  await quota.recoverCoachingQuota(db,'provider-tester',{requestId:active.id,lease:active.lease,resolution:'close_max_cost',accounting:cost.ACCOUNTING},NOW+61000);
  release();await assert.rejects(running,code('COACHING_SETTLEMENT_UNCONFIRMED'));
  assert.equal(global(db).spentUnits,1100);assert.equal(user(db).used,0);assert.equal(user(db).recent[0].result,undefined);
});

test('legacy completed monetary receipts without a result never trigger paid regeneration', async () => {
  const db=setup();const p=await budget.prepareCoachingBudget(options(db));await budget.authorizeCoachingDispatch(db,p,NOW);
  const measured={model:p.quote.model,serviceTier:'default',usage:openAIEnvelope(p.quote).usage};
  await quota.finishCoachingQuota(db,p.reservation,{customerSuccess:true,chargedUnits:200,measured});let generations=0,counts=0;
  await assert.rejects(runner.runCostedCoaching(options(db,{countTokens:async()=>{counts++;return 1000;},generate:async()=>{generations++;}})),code('COACHING_RESULT_UNAVAILABLE'));
  assert.equal(generations,0);assert.equal(counts,0);assert.equal(user(db).used,1);
});

test('stored results reject hidden payloads, oversized content and nonstring IDs', () => {
  const valid={providerResponseId:'resp_fixture',response:coachingResponse()};
  assert.deepEqual(resultStore.normalizeCoachingResult(valid),valid);
  for(const result of [{...valid,rawEnvelope:'secret'},{...valid,providerResponseId:['resp_fixture']},
    {...valid,response:{...valid.response,extra:'secret'}}]) assert.throws(()=>resultStore.normalizeCoachingResult(result));
});

test('maximum retained three access windows fit a bounded document and prior results remain replayable without a call', async () => {
  const db=setup(),day=86400000;let firstOptions,firstResponse;
  const selection={schemaVersion:2,cards:[
    {kind:'strength',factId:'r1_made1',questionId:'q_trade_made',practiceId:'p_trade_made'},
    {kind:'review',factId:'r2_death',questionId:'q_death',practiceId:'p_death'},
    {kind:'practice',factId:'depth1_r1_result',questionId:'dq1_result',practiceId:'dp2_result'}]};
  const response=coachingResponse(evidence(),selection);
  for(let window=0;window<3;window++) {
    const startsAt=NOW+window*28*day,access=testAccess({id:`window-${window}`,startsAt,endsAt:startsAt+28*day,successLimit:50,attemptLimit:70});
    for(let n=0;n<70;n++) {
      const time=startsAt+Math.floor(n/5)*day,period=quota.periodAt(time);
      db.data.set(cost.controlRef(db).path,{schemaVersion:1,enabled:true,period,allocatedMicros:cost.POLICY.maxGlobalMicros,rateVersion:cost.POLICY.rateVersion});
      const opts=options(db,{access,now:()=>time,requestId:`${period}-retained_window_${window}_${String(n).padStart(4,'0')}`,
        generate:async(_r,q)=>{const raw=openAIEnvelope(q,selection);if(n<20)raw.status='incomplete';return raw;}});
      if(window===0&&n===20){firstOptions=opts;firstResponse=response;}
      if(n>=20)await runner.runCostedCoaching(opts);else await assert.rejects(runner.runCostedCoaching(opts),code('COACHING_OUTPUT_UNUSABLE'));
    }
  }
  const state=user(db),size=Buffer.byteLength(JSON.stringify(state));
  assert.equal(state.previous.length,2);assert.equal([state,...state.previous].reduce((sum,w)=>sum+w.recent.length,0),210);
  assert.ok(size<700000,`Bounded ledger bytes: ${size}`);
  const cached=await runner.runCostedCoaching({...firstOptions,now:()=>NOW+60*day,countTokens:async()=>assert.fail('recount'),generate:async()=>assert.fail('regenerate')});
  assert.deepEqual(cached.response,firstResponse);
});
