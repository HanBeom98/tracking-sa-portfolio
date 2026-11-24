import test from 'node:test';
import assert from 'node:assert/strict';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import quota from '../../cloud-functions/replay-coaching-quota.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture } from '../fixtures/replay-context.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { testAccess } from '../helpers/coaching-test-access.js';

const NOW = Date.parse('2026-10-25T00:00:00Z'), { POLICY, ACCOUNTING } = cost;
const evidence = () => analyzeReplay(contextFixture(), 'focus').coachingEvidence;
const id = (n, now = NOW) => `${quota.periodAt(now)}-budget_request_${String(n).padStart(5, '0')}`;
const code = value => error => error.code === value;
const control = (db, overrides = {}) => db.data.set(cost.controlRef(db).path, {
  schemaVersion: 1, enabled: true, period: quota.periodAt(NOW), allocatedMicros: 10000, rateVersion: POLICY.rateVersion, ...overrides });
const setup = () => { const db = coachingMemoryDb(); control(db); return db; };
const prepare = (db, n = 1, options = {}) => preflight.prepareCoachingBudget({ db, uid: 'tester', requestId: id(n),
  evidence: evidence(), access: testAccess({ successLimit: 50, attemptLimit: 70 }), userMicros: POLICY.maxUserMicros,
  globalMonthly: 100, countTokens: async () => 1000, now: () => NOW, ...options });
const measured = (input = 1000, output = 200) => ({ model: POLICY.model, serviceTier: 'default', usage: {
  input_tokens: input, output_tokens: output, total_tokens: input + output,
  input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } });
async function finish(db, prepared, success = true, output = 200) {
  return quota.finishCoachingQuota(db, prepared.reservation, { customerSuccess: success,
    chargedUnits: cost.costMicros(prepared.quote.inputTokens, output), measured: measured(prepared.quote.inputTokens, output) });
}
const state = (db, p) => ({ user: db.data.get(p.reservation.userRef.path), global: db.data.get(p.reservation.globalRef.path) });
const snapshot = db => structuredClone([...db.data]);

test('full request fixes model/output/tier/cache behavior and includes only server facts and permitted selection IDs', () => {
  const raw = evidence(), before = structuredClone(raw), built = preflight.buildCoachingRequest(raw);
  assert.equal(built.request.model, 'gpt-6-luna'); assert.equal(built.request.max_output_tokens, 2000);
  assert.deepEqual(built.request.reasoning, { effort: 'none', mode: 'standard' }); assert.equal(built.request.service_tier, 'default');
  assert.deepEqual(built.request.prompt_cache_options, { mode: 'explicit' });
  assert.equal(built.request.store, false); assert.equal(built.request.truncation, 'disabled');
  const input = JSON.parse(built.request.input[0].content), schema = built.request.text.format.schema;
  assert.equal(input.schemaVersion, 2); assert.deepEqual(input.coverage, built.evidence.coverage);
  assert.equal(built.request.text.format.name, 'replay_coaching_selection_v3');
  assert.deepEqual(schema.properties.schemaVersion.enum, [3]);
  assert.deepEqual(schema.properties.slots.required, ['strength', 'review', 'practice']);
  for (const kind of schema.properties.slots.required) {
    const eligible = input.facts.filter(f => f.kinds.includes(kind)), slot = schema.properties.slots.properties[kind];
    if (!eligible.length) { assert.deepEqual(slot, { type: 'null' }); continue; }
    const properties = slot.anyOf[0].properties;
    assert.deepEqual(properties.factId.enum, eligible.map(f => f.id));
    assert.deepEqual(properties.questionId.enum, [...new Set(eligible.flatMap(f => f.questions))]);
    assert.deepEqual(properties.practiceId.enum, [...new Set(eligible.flatMap(f => f.practices))]);
    assert.equal(properties.kind, undefined); assert.equal(properties.observation, undefined); assert.equal(properties.evidenceRefs, undefined);
    assert.deepEqual(slot.anyOf[1], { type: 'null' });
  }
  assert.equal(input.metrics, undefined); assert.equal(input.rounds, undefined);
  assert.throws(() => { built.request.max_output_tokens = 9000; }, TypeError);
  assert.throws(() => { schema.properties.slots.properties.review.type = 'array'; }, TypeError);
  assert.deepEqual(raw, before); assert.ok(Buffer.byteLength(JSON.stringify(built.request)) > Buffer.byteLength(JSON.stringify(raw)));
});

