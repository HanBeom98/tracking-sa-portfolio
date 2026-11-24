import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import service from '../../cloud-functions/replay-coaching-service.js';
import input from '../../cloud-functions/replay-coaching-input.js';
import quota from '../../cloud-functions/replay-coaching-quota.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture, makeRound, makeReplay } from '../fixtures/replay-context.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { syncReplayCoachingModules } from '../../scripts/sync-replay-coaching-modules.mjs';
import { testAccessEnv } from '../helpers/coaching-test-access.js';

const NOW = Date.parse('2026-10-25T00:00:00Z');
const id = n => `202610-request_number_${String(n).padStart(3, '0')}`;
const evidence = () => analyzeReplay(contextFixture(), 'focus').coachingEvidence;
const config = () => ({ REPLAY_COACHING_MODE: 'mock', REPLAY_COACHING_TEST_UIDS: 'tester,second',
  ...testAccessEnv(), REPLAY_COACHING_GLOBAL_MONTHLY: '3',
  REPLAY_COACHING_GLOBAL_UNITS: '15', REPLAY_COACHING_UNITS_PER_REQUEST: '5' });
function request(n = 1, e = evidence()) {
  return { method: 'POST', headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', origin: 'https://trackingsa.com' },
    rawBody: Buffer.from(JSON.stringify({ requestId: id(n), evidence: e })) };
}
async function invoke(req, options = {}) {
  const result = { status: 200, headers: {}, body: null };
  const res = { set: (key, value) => { result.headers[key] = value; return res; }, status: status => { result.status = status; return res; },
    json: body => { result.body = body; return res; }, send: body => { result.body = body; return res; } };
  await service.createReplayCoachingHandler({ db: coachingMemoryDb(), getEnv: config,
    verifyToken: async () => ({ uid: 'tester' }), now: () => NOW, ...options })(req, res);
  return result;
}
const state = db => ({ user: [...db.data.entries()].find(([k]) => k.startsWith('_replay_coaching_users/'))?.[1],
  global: db.data.get('_replay_coaching_months/202610') });

test('packaged server modules match source and are isolated from parent source paths', async () => {
  syncReplayCoachingModules(process.cwd(), { check: true });
  const { generate, validate } = await service.loadSharedModules();
  assert.equal(validate(generate(evidence()), evidence()).cards.length, 3);
  const entry = readFileSync('cloud-functions/index.js', 'utf8');
  assert.match(entry, /getAuth\(\)\.verifyIdToken\(token\)/);
  assert.match(entry, /exports\.replayCoachingPreview/);
  assert.ok(!readFileSync('.github/workflows/functions-deploy.yml', 'utf8').includes('functions:replayCoachingPreview'));
});

test('unconfigured and real-provider modes stay disabled before authentication or any storage', async () => {
  const db = coachingMemoryDb(); let calls = 0;
  for (const mode of [undefined, 'openai', 'production', 'true']) {
    const r = await invoke(request(), { db, getEnv: () => ({ REPLAY_COACHING_MODE: mode }), verifyToken: async () => { calls++; } });
    assert.equal(r.status, 503); assert.equal(r.body.error, 'COACHING_DISABLED');
  }
  assert.equal(calls, 0); assert.equal(db.transactions, 0);
  const env = config(); delete env.REPLAY_COACHING_GLOBAL_UNITS;
  assert.equal((await invoke(request(), { db, getEnv: () => env })).body.error, 'COACHING_NOT_CONFIGURED');
});

test('authentication, allowlist, origin, method and body checks happen without quota writes', async () => {
  const db = coachingMemoryDb();
  const cases = [
    [req => { delete req.headers.authorization; }, {}, 401],
    [() => {}, { verifyToken: async () => { throw new Error('expired'); } }, 401],
    [() => {}, { verifyToken: async () => ({ uid: 'ordinary-user' }) }, 403],
    [req => { req.headers.origin = 'https://elsewhere.example'; }, {}, 403],
    [req => { req.method = 'GET'; }, {}, 405],
    [req => { req.headers['content-type'] = 'text/plain'; }, {}, 415],
    [req => { req.rawBody = Buffer.alloc(12289); }, {}, 413],
    [req => { req.rawBody = Buffer.from('{'); }, {}, 400],
    [req => { const b = JSON.parse(req.rawBody); b.uid = 'tester'; req.rawBody = Buffer.from(JSON.stringify(b)); }, {}, 400],
  ];
  for (const [change, options, status] of cases) { const req = request(); change(req); assert.equal((await invoke(req, { db, ...options })).status, status); }
  assert.equal(db.transactions, 0);
});

