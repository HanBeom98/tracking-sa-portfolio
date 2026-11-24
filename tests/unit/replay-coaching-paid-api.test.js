import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import service from '../../cloud-functions/replay-coaching-review-service.js';
import credits from '../../cloud-functions/replay-coaching-credits.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import { creditRuntime } from '../helpers/coaching-credit-fixture.js';
import { validateReplayReviewEnvelope } from '../../src/domains/stats/sudden-attack/replay/domain/replay-review-response.js';
const id = n => `202610-credit_api_request_${String(n).padStart(4, '0')}`;
const req = (s, n = 1, action = 'generate', extra = {}) => ({ method: 'POST', headers: { origin: 'https://trackingsa.com', authorization: 'Bearer alice', 'content-type': 'application/json' }, rawBody: Buffer.from(JSON.stringify({ action, requestId: id(n), evidence: s.evidence, ...extra })) });
async function invoke(request, options) {
  const result = { status: 200, body: null, headers: {} }, res = { set: (k, v) => { result.headers[k] = v; return res; }, status: n => { result.status = n; return res; }, json: v => { result.body = v; return res; }, send: () => res };
  await service.createReplayReviewHandler(options)(request, res); return result;
}

test('credit review stays disabled and excluded from deployment; no provider/auth/DB work by default', async () => {
  const s = creditRuntime(); for (const enabled of [undefined, false, 'true', 1]) assert.equal((await invoke(req(s), { ...s.options, enabled })).body.error, 'COACHING_DISABLED');
  assert.equal(s.db.transactions, 0); assert.deepEqual(s.calls, { tokens: 0, generate: 0, auth: 0 });
  assert.match(readFileSync('cloud-functions/index.js', 'utf8'), /verifyIdToken\(token, true\)/);
  assert.ok(!readFileSync('.github/workflows/functions-deploy.yml', 'utf8').includes('functions:replayCoachingReview'));
});

test('HTTP rejects invalid identity/body and client credit/order/price/role injections before DB', async () => {
  const s = creditRuntime();
  for (const extra of [{ uid: 'bob' }, { credits: 50 }, { orderId: 'fake' }, { amountKRW: 3300 }, { subscription: { status: 'active' } }, { role: 'admin' }, { response: {} }, { action: 'purchase' }]) assert.equal((await invoke(req(s, 1, 'generate', extra), s.options)).status, 400);
  for (const mutate of [r => { r.headers.origin = 'https://evil.test'; }, r => { delete r.headers.authorization; }, r => { r.headers.authorization = 'Bearer invalid'; },
    r => { r.method = 'GET'; }, r => { r.headers['content-type'] = 'text/plain'; }, r => { r.rawBody = Buffer.alloc(24577); }, r => { r.rawBody = Buffer.from([255]); }]) {
    const r = req(s); mutate(r); assert.notEqual((await invoke(r, s.options)).status, 200);
  }
  assert.equal(s.db.transactions, 0); assert.equal(s.calls.generate, 0);
});

test('only a server-funded private wallet authorizes; generic subscriptions and former monthly grants do not', async () => {
  for (const subscription of [{ status: 'active' }, { status: 'active', replayCoaching: { schemaVersion: 1, product: 'replay_ai_monthly_v1', billingState: 'paid', status: 'active' } }]) {
    const s = creditRuntime(); s.db.data.delete(credits.walletRef(s.db, 'alice').path); s.db.data.set('users/alice', { uid: 'alice', role: 'admin', subscription });
    assert.equal((await invoke(req(s), s.options)).body.error, 'AI_CREDITS_REQUIRED'); assert.equal(s.calls.tokens, 0);
  }
  const s = creditRuntime(); s.wallet().ownerHash = credits.owner('bob'); assert.equal((await invoke(req(s), s.options)).body.error, 'CREDIT_STATE_INVALID');
  assert.equal(s.calls.generate, 0);
});

test('success consumes one purchased unit atomically and duplicate/result read adds zero generation or writes', async () => {
  const s = creditRuntime(); let reads = 0, writes = 0; const transaction = s.db.runTransaction.bind(s.db);
  s.db.runTransaction = fn => transaction(tx => fn({ get: ref => { reads++; return tx.get(ref); }, set: (...args) => { writes++; return tx.set(...args); } }));
  const first = await invoke(req(s), s.options); assert.equal(first.status, 200); assert.deepEqual(first.body.credits, { remaining: 1, held: 0 });
  assert.deepEqual(await validateReplayReviewEnvelope(first.body.result, s.evidence), first.body.result.response);
  assert.doesNotMatch(JSON.stringify(first.body), /providerResponseId|factId|quote|spentUnits|nexonSN|paymentHash|ownerHash/);
  assert.equal(reads, 22); assert.equal(writes, 12);
  const before = structuredClone([...s.db.data]); const duplicate = await invoke(req(s), s.options); assert.equal(duplicate.body.outcome, 'already_completed');
  assert.deepEqual(duplicate.body.result, first.body.result); assert.deepEqual([...s.db.data], before); assert.equal(s.calls.generate, 1); assert.equal(s.calls.tokens, 1);
  assert.equal(reads, 27); assert.equal(writes, 12);
  assert.equal((await invoke(req(s, 1, 'result'), s.options)).status, 200); assert.equal(reads, 29); assert.equal(writes, 12);
  assert.equal(s.wallet().used, 1); assert.equal(s.wallet().active, null); assert.equal(s.global().spentUnits, 200); assert.equal(first.headers['Cache-Control'], 'no-store');
});