test('cost uses integer microdollars and upward rounding, without assuming cached-input discounts', () => {
  assert.equal(cost.costMicros(6000, 2000), 1600); assert.equal(cost.costMicros(1, 0), 1);
  assert.equal(cost.costMicros(1000, 200), 200); assert.equal(cost.costMicros(1001, 200), 201);
  assert.equal(POLICY.maxUserMicros, Number(400n * 1000000n * 5n / (1800n * 6n)));
  assert.equal(POLICY.maxGlobalMicros, Number(10000n * 1000000n * 5n / (1800n * 6n)));
  for (const tokens of [-1, 1.1, NaN, Infinity, 6001]) assert.throws(() => cost.costMicros(tokens, 1));
});

test('quote binds counted input to exact payload, price version and hard output ceiling', () => {
  const { request } = preflight.buildCoachingRequest(evidence()), q = cost.makeCostQuote(6000, request, NOW);
  assert.equal(q.maxCostMicros, 1600); assert.equal(q.requestHash, cost.requestHash(request));
  cost.validateCostQuote(q, NOW + 29999);
  assert.throws(() => cost.validateCostQuote(q, NOW + 30000), code('COST_QUOTE_EXPIRED'));
  assert.throws(() => cost.validateCostQuote(q, NOW - 1), code('COST_QUOTE_EXPIRED'));
  for (const delta of [{ rateVersion: 'unknown' }, { model: 'gpt-6-astra' }, { maxOutputTokens: 4000 }, { maxCostMicros: 1 }]) {
    assert.throws(() => cost.validateCostQuote({ ...q, ...delta }), code('INVALID_COST_QUOTE'));
  }
  for (const change of [{ model: 'gpt-6-astra' }, { max_output_tokens: 9000 }, { service_tier: 'auto' },
    { tools: [{ type: 'web_search' }] }, { reasoning: { effort: 'none', mode: 'pro' } },
    { prompt_cache_options: { mode: 'implicit' } }]) {
    assert.throws(() => cost.makeCostQuote(1000, { ...request, ...change }, NOW), code('INVALID_COST_REQUEST'));
  }
});

test('token transport is explicitly enabled, calls only count once and includes the full schema and roles', async () => {
  assert.throws(() => preflight.createOpenAITokenCounter({ apiKey: 'fixture' }), code('TOKEN_COUNTER_DISABLED'));
  const { request } = preflight.buildCoachingRequest(evidence()); let calls = 0;
  const counter = preflight.createOpenAITokenCounter({ enabled: true, apiKey: 'fixture-key', fetchImpl: async (url, init) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses/input_tokens');
    assert.equal(init.redirect, 'error'); assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer fixture-key');
    const body = JSON.parse(init.body);
    for (const key of ['model', 'instructions', 'input', 'text', 'reasoning', 'truncation']) assert.deepEqual(body[key], request[key]);
    assert.equal(body.max_output_tokens, undefined);
    return { ok: true, json: async () => ({ object: 'response.input_tokens', input_tokens: 1234 }) };
  } });
  assert.equal(await counter(request), 1234); assert.equal(calls, 1);
});

test('token errors, throttling, malformed counts and timeout do not retry or leak provider messages', async () => {
  const { request } = preflight.buildCoachingRequest(evidence());
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ object: 'response.input_tokens', input_tokens: 0 }) },
    { ok: true, json: async () => { throw new Error('private provider body'); } }]) {
    let calls = 0;
    const counter = preflight.createOpenAITokenCounter({ enabled: true, apiKey: 'fixture', fetchImpl: async () => { calls++; return response; } });
    await assert.rejects(counter(request), code('TOKEN_COUNT_UNAVAILABLE')); assert.equal(calls, 1);
  }
  let calls = 0;
  const timeout = preflight.createOpenAITokenCounter({ enabled: true, apiKey: 'fixture', timeoutMs: 5,
    fetchImpl: async () => { calls++; return new Promise(() => {}); } });
  await assert.rejects(timeout(request), code('TOKEN_COUNT_UNAVAILABLE')); assert.equal(calls, 1);
});

test('missing/disabled/stale/unfunded controls stop preparation before any token request or write', async () => {
  for (const change of [null, { enabled: false }, { allocatedMicros: 0 }, { allocatedMicros: POLICY.maxGlobalMicros + 1 },
    { period: '202609' }, { rateVersion: 'unreviewed' }]) {
    const db = coachingMemoryDb(); if (change) control(db, change);
    const before = snapshot(db); let counts = 0;
    await assert.rejects(prepare(db, 1, { countTokens: async () => { counts++; return 1000; } }), code('COACHING_STOPPED'));
    assert.equal(counts, 0); assert.deepEqual(snapshot(db), before);
  }
});

