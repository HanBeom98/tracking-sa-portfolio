import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayCoachingSession, isLocalCoachingTest } from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-session.js';
import { createMockReplayCoachingResponse } from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture } from '../fixtures/replay-context.js';
const evidence = () => analyzeReplay(contextFixture(), 'focus').coachingEvidence;
const success = body => ({ status: 200, body: { mode: 'mock', outcome: 'completed', requestId: body.requestId,
  used: 1, response: createMockReplayCoachingResponse(body.evidence) } });
function setup(send = async body => success(body)) {
  let user = { uid: 'tester', getIdToken: async () => 'token' }, serial = 0;
  const changes = [], calls = [];
  const session = createReplayCoachingSession({ getUser: () => user, now: () => Date.parse('2026-10-31T15:00:00Z'),
    uuid: () => `test_request_${String(++serial).padStart(5, '0')}`, onChange: state => changes.push(state),
    send: async (...args) => { calls.push(args); return send(...args); } });
  session.setEvidence(evidence());
  return { session, changes, calls, user: value => { user = value; session.authChanged(); } };
}
test('local opt-in requires the exact loopback origin and query; production cannot opt in', () => {
  for (const url of ['https://trackingsa.com/?coaching=mock', 'https://127.0.0.1:4173/?coaching=mock',
    'http://127.0.0.1:4173/', 'http://localhost:4173/?coaching=mock', 'http://127.0.0.1:80/?coaching=mock']) {
    assert.equal(isLocalCoachingTest(new URL(url)), false);
  }
  assert.equal(isLocalCoachingTest(new URL('http://127.0.0.1:4173/?coaching=mock')), true);
});
test('guest and insufficient evidence never send; token belongs to the signed-in user', async () => {
  const t = setup(); t.user(null); await t.session.request(); assert.equal(t.calls.length, 0);
  assert.equal(t.session.view().state, 'signed_out');
  t.user({ uid: 'tester', getIdToken: async () => 'real-browser-token' });
  const e = evidence(); t.session.setEvidence(e); e.metrics.kills = 99;
  await t.session.request(); assert.equal(t.calls[0][1], 'real-browser-token'); assert.equal(t.calls[0][0].evidence.metrics.kills, 1);
  assert.match(t.calls[0][0].requestId, /^202611-/);
  t.session.setEvidence({ metrics: null }); await t.session.request(); assert.equal(t.calls.length, 1);
});
test('unknown transport retries keep identical ID and input even across reset and logout', async () => {
  let count = 0; const t = setup(async body => { if (++count === 1) throw new Error('timeout'); return success(body); });
  await t.session.request(); assert.equal(t.session.view().state, 'unknown');
  t.session.setEvidence(null); t.user(null); t.user({ uid: 'tester', getIdToken: async () => 'new-token' });
  t.session.setEvidence(evidence()); await t.session.request();
  assert.deepEqual(t.calls[0][0], t.calls[1][0]); assert.equal(t.session.view().state, 'completed');
});
test('double click, delayed token and old response cannot overwrite another replay', async () => {
  let release; const t = setup(async body => { await new Promise(resolve => { release = resolve; }); return success(body); });
  const first = t.session.request(); await Promise.resolve(); await t.session.request(); assert.equal(t.calls.length, 1);
  t.session.setEvidence(null); assert.equal(t.calls[0][2].aborted, true); release(); await first;
  assert.equal(t.session.view().response, null); assert.equal(t.session.view().state, 'no_evidence');
  t.session.setEvidence(evidence()); assert.equal(t.session.view().state, 'unknown');
  let tokenReady; t.user({ uid: 'another', getIdToken: () => new Promise(resolve => { tokenReady = resolve; }) });
  const waiting = t.session.request(); t.user(null); tokenReady('late'); await waiting;
  assert.equal(t.calls.length, 1); assert.equal(t.session.view().state, 'signed_out');
});
test('completed duplicate preserves prior cards while a duplicate without cards explains no stored response', async () => {
  let count = 0; const t = setup(async body => ++count === 1 ? success(body)
    : { status: 200, body: { mode: 'mock', outcome: 'already_completed', requestId: body.requestId, used: 1 } });
  await t.session.request(); const response = t.session.view().response; await t.session.request();
  assert.equal(t.session.view().state, 'already_completed'); assert.equal(t.session.view().response, response);
  assert.equal(t.calls[0][0].requestId, t.calls[1][0].requestId);
  t.user({ uid: 'other', getIdToken: async () => 'other' }); assert.equal(t.session.view().response, undefined);
  await t.session.request(); assert.equal(t.session.view().state, 'already_completed'); assert.equal(t.session.view().response, undefined);
});
test('an older aborted request finishing cannot unlock a newer pending retry', async () => {
  const releases = [];
  const t = setup(body => new Promise(resolve => { releases.push(() => resolve(success(body))); }));
  const old = t.session.request(); await Promise.resolve();
  t.session.setEvidence(null); t.session.setEvidence(evidence());
  const retry = t.session.request(); await Promise.resolve();
  releases[0](); await old;
  assert.equal(t.session.view().state, 'pending'); await t.session.request(); assert.equal(t.calls.length, 2);
  releases[1](); await retry; assert.equal(t.session.view().state, 'completed');
});
for (const [status, error, state] of [[429, 'USER_LIMIT', 'blocked'], [403, 'TEST_ACCOUNT_REQUIRED', 'blocked'],
  [409, 'PREVIOUS_ATTEMPT_FAILED', 'blocked'], [409, 'ACCESS_PERIOD_CONFLICT', 'blocked'], [409, 'REQUEST_UNRESOLVED', 'unknown'], [503, 'COACHING_UNAVAILABLE', 'unknown'], [401, 'UNAUTHENTICATED', 'unknown']]) {
  test(`HTTP ${status} ${error} has no automatic retry and yields ${state}`, async () => {
    const t = setup(async () => ({ status, body: { error } })); await t.session.request();
    assert.equal(t.session.view().state, state); assert.equal(t.calls.length, 1);
    if (state === 'blocked') { await t.session.request(); assert.equal(t.calls.length, 1); }
  });
}
test('invalid envelope and ungrounded cards are withheld and retry the original ID', async () => {
  for (const mutate of [r => { r.body.mode = 'real'; }, r => { r.body.requestId = 'other'; },
    r => { r.body.response.cards[0].evidenceRefs = ['round-99']; }]) {
    const t = setup(async body => { const result = success(body); mutate(result); return result; });
    await t.session.request(); assert.equal(t.session.view().state, 'unknown'); assert.equal(t.session.view().response, undefined);
    assert.equal(t.session.view().error, 'INVALID_RESPONSE'); await t.session.request();
    assert.equal(t.calls[0][0].requestId, t.calls[1][0].requestId);
  }
});
test('page memory retains 70-attempt histories across three periods and never evicts ambiguous request IDs to make room', async () => {
  let count = 0;
  const t = setup(async body => { if (++count === 1) throw new Error('lost'); return success(body); });
  for (let n = 0; n < 210; n++) {
    const e = evidence(); e.limitations = [`fixture-${n}`]; t.session.setEvidence(e); await t.session.request();
  }
  assert.equal(t.calls.length, 210);
  const extra = evidence(); extra.limitations = ['one-too-many']; t.session.setEvidence(extra); await t.session.request();
  assert.equal(t.session.view().state, 'session_limit'); assert.equal(t.calls.length, 210);
  const original = evidence(); original.limitations = ['fixture-0']; t.session.setEvidence(original);
  assert.equal(t.session.view().state, 'unknown'); await t.session.request();
  assert.equal(t.calls.length, 211); assert.deepEqual(t.calls[0][0], t.calls[210][0]);
});