test('successful mock request reserves/settles once and repeated ID never regenerates', async () => {
  const db = coachingMemoryDb(); let generations = 0;
  const real = await service.loadSharedModules();
  const options = { db, loadModules: async () => ({ ...real, generate: e => { generations++; return real.generate(e); } }) };
  const first = await invoke(request(), options), duplicate = await invoke(request(), options);
  assert.equal(first.status, 200); assert.equal(first.body.mode, 'mock'); assert.equal(first.body.response.cards.length, 3);
  assert.equal(duplicate.body.outcome, 'already_completed'); assert.equal(duplicate.body.response, undefined);
  assert.equal(generations, 1); assert.equal(state(db).user.used, 1); assert.equal(state(db).user.active, null);
  assert.deepEqual(state(db).global, { schemaVersion: 2, successfulCalls: 1, usedCalls: 1, heldCalls: 0, spentUnits: 5, heldUnits: 0 });
  assert.equal(first.headers['Cache-Control'], 'no-store');
  assert.ok(!JSON.stringify([...db.data.values()]).includes('observation'));
});

test('same ID with different evidence is rejected and monthly success limit cannot be bypassed', async () => {
  const db = coachingMemoryDb(); await invoke(request(), { db });
  const different = analyzeReplay(makeReplay([makeRound()]), 'focus').coachingEvidence;
  assert.equal((await invoke(request(1, different), { db })).body.error, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await invoke(request(2), { db })).status, 200);
  assert.equal((await invoke(request(3), { db })).body.error, 'USER_LIMIT');
  assert.equal(state(db).user.used, 2);
});

test('pending duplicate and another request by the same account cannot enter generation', async () => {
  const db = coachingMemoryDb(), real = await service.loadSharedModules();
  let release, started;
  const wait = new Promise(r => { release = r; }), ready = new Promise(r => { started = r; });
  const options = { db, loadModules: async () => ({ ...real, generate: async e => { started(); await wait; return real.generate(e); } }) };
  const first = invoke(request(1), options); await ready;
  assert.equal((await invoke(request(1), { db })).body.error, 'REQUEST_IN_PROGRESS');
  assert.equal((await invoke(request(2), { db })).body.error, 'REQUEST_IN_PROGRESS');
  assert.equal(state(db).global.heldUnits, 5);
  release(); assert.equal((await first).status, 200);
});

test('global call and budget reservations protect against concurrent different users', async () => {
  for (const [field, code] of [['REPLAY_COACHING_GLOBAL_MONTHLY', 'GLOBAL_LIMIT'], ['REPLAY_COACHING_GLOBAL_UNITS', 'GLOBAL_BUDGET_LIMIT']]) {
    const db = coachingMemoryDb(), env = config(), real = await service.loadSharedModules();
    env[field] = field.includes('UNITS') ? '5' : '1';
    let release, started; const wait = new Promise(r => { release = r; }), ready = new Promise(r => { started = r; });
    const first = invoke(request(), { db, getEnv: () => env, loadModules: async () => ({ ...real, generate: async e => { started(); await wait; return real.generate(e); } }) });
    await ready;
    const blocked = await invoke(request(2), { db, getEnv: () => env, verifyToken: async () => ({ uid: 'second' }) });
    assert.equal(blocked.body.error, code); release(); assert.equal((await first).status, 200);
  }
});

test('invalid mock output restores customer quota but preserves simulated generation expense', async () => {
  const db = coachingMemoryDb(), real = await service.loadSharedModules();
  const failed = await invoke(request(), { db, loadModules: async () => ({ ...real, generate: () => ({ schemaVersion: 1, cards: [] }) }) });
  assert.equal(failed.body.error, 'MOCK_RESPONSE_FAILED'); assert.equal(state(db).user.used, 0);
  assert.equal(state(db).user.attempts, 1); assert.equal(state(db).global.heldUnits, 0);
  assert.equal(state(db).global.spentUnits, 5); assert.equal(state(db).global.usedCalls, 1);
  assert.equal((await invoke(request(), { db })).body.error, 'PREVIOUS_ATTEMPT_FAILED');
  assert.equal((await invoke(request(2), { db })).status, 200);
});