test('invalid local settings and insufficient evidence are rejected before counting', async () => {
  const db = setup(); let counts = 0;
  const countTokens = async () => { counts++; return 1000; };
  for (const options of [{ userMicros: POLICY.maxUserMicros + 1 }, { userMicros: 0 }, { globalMonthly: 10001 },
    { requestId: 'bad' }, { uid: '' }, { countTokens: undefined }]) {
    await assert.rejects(prepare(db, 1, { countTokens, ...options }));
  }
  const empty = contextFixture(); for (const r of empty.replay_info.replayRoundInfo) r.replayCharacterInfo = [];
  await assert.rejects(prepare(db, 1, { countTokens, evidence: analyzeReplay(empty, 'focus').coachingEvidence }), code('INSUFFICIENT_EVIDENCE'));
  assert.equal(counts, 0); assert.equal(db.data.size, 1);
});

test('unknown, fractional and oversized token counts reserve no usage or money', async () => {
  for (const value of [0, -1, 1.5, NaN, Infinity, 6001, '1000']) {
    const db = setup(), before = snapshot(db);
    await assert.rejects(prepare(db, 1, { countTokens: async () => value }));
    assert.deepEqual(snapshot(db), before);
  }
});

test('known usage settles user and global dollars independently from customer success', async () => {
  const db = setup(), p = await prepare(db);
  assert.equal(state(db, p).user.accounting, ACCOUNTING); assert.equal(state(db, p).global.accounting, ACCOUNTING);
  assert.equal(state(db, p).global.heldUnits, 1100);
  await preflight.authorizeCoachingDispatch(db, p, NOW); await finish(db, p);
  assert.equal(state(db, p).user.used, 1); assert.equal(state(db, p).user.spentUnits, 200);
  assert.equal(state(db, p).global.spentUnits, 200); assert.equal(state(db, p).global.heldUnits, 0);
  assert.equal(state(db, p).user.days[0].used, 1);
  assert.equal(state(db, p).user.recent[0].quote.rateVersion, POLICY.rateVersion);
  assert.equal(state(db, p).user.recent[0].outputTokens, 200);
  assert.ok(!JSON.stringify(snapshot(db)).includes('observation'));
});

test('completed, failed and unresolved requests are checked before another token count', async () => {
  for (const outcome of ['success', 'failure', 'pending']) {
    const db = setup(), p = await prepare(db);
    if (outcome !== 'pending') { await preflight.authorizeCoachingDispatch(db, p, NOW); await finish(db, p, outcome === 'success'); }
    let counts = 0; const options = { countTokens: async () => { counts++; return 1000; } };
    if (outcome === 'success') {
      control(db, { enabled: false });
      const duplicate = await prepare(db, 1, options); assert.equal(duplicate.reservation.duplicate, true);
      await assert.rejects(preflight.authorizeCoachingDispatch(db, duplicate, NOW), code('ALREADY_COMPLETED'));
    } else await assert.rejects(prepare(db, 1, options), code(outcome === 'pending' ? 'REQUEST_IN_PROGRESS' : 'PREVIOUS_ATTEMPT_FAILED'));
    assert.equal(counts, 0);
  }
});

test('incurred failed-output cost blocks personal-budget bypass via fresh request IDs', async () => {
  const db = setup(), p = await prepare(db, 1, { userMicros: 1200 });
  await preflight.authorizeCoachingDispatch(db, p, NOW); await finish(db, p, false);
  assert.equal(state(db, p).user.used, 0); assert.equal(state(db, p).user.spentUnits, 200);
  await assert.rejects(prepare(db, 2, { userMicros: 1200 }), code('USER_BUDGET_LIMIT'));
  assert.equal(state(db, p).global.spentUnits, 200);
});