test('owner-scoped results survive exhausted credits, expiry and generation stop; misses never generate', async () => {
  const s = creditRuntime({ quantity: 1 }); const first = await invoke(req(s), s.options); assert.equal(first.status, 200); assert.equal(s.wallet().available, 0);
  const other = req(s, 1, 'result'); other.headers.authorization = 'Bearer bob'; assert.equal((await invoke(other, s.options)).status, 404);
  assert.equal((await invoke(req(s, 8, 'result'), s.options)).status, 404);
  s.db.data.get(cost.controlRef(s.db).path).enabled = false; s.wallet().status = 'blocked';
  const result = await invoke(req(s, 1, 'result'), { ...s.options, generate: undefined, countTokens: undefined, config: undefined });
  assert.equal(result.status, 200); assert.deepEqual(result.body.result, first.body.result); assert.equal(s.calls.generate, 1);
  const changed = structuredClone(s.evidence); changed.candidates[0].flow.outcome.result = 'other';
  assert.equal((await invoke(req(s, 1, 'result', { evidence: changed }), s.options)).status, 400);
});

test('exhausted/expired/frozen tickets, token ceiling and budget reject fresh generation without removing purchased units', async () => {
  for (const mode of ['expired', 'frozen', 'tokens', 'budget']) {
    const s = creditRuntime({ expiresAt: Date.parse('2026-10-27T00:00:00Z') });
    if (mode === 'expired') s.clock.value += 86400000;
    if (mode === 'frozen') s.wallet().status = 'blocked';
    if (mode === 'tokens') s.options.countTokens = async () => 6001;
    if (mode === 'budget') s.options.config.userMicros = 1;
    assert.notEqual((await invoke(req(s), s.options)).status, 200); assert.equal(s.calls.generate, 0); assert.equal(s.wallet().available, 2);
  }
  const s = creditRuntime(); await invoke(req(s), s.options); await invoke(req(s, 2), s.options);
  assert.equal((await invoke(req(s, 3), s.options)).body.error, 'CREDITS_EXHAUSTED'); assert.equal(s.calls.tokens, 2); assert.equal(s.wallet().used, 2);
});

test('wallet block during counting stops reservation and block after reserve cancels both holds at zero expense', async () => {
  const s = creditRuntime(); s.options.countTokens = async () => { s.wallet().status = 'blocked'; return 1000; };
  assert.equal((await invoke(req(s), s.options)).body.error, 'CREDIT_ACCOUNT_BLOCKED'); assert.equal(s.calls.generate, 0); assert.equal(s.wallet().held, 0); assert.equal(s.wallet().available, 2);
  const t = creditRuntime(), transaction = t.db.runTransaction.bind(t.db);
  t.db.runTransaction = async fn => { const value = await transaction(fn); if (value?.active?.orderId) t.wallet().status = 'blocked'; return value; };
  assert.equal((await invoke(req(t), t.options)).body.error, 'COACHING_DISPATCH_BLOCKED'); assert.equal(t.calls.generate, 0);
  assert.equal(t.wallet().held, 0); assert.equal(t.wallet().available, 2); assert.equal(t.global().spentUnits, 0); assert.equal(t.global().heldUnits, 0);
});

test('known unusable output preserves actual provider expense but returns the held customer unit', async () => {
  const s = creditRuntime(), generate = s.options.generate;
  s.options.generate = async (...args) => { const raw = await generate(...args); raw.status = 'incomplete'; return raw; };
  assert.equal((await invoke(req(s), s.options)).body.error, 'COACHING_OUTPUT_UNUSABLE');
  assert.equal(s.wallet().available, 2); assert.equal(s.wallet().used, 0); assert.equal(s.wallet().held, 0); assert.equal(s.global().spentUnits, 200);
  assert.equal((await invoke(req(s), s.options)).body.error, 'PREVIOUS_ATTEMPT_FAILED'); assert.equal(s.calls.generate, 1);
});

test('daily and global technical caps do not reset or destroy purchased balances', async () => {
  const s = creditRuntime({ quantity: 50 }); for (let n = 1; n <= 5; n++) assert.equal((await invoke(req(s, n), s.options)).status, 200);
  assert.equal((await invoke(req(s, 6), s.options)).body.error, 'DAILY_USER_LIMIT'); assert.equal(s.wallet().available, 45); assert.equal(s.calls.tokens, 5);
  const t = creditRuntime(); t.options.config.globalMonthly = 1; await invoke(req(t), t.options);
  const other = req(t, 2); other.headers.authorization = 'Bearer bob'; assert.equal((await invoke(other, t.options)).body.error, 'GLOBAL_LIMIT'); assert.equal(t.wallet('bob').available, 2);
});

test('concurrent duplicate dispatches once and ambiguous provider response keeps both holds without automatic retry', async () => {
  const s = creditRuntime(), results = await Promise.all([invoke(req(s), s.options), invoke(req(s), s.options)]);
  assert.ok(results.some(r => r.status === 200)); assert.equal(s.calls.generate, 1); assert.equal(s.wallet().used, 1);
  const t = creditRuntime(); t.options.generate = async () => { t.calls.generate++; throw Error('private'); };
  const result = await invoke(req(t), t.options); assert.equal(result.body.error, 'PROVIDER_OUTCOME_UNCONFIRMED'); assert.doesNotMatch(JSON.stringify(result), /private/);
  assert.equal((await invoke(req(t), t.options)).body.error, 'REQUEST_IN_PROGRESS'); assert.equal(t.calls.generate, 1);
  assert.equal(t.wallet().held, 1); assert.equal(t.wallet().available, 1); assert.ok(t.global().heldUnits > 0);
});