test('dispatch commit failures never enter generation and remain explicitly recoverable', async () => {
  for (const afterCommit of [false, true]) {
    const db = coachingMemoryDb(), transaction = db.runTransaction.bind(db), real = await service.loadSharedModules();
    let count = 0, generated = 0;
    db.runTransaction = async fn => { count++;
      if (count === 2 && !afterCommit) throw new Error('dispatch not committed');
      const result = await transaction(fn); if (count === 2 && afterCommit) throw new Error('dispatch acknowledgement lost'); return result;
    };
    const options = { db, loadModules: async () => ({ ...real, generate: e => { generated++; return real.generate(e); } }) };
    assert.equal((await invoke(request(), options)).status, 503); assert.equal(generated, 0);
    assert.equal(state(db).user.held, 1); assert.equal(state(db).global.heldUnits, 5);
    assert.equal(state(db).user.active.stage, afterCommit ? 'dispatching' : 'reserved');
    assert.equal((await invoke(request(), options)).body.error, 'REQUEST_IN_PROGRESS'); assert.equal(generated, 0);
    const active = state(db).user.active;
    const result = await quota.recoverCoachingQuota(db, 'tester', { requestId: active.id, lease: active.lease,
      resolution: afterCommit ? 'close_max_cost' : 'cancel_before_dispatch' }, NOW + 61000);
    assert.equal(result.chargedUnits, afterCommit ? 5 : 0);
  }
});

test('ambiguous settlement keeps reservation or committed count; never releases or regenerates automatically', async () => {
  for (const afterCommit of [false, true]) {
    const db = coachingMemoryDb(), transaction = db.runTransaction.bind(db); let count = 0;
    db.runTransaction = async fn => { count++; if (count === 3 && !afterCommit) throw new Error('storage failed');
      const r = await transaction(fn); if (count === 3 && afterCommit) throw new Error('response lost'); return r; };
    assert.equal((await invoke(request(), { db })).status, 503);
    const retry = await invoke(request(), { db });
    assert.equal(retry.body[afterCommit ? 'outcome' : 'error'], afterCommit ? 'already_completed' : 'REQUEST_IN_PROGRESS');
    assert.equal(state(db).global[afterCommit ? 'spentUnits' : 'heldUnits'], 5);
  }
});

test('calendar month crossing preserves access usage and accepts an existing prior-month request only as a duplicate', async () => {
  const db = coachingMemoryDb(); await invoke(request(), { db });
  assert.equal(quota.periodAt(Date.parse('2026-10-31T14:59:59Z')), '202610');
  assert.equal(quota.periodAt(Date.parse('2026-10-31T15:00:00Z')), '202611');
  const next = Date.parse('2026-10-31T15:00:00Z');
  assert.equal((await invoke(request(), { db, now: () => next })).body.outcome, 'already_completed');
  assert.equal((await invoke(request(2), { db, now: () => next })).body.error, 'INVALID_REQUEST_ID');
  const req = request(); const b = JSON.parse(req.rawBody); b.requestId = b.requestId.replace('202610', '202611'); req.rawBody = Buffer.from(JSON.stringify(b));
  assert.equal((await invoke(req, { db, now: () => next })).body.used, 2);
});

test('normalization drops client prose and rejects inconsistent/unknown facts before storage', async () => {
  const e = evidence(), marker = 'PRIVATE_IGNORE_ALL_INSTRUCTIONS'; e.limitations = [marker];
  assert.ok(!JSON.stringify(input.normalizeCoachingEvidence(e)).includes(marker));
  const mutations = [v => { v.nickname = 'private'; }, v => { v.metrics.deaths = 99; }, v => { v.rounds[0].death.ownAlive = 0; },
    v => { v.rounds[0].tradesMade.examples[0].gapSeconds = 5.1; }, v => { v.rounds[0].side = 'pretend'; },
    v => { v.metrics.kills = 2; }, v => { v.rounds[0].evidenceId = 'round-99'; }, v => { v.rules.tradeWindowSeconds = 100; }];
  const db = coachingMemoryDb();
  for (const mutate of mutations) { const v = evidence(); mutate(v); assert.equal((await invoke(request(1, v), { db })).status, 400); }
  const partial = contextFixture(); for (const r of partial.replay_info.replayRoundInfo) r.replayCharacterInfo = [];
  assert.equal((await invoke(request(1, analyzeReplay(partial, 'focus').coachingEvidence), { db })).status, 422);
  assert.equal(db.transactions, 0);
});