test('concurrent accounts share one persistent funded budget including maximum reservations', async () => {
  const db = setup(); control(db, { allocatedMicros: 1100 });
  const results = await Promise.allSettled([prepare(db, 1), prepare(db, 2, { uid: 'second' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'GLOBAL_BUDGET_LIMIT');
  const p = results.find(r => r.status === 'fulfilled').value;
  assert.equal(state(db, p).global.heldUnits, 1100);
});

test('stop between count and reservation is observed atomically with no partial ledger write', async () => {
  const db = setup();
  await assert.rejects(prepare(db, 1, { countTokens: async () => { control(db, { enabled: false }); return 1000; } }), code('COACHING_STOPPED'));
  assert.equal(db.data.size, 1);
});

test('stop, smaller funding and quote expiry before dispatch cancel unspent reservations', async () => {
  for (const action of ['stop', 'lower-budget', 'expire']) {
    const db = setup(), p = await prepare(db);
    if (action === 'stop') control(db, { enabled: false });
    if (action === 'lower-budget') control(db, { allocatedMicros: 1000 });
    await assert.rejects(preflight.authorizeCoachingDispatch(db, p, NOW + (action === 'expire' ? 30000 : 0)), code('COACHING_DISPATCH_BLOCKED'));
    assert.equal(state(db, p).global.heldUnits, 0); assert.equal(state(db, p).global.spentUnits, 0);
    assert.equal(state(db, p).user.used, 0); assert.equal(state(db, p).user.attempts, 1);
    assert.equal(state(db, p).user.recent[0].status, 'cancelled');
  }
});

test('changed schema cannot reuse a token count or dispatch authorization', async () => {
  const db = setup(), p = await prepare(db), altered = structuredClone(p.request);
  altered.text.format.schema.properties.slots.properties.review = { type: 'null' };
  await assert.rejects(preflight.authorizeCoachingDispatch(db, { ...p, request: altered }, NOW), code('INVALID_COST_QUOTE'));
  assert.equal(state(db, p).user.active.stage, 'reserved');
  await preflight.authorizeCoachingDispatch(db, p, NOW);
  await assert.rejects(preflight.authorizeCoachingDispatch(db, p, NOW), code('QUOTA_STATE_INVALID'));
});

test('stopping after dispatch cannot erase expense or prevent legitimate settlement', async () => {
  const db = setup(), p = await prepare(db); await preflight.authorizeCoachingDispatch(db, p, NOW);
  control(db, { enabled: false }); await finish(db, p, false);
  assert.equal(state(db, p).user.spentUnits, 200); assert.equal(state(db, p).global.spentUnits, 200);
  assert.equal(state(db, p).user.used, 0);
  assert.equal(state(db, p).user.recent[0].outputTokens, 200);
});

test('missing/unknown/oversized provider usage retains the maximum reservation for reconciliation', async () => {
  const db = setup(), p = await prepare(db); await preflight.authorizeCoachingDispatch(db, p, NOW);
  const unknown = measured(); delete unknown.usage.input_tokens_details.cache_write_tokens;
  for (const m of [undefined, unknown, { ...measured(), serviceTier: 'fast' }, { ...measured(), model: 'unknown' },
    measured(1001), measured(1000, 2001), { ...measured(), usage: { ...measured().usage, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 100 } } }]) {
    const before = snapshot(db);
    await assert.rejects(quota.finishCoachingQuota(db, p.reservation, { customerSuccess: false, chargedUnits: 200, measured: m }));
    assert.deepEqual(snapshot(db), before);
  }
  await assert.rejects(quota.finishCoachingQuota(db, p.reservation, { customerSuccess: false, chargedUnits: 1, measured: measured() }), code('INVALID_SETTLEMENT'));
});

test('daily success/attempt limits use Korean dates, count failures and do not reset period spend', async () => {
  for (const success of [true, false]) {
    const db = setup(), count = success ? 5 : 10; let last;
    for (let n = 1; n <= count; n++) {
      last = await prepare(db, n); await preflight.authorizeCoachingDispatch(db, last, NOW); await finish(db, last, success, 0);
    }
    await assert.rejects(prepare(db, count + 1), code(success ? 'DAILY_USER_LIMIT' : 'DAILY_ATTEMPT_LIMIT'));
    const before = state(db, last).user.spentUnits, next = NOW + 86400000;
    const p = await prepare(db, count + 2, { requestId: id(count + 2, next), now: () => next });
    assert.equal(state(db, p).user.spentUnits, before); assert.equal(state(db, p).user.days.length, 2);
    assert.equal(state(db, p).user.attempts, count + 1);
  }
});

test('unknown dispatched work closes at maximum in both personal/global ledgers, once, even after stop', async () => {
  const db = setup(), p = await prepare(db); await preflight.authorizeCoachingDispatch(db, p, NOW);
  control(db, { enabled: false });
  const options = { accounting: ACCOUNTING, requestId: id(1), lease: p.reservation.active.lease, resolution: 'close_max_cost' };
  await quota.recoverCoachingQuota(db, 'tester', options, NOW + 60000);
  assert.equal(state(db, p).user.spentUnits, 1100); assert.equal(state(db, p).global.spentUnits, 1100);
  assert.equal(state(db, p).user.used, 0);
  assert.equal(state(db, p).user.recent[0].outputTokens, null);
  const before = snapshot(db); await quota.recoverCoachingQuota(db, 'tester', options, NOW + 61000);
  assert.deepEqual(snapshot(db), before); await assert.rejects(finish(db, p));
});

test('calendar rollover cancels unstarted work and preserves dispatched cost in its original pool', async () => {
  const start = Date.parse('2026-10-31T14:59:59Z'), next = start + 2000;
  for (const dispatched of [false, true]) {
    const db = setup(), p = await prepare(db, 1, { now: () => start });
    if (dispatched) await preflight.authorizeCoachingDispatch(db, p, start);
    control(db, { period: '202611' });
    if (!dispatched) await assert.rejects(preflight.authorizeCoachingDispatch(db, p, next), code('COACHING_DISPATCH_BLOCKED'));
    else {
      await quota.recoverCoachingQuota(db, 'tester', { accounting: ACCOUNTING, requestId: id(1), lease: p.reservation.active.lease,
        resolution: 'close_max_cost' }, next + 60000);
    }
    const later = await prepare(db, 2, { now: () => next + 60000, requestId: id(2, next) });
    assert.equal(state(db, later).user.spentUnits, dispatched ? 1100 : 0);
    assert.equal(state(db, p).global.spentUnits, dispatched ? 1100 : 0);
    assert.equal(state(db, later).global.spentUnits, 0);
  }
});

test('currency ledgers cannot reuse untyped mock balances or migrate them silently', async () => {
  const db = setup(), request = preflight.buildCoachingRequest(evidence()).request;
  const r = await quota.reserveCoachingQuota(db, 'tester', id(1), 'mock-evidence', { access: testAccess(), globalMonthly: 100,
    globalUnits: 10000, unitsPerRequest: 1 }, NOW);
  const p = await prepare(db);
  assert.notEqual(p.reservation.userRef.path, r.userRef.path); assert.notEqual(p.reservation.globalRef.path, r.globalRef.path);
  assert.match(p.reservation.userRef.path, /\/usd_micro_v1_[a-f0-9]{64}$/);
  assert.notEqual(p.reservation.userRef.path, `_replay_coaching_users/${quota.hash(`${ACCOUNTING}:tester`)}`);
  const isolated = setup();
  isolated.data.set(p.reservation.userRef.path, db.data.get(r.userRef.path));
  await assert.rejects(prepare(isolated), code('QUOTA_STATE_INVALID'));
  const quote = cost.makeCostQuote(1000, request, NOW);
  await assert.rejects(quota.reserveCoachingQuota(setup(), 'tester', id(1), 'hash', { access: testAccess(), accounting: ACCOUNTING,
    globalMonthly: 100, globalUnits: 10000, userUnits: POLICY.maxUserMicros, unitsPerRequest: 1, quote }, NOW), code('COACHING_NOT_CONFIGURED'));
});

test('renewal retains prior dollar receipts and grants only the new period budget, once', async () => {
  const db = setup(), p = await prepare(db); await preflight.authorizeCoachingDispatch(db, p, NOW); await finish(db, p, false);
  const next = Date.parse('2026-11-25T00:00:00Z'); control(db, { period: '202611' });
  const access = testAccess({ id: 'nov25-dec25', startsAt: next, endsAt: Date.parse('2026-12-25T00:00:00Z'), successLimit: 50, attemptLimit: 70 });
  const options = { access, now: () => next, requestId: id(2, next) };
  const renewed = await prepare(db, 2, options);
  assert.equal(state(db, renewed).user.spentUnits, 0); assert.equal(state(db, renewed).user.previous[0].spentUnits, 200);
  await preflight.authorizeCoachingDispatch(db, renewed, next); await finish(db, renewed, true);
  const third = await prepare(db, 3, { ...options, requestId: id(3, next) });
  assert.equal(state(db, third).user.spentUnits, 200); assert.equal(state(db, third).user.attempts, 2);
  assert.equal(state(db, third).user.previous.length, 1); assert.equal(state(db, p).global.spentUnits, 200);
});
