import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/replay-pass-checkout.js';
import { merchantFixture, ACCESS, ORDER } from '../helpers/merchant-test-fixture.js';
const env = { TOSSPAY_REVIEW_ENABLED: 'true', TOSSPAY_REVIEW_ACCESS_KEY: ACCESS };
const token = who => `${who}.synthetic_token.signature_for_unit_only`;
const claims = async value => { if (!['alice', 'bob'].includes(value.split('.')[0])) throw Error('private-token'); return { sub: value.split('.')[0], firebase: { sign_in_provider: 'google.com' } }; };
const req = (who = 'alice', body = { action: 'create', orderId: ORDER }, extra = {}) => new Request('https://trackingsa.com/api/replay-pass-checkout', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://trackingsa.com', ...(who ? { Authorization: `Bearer ${token(who)}` } : {}), ...extra }, body: JSON.stringify(body) });
const ok = () => Response.json({ mode: 'TEST', demoOnly: true, operationalCreditsGranted: false, order: {} });
test('customer checkout refuses unconfigured, cross-origin, missing/invalid/anonymous authentication before upstream', async () => {
  let calls = 0; const fetch = async () => { calls++; return ok(); };
  for (const request of [req(null), req('invalid'), req('alice', undefined, { Origin: 'https://evil.example' })]) assert.ok((await onRequest({ request, env }, fetch, claims)).status >= 400);
  assert.equal((await onRequest({ request: req(), env: {} }, fetch, claims)).status, 503);
  assert.equal((await onRequest({ request: req(), env }, fetch, async () => ({ sub: 'alice', firebase: { sign_in_provider: 'anonymous' } }))).status, 401);
  for (const sub of ['', null, 'x'.repeat(129)]) assert.equal((await onRequest({ request: req(), env }, fetch, async () => ({ sub, firebase: { sign_in_provider: 'google.com' } }))).status, 401);
  assert.equal((await onRequest({ request: new Request('https://trackingsa.com/api/replay-pass-checkout'), env }, fetch, claims)).status, 405);
  assert.equal(calls, 0);
});
test('verified UID chooses stable server-owned session, ignores caller session/cookies and never returns shared key', async () => {
  const seen = [];
  const fetch = async (url, options) => { assert.equal(url, 'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/replayPurchaseTest');
    assert.equal(options.headers.Authorization, `Bearer ${ACCESS}`); assert.equal(options.headers.Cookie, undefined); assert.equal(options.redirect, 'manual'); seen.push(options.headers['x-review-session']); return ok(); };
  for (const who of ['alice', 'alice', 'bob']) {
    const response = await onRequest({ request: req(who, undefined, { Cookie: 'private_cookie', 'x-review-session': 'f'.repeat(64) }), env }, fetch, claims);
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store'); assert.equal(JSON.stringify(await response.json()).includes(ACCESS), false);
  }
  assert.match(seen[0], /^[a-f0-9]{64}$/); assert.equal(seen[0], seen[1]); assert.notEqual(seen[0], seen[2]); assert.notEqual(seen[0], 'f'.repeat(64));
});
test('customer proxy keeps existing payload limits, redirect/LIVE rejection and no retries', async () => {
  let calls = 0; const fetch = async () => { calls++; return ok(); };
  for (const body of [{ action: 'create', orderId: ORDER, uid: 'bob' }, { action: 'create', orderId: ORDER, amountKRW: 1 }]) assert.equal((await onRequest({ request: req('alice', body), env }, fetch, claims)).status, 400);
  assert.equal((await onRequest({ request: req('alice', 'x'.repeat(1030)), env }, fetch, claims)).status, 503);
  assert.equal(calls, 0);
  for (const response of [() => new Response(null, { status: 302, headers: { Location: `https://evil.example/${ACCESS}` } }), () => Response.json({ mode: 'LIVE', demoOnly: true, operationalCreditsGranted: false })]) {
    let count = 0; const result = await onRequest({ request: req(), env }, async () => { count++; return response(); }, claims);
    assert.equal(result.status, 503); assert.equal(count, 1); assert.equal(JSON.stringify(await result.json()).includes(ACCESS), false);
  }
});
test('authenticated customer reaches isolated real handler while another user cannot inspect or complete its order', async () => {
  const f = merchantFixture();
  const fetch = async (_url, options) => { const result = { status: 200 }, res = { set() {}, status(value) { result.status = value; return this; }, json(body) { result.body = body; return this; } };
    await f.handler({ method: 'POST', headers: Object.fromEntries(Object.entries(options.headers).map(([k, v]) => [k.toLowerCase(), v])), rawBody: Buffer.from(options.body) }, res);
    return Response.json(result.body, { status: result.status }); };
  const call = (who, action) => onRequest({ request: req(who, { action, orderId: ORDER }), env }, fetch, claims);
  assert.equal((await call('alice', 'create')).status, 200);
  assert.equal((await call('alice', 'checkout')).status, 200); assert.equal(f.counts.create, 1);
  for (const action of ['get', 'complete', 'checkout']) assert.equal((await call('bob', action)).status, 404);
  f.payment().payStatus = 'PAY_APPROVED';
  const result = await call('alice', 'complete'); assert.equal(result.status, 200); const body = await result.json();
  assert.equal(body.order.state, 'confirmed'); assert.equal(body.order.quantity, 20); assert.equal(body.operationalCreditsGranted, false);
  assert.equal((await call('alice', 'complete')).status, 200); assert.equal(f.counts.approve, 1);
  assert.ok([...f.db.data.keys()].every(p => !p.includes('/wallet') && !p.includes('/credit_orders')));
});