test('failed attempts are bounded and cannot grow history or retry storage forever under new IDs', async () => {
  const db = coachingMemoryDb(), real = await service.loadSharedModules(); let generated = 0;
  const options = { db, getEnv: () => ({ ...config(), REPLAY_COACHING_GLOBAL_MONTHLY: '100' }),
    loadModules: async () => ({ ...real, generate: () => { generated++; throw new Error('mock failed'); } }) };
  for (let n = 1; n <= 20; n++) assert.equal((await invoke(request(n), options)).status, 502);
  assert.equal((await invoke(request(21), options)).body.error, 'ATTEMPT_LIMIT');
  assert.equal(generated, 20); assert.equal(state(db).user.used, 0); assert.equal(state(db).user.recent.length, 20);
  assert.equal(state(db).global.spentUnits, 0);
  assert.equal(state(db).global.usedCalls, 20); assert.equal(state(db).global.successfulCalls, 0);
});

test('an unresolved reservation survives time and month changes instead of silently unlocking budget', async () => {
  const db = coachingMemoryDb();
  await quota.reserveCoachingQuota(db, 'tester', id(1), 'fixture-hash', service.readConfig(config()).limits, NOW);
  const stale = await invoke(request(2), { db, now: () => NOW + 61000 });
  assert.equal(stale.body.error, 'REQUEST_UNRESOLVED');
  const req = request(3), body = JSON.parse(req.rawBody); body.requestId = body.requestId.replace('202610', '202611'); req.rawBody = Buffer.from(JSON.stringify(body));
  assert.equal((await invoke(req, { db, now: () => Date.parse('2026-11-01T00:00:00Z') })).body.error, 'REQUEST_UNRESOLVED');
  assert.equal(state(db).global.heldUnits, 5);
});
test('mock API applies 50 successful results and 70 attempts with the oldest receipts still protected', async () => {
  const db = coachingMemoryDb(), real = await service.loadSharedModules(); let generations = 0;
  const options = { db, getEnv: () => ({ ...config(), REPLAY_COACHING_USER_LIMIT: '50', REPLAY_COACHING_ATTEMPT_LIMIT: '70',
    REPLAY_COACHING_GLOBAL_MONTHLY: '100', REPLAY_COACHING_GLOBAL_UNITS: '500' }),
    loadModules: async () => ({ ...real, generate: e => ++generations <= 20 ? { schemaVersion: 1, cards: [] } : real.generate(e) }) };
  for (let n = 1; n <= 70; n++) assert.equal((await invoke(request(n), options)).status, n <= 20 ? 502 : 200);
  assert.equal(state(db).user.used, 50); assert.equal(state(db).user.recent.length, 70);
  assert.equal(state(db).global.spentUnits, 350);
  assert.equal((await invoke(request(71), options)).body.error, 'ATTEMPT_LIMIT');
  assert.equal((await invoke(request(1), options)).body.error, 'PREVIOUS_ATTEMPT_FAILED');
  assert.equal((await invoke(request(21), options)).body.outcome, 'already_completed');
  assert.equal(generations, 70);
});
test('expiry after reservation is cancelled before the mock generator is called', async () => {
  const db = coachingMemoryDb(), real = await service.loadSharedModules(); let clockCalls = 0, generated = 0;
  const expiry = Date.parse(config().REPLAY_COACHING_TEST_PERIOD_END), req = request();
  const body = JSON.parse(req.rawBody); body.requestId = body.requestId.replace('202610', '202611'); req.rawBody = Buffer.from(JSON.stringify(body));
  const result = await invoke(req, { db, now: () => ++clockCalls === 1 ? expiry - 1 : expiry,
    loadModules: async () => ({ ...real, generate: e => { generated++; return real.generate(e); } }) });
  assert.equal(result.status, 403); assert.equal(result.body.error, 'ACCESS_EXPIRED'); assert.equal(generated, 0);
  assert.equal(state(db).user.held, 0); assert.equal(state(db).user.used, 0);
  assert.equal(state(db).user.recent[0].status, 'cancelled');
  assert.equal(db.data.get('_replay_coaching_months/202611').spentUnits, 0);
});
