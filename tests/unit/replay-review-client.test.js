import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalReplayReviewClient } from '../../src/domains/stats/sudden-attack/replay/infra/replay-review-client.js';
import { createReplayReviewApiSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-review-api-session.js';
import { isLocalReviewApi } from '../../src/domains/stats/sudden-attack/replay/ui/replay-review-api.js';
import service from '../../cloud-functions/replay-coaching-review-service.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import catalog from '../../cloud-functions/replay-coaching-review-catalog.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingReview } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import { contextFixture } from '../fixtures/replay-context.js';
import { coachingMemoryDb } from '../helpers/coaching-memory-db.js';
import { seedCreditFixture } from '../helpers/coaching-credit-fixture.js';
import { openAIEnvelope } from '../helpers/coaching-openai-fixture.js';
const ORIGIN = 'http://127.0.0.1:4173', NOW = Date.parse('2026-10-26T00:00:00Z');
const evidence = player => buildReplayCoachingReview(analyzeReplay(contextFixture(), player || 'focus'));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function setup() {
  const db = coachingMemoryDb(), calls = [], records = new Map();
  let tokens = 0, generations = 0, counter = 0;
  const alice = { uid: 'alice', getIdToken: async () => 'alice' }, bob = { uid: 'bob', getIdToken: async () => 'bob' };
  const state = { user: alice };
  for (const uid of ['alice', 'bob']) seedCreditFixture(db, uid);
  db.data.set(cost.controlRef(db).path, { schemaVersion: 1, enabled: true, period: '202610', allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  const options = { db, enabled: true, now: () => NOW,
    verifyToken: async token => { if (!['alice', 'bob'].includes(token)) throw Error(); return { uid: token }; },
    config: { userMicros: cost.POLICY.maxUserMicros, globalMonthly: 100 },
    countTokens: async () => { tokens++; return 1000; }, generate: async (request, quote) => {
      generations++; const f = catalog.createReviewCatalog(evidence()).facts[0];
      return openAIEnvelope(quote, { schemaVersion: 2, cards: [{ kind: 'practice', factId: f.id, questionId: f.questions[0], practiceId: f.practices[0] }] });
    } };
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = { status: 200, body: null }, res = { set: () => res, status: value => { r.status = value; return res; }, json: value => { r.body = value; return res; } };
    await service.createReplayReviewHandler(options)({ method: init.method,
      headers: { origin: 'https://trackingsa.com', authorization: init.headers.Authorization, 'content-type': init.headers['Content-Type'] }, rawBody: Buffer.from(init.body) }, res);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };
  const send = createLocalReplayReviewClient({ origin: ORIGIN, fetchImpl });
  const session = (extra = {}, review = evidence()) => createReplayReviewApiSession(review, { getUser: () => state.user, send, records,
    uuid: () => `client_test_${String(++counter).padStart(6, '0')}`, now: () => NOW, ...extra });
  return { db, calls, records, alice, bob, state, options, send, session, counts: () => ({ tokens, generations }) };
}

test('HTTP transport is fixed to explicit loopback; rejects production, external and query-selected endpoints before fetch', async () => {
  let calls = 0;
  for (const origin of [undefined, 'https://trackingsa.com', 'https://attacker.test', 'http://localhost:4173', ORIGIN + '/evil']) {
    await assert.rejects(createLocalReplayReviewClient({ origin, fetchImpl: async () => { calls++; } })({}, 'token'), /DISABLED/);
  }
  assert.equal(calls, 0);
  for (const origin of ['https://trackingsa.com', 'https://attacker.test']) assert.equal(isLocalReviewApi({ origin, search: '?coaching=review&transport=api' }), false);
  assert.equal(isLocalReviewApi({ origin: ORIGIN, search: '?coaching=review&transport=api' }), true);
  assert.equal(isLocalReviewApi({ origin: ORIGIN, search: '?coaching=review' }), false);
});

test('client-to-real-handler chain uses token UID and bounded view only; duplicate result reads never count or generate', async () => {
  const s = setup(), session = s.session(); await session.request();
  assert.equal(session.view().state, 'ready'); assert.equal(session.view().credits.remaining, 1);
  assert.equal(s.calls.length, 1); const { url, init, body } = s.calls[0];
  assert.equal(url, ORIGIN + '/api/replay-coaching-review');
  assert.deepEqual(Object.keys(body), ['action', 'requestId', 'evidence']);
  assert.doesNotMatch(init.body, /nexonSN|nickName|nickname|coordinate|providerResponseId|subscription|"uid"/);
  for (const [key, value] of Object.entries({ credentials: 'omit', cache: 'no-store', redirect: 'error', mode: 'same-origin', referrerPolicy: 'no-referrer' })) assert.equal(init[key], value);
  assert.equal(init.headers.Authorization, 'Bearer alice');
  await session.request(); assert.equal(s.calls.length, 1);
  const before = structuredClone([...s.db.data]); await session.request('result');
  assert.equal(s.calls[1].body.action, 'result'); assert.equal(s.calls[1].body.requestId, body.requestId);
  assert.equal(session.view().state, 'ready'); assert.deepEqual(s.counts(), { tokens: 1, generations: 1 });
  assert.deepEqual([...s.db.data], before);
});

test('lost acknowledgement keeps the request ID across remounts and result miss never falls back to generate', async () => {
  const s = setup(); let lost = true;
  const session = s.session({ send: async (...args) => { const result = await s.send(...args); if (lost) { lost = false; throw Error('private transport'); } return result; } });
  await session.request(); assert.equal(session.view().state, 'unknown'); assert.equal(session.view().canGenerate, false);
  session.dispose(); const remount = s.session(); assert.equal(remount.view().state, 'recoverable');
  await remount.request(); assert.equal(s.calls.length, 1);
  await remount.request('result'); assert.equal(remount.view().state, 'ready'); assert.equal(s.calls[1].body.action, 'result');
  assert.deepEqual(s.counts(), { tokens: 1, generations: 1 });
  const t = setup(), notFound = t.session({ send: async () => { throw Error(); } });
  await notFound.request(); const next = t.session(); await next.request('result');
  assert.equal(next.view().state, 'not_found'); assert.deepEqual(t.counts(), { tokens: 0, generations: 0 });
  assert.equal(t.calls[0].body.action, 'result'); await next.request(); assert.equal(t.calls.length, 1);
});

test('concurrent clicks and mounts, including token delay, never start a second generation for the same account/evidence', async () => {
  const s = setup(), waiting = deferred(); s.alice.getIdToken = () => waiting.promise;
  const a = s.session(), b = s.session(), p = a.request(), q = b.request();
  await a.request(); assert.equal(s.calls.length, 0); waiting.resolve('alice'); await Promise.all([p, q]);
  assert.equal(s.calls.filter(c => c.body.action === 'generate').length, 1);
  assert.ok(s.calls.every(c => c.body.requestId === s.calls[0].body.requestId)); assert.equal(s.counts().generations, 1);
});

test('logout or account replacement while token is resolving sends nothing and never publishes previous account cards', async () => {
  const s = setup(), waiting = deferred(); s.alice.getIdToken = () => waiting.promise;
  const session = s.session(), pending = session.request(); s.state.user = s.bob; session.authChanged(); waiting.resolve('alice'); await pending;
  assert.equal(s.calls.length, 0); assert.equal(session.view().response, null);
  const t = setup(), current = t.session(); await current.request(); assert.ok(current.view().response);
  t.state.user = null; assert.equal(current.view().response, null); current.authChanged();
  assert.equal(current.view().state, 'signed_out'); t.state.user = t.bob; current.authChanged(); assert.equal(current.view().state, 'idle');
  await current.request('result'); assert.equal(t.calls.length, 1);
  t.state.user = t.alice; current.authChanged(); assert.equal(current.view().state, 'recoverable');
});

test('context disposal or logout during fetch discards late cards; completed server work remains recoverable', async () => {
  const s = setup(), waiting = deferred(), states = [];
  const session = s.session({ onChange: v => states.push(v.state), send: async (...args) => { const value = await s.send(...args); await waiting.promise; return value; } });
  const pending = session.request(); while (!s.counts().generations) await new Promise(r => setImmediate(r));
  session.dispose(); waiting.resolve(); await pending; assert.deepEqual(states, ['pending']);
  const again = s.session(); await again.request('result'); assert.equal(again.view().state, 'ready'); assert.equal(s.counts().generations, 1);
  const t = setup(), delayed = deferred();
  const current = t.session({ send: async (...args) => { const result = await t.send(...args); await delayed.promise; return result; } });
  const inflight = current.request(); while (!t.counts().generations) await new Promise(r => setImmediate(r));
  t.state.user = t.bob; current.authChanged(); delayed.resolve(); await inflight;
  assert.equal(current.view().response, null); assert.equal(current.view().state, 'idle');
});

test('purchased credit, limit and disabled errors stay explicit; bodies never control generated UI text', async () => {
  for (const [status, error, expected] of [[401, 'UNAUTHENTICATED', 'auth_required'], [403, 'AI_CREDITS_REQUIRED', 'credits_required'],
    [429, 'USER_LIMIT', 'limit'], [409, 'REQUEST_IN_PROGRESS', 'processing'], [503, 'COACHING_DISABLED', 'disabled'], [500, '<script>private</script>', 'unknown']]) {
    const s = setup(), session = s.session({ send: async () => ({ status, body: { error } }) });
    await session.request(); assert.equal(session.view().state, expected); assert.equal(session.view().response, null);
    assert.equal(session.view().canGenerate, [401, 403, 429, 503].includes(status)); assert.equal(session.view().canLookup, true);
  }
  const s = setup(); s.db.data.delete(credits.walletRef(s.db, 'alice').path); s.db.data.get('users/alice').subscription = { status: 'active' };
  const session = s.session(); await session.request(); assert.equal(session.view().state, 'credits_required');
  assert.deepEqual(s.counts(), { tokens: 0, generations: 0 });
});

test('wrong request, unrelated evidence, unexpected/internal keys and malformed results never display cards', async () => {
  for (const mutate of [v => { v.requestId = 'other'; }, v => { v.result.evidenceHash = '0'.repeat(64); }, v => { v.extra = 'private'; },
    v => { v.credits.remaining = 10001; }, v => { v.result.response.cards = []; }, v => { v.result.mode = 'mock'; }, v => { v.result.response.cards[0].evidenceRefs = ['round-64']; }]) {
    const s = setup(), session = s.session({ send: async (...args) => { const result = await s.send(...args); mutate(result.body); return result; } });
    await session.request(); assert.equal(session.view().state, 'unknown'); assert.equal(session.view().response, null); assert.equal(s.calls.length, 1);
  }
});

test('transport enforces declared and streamed byte limits, JSON/UTF8, no redirect and no retry', async () => {
  for (const response of [new Response('x', { headers: { 'content-type': 'text/html' } }),
    new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '12289' } }),
    new Response('x'.repeat(12289), { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }),
    new Response('{', { headers: { 'content-type': 'application/json' } })]) {
    let calls = 0; const send = createLocalReplayReviewClient({ origin: ORIGIN, fetchImpl: async () => { calls++; return response; } });
    await assert.rejects(send({}, 'token'), /UNKNOWN/); assert.equal(calls, 1);
  }
  let calls = 0; const send = createLocalReplayReviewClient({ origin: ORIGIN, fetchImpl: async () => { calls++; throw Error('private'); } });
  await assert.rejects(send({}, 'bad token'), /UNAUTHENTICATED/);
  await assert.rejects(send({ raw: '가'.repeat(9000) }, 'token'), /TOO_LARGE/); assert.equal(calls, 0);
});

test('token errors reserve no ID and can be retried manually; memory cap, month boundary and signed-out gate are bounded', async () => {
  const s = setup(), session = s.session(); s.alice.getIdToken = async () => { throw Error('secret'); };
  await session.request(); assert.equal(session.view().state, 'auth_required'); assert.equal(session.view().canGenerate, true); assert.equal(s.records.size, 0);
  s.alice.getIdToken = async () => 'alice'; await session.request(); assert.equal(session.view().state, 'ready');
  const t = setup(); t.state.user = null; await t.session().request(); assert.equal(t.calls.length, 0);
  for (let i = 0; i < 210; i++) t.records.set(String(i), { requestId: 'old' });
  t.state.user = t.alice; assert.equal(t.session().view().state, 'session_limit'); await t.session().request(); assert.equal(t.calls.length, 0);
  const u = setup(), boundary = u.session({ now: () => Date.parse('2026-10-31T15:00:00Z') }); await boundary.request();
  assert.match(u.calls[0].body.requestId, /^202611-/);
});
