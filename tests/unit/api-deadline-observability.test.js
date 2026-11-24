import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as saProxy, resetSaProxyCacheForTests } from '../../functions/api/sa-proxy.js';
import { onRequest as soopLive, resetSoopLiveCacheForTests } from '../../functions/api/soop-live.js';
import { onRequest as saImage } from '../../functions/api/sa-image.js';

const turn = () => new Promise(setImmediate);
const proxyContext = () => ({ request: { method: 'GET', url: 'https://trackingsa.com/api/sa-proxy?path=/suddenattack/v1/id&user_name=private-name' }, env: { NEXON_API_KEY: 'secret-key' } });
const soopContext = () => ({ request: { method: 'GET', url: 'https://trackingsa.com/api/soop-live' }, env: { SOOP_CLIENT_ID: 'secret-client', SOOP_CATEGORY_ID: '00040000' } });

test('coalesced Nexon requests time out together, are not cached and can recover', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(resetSaProxyCacheForTests);
  const events = []; t.mock.method(console, 'info', (line) => events.push(JSON.parse(line)));
  let calls = 0;
  const mock = t.mock.method(globalThis, 'fetch', () => { calls++; return new Promise(() => {}); });
  const a = saProxy(proxyContext()), b = saProxy(proxyContext());
  await turn(); t.mock.timers.tick(10000);
  const responses = await Promise.all([a, b]);
  assert.equal(calls, 1);
  for (const response of responses) {
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'REQUEST_TIMEOUT');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(response.headers.get('X-Request-ID'), /^[a-f0-9-]{36}$/);
    assert.match(response.headers.get('Server-Timing'), /^app;dur=/);
  }
  assert.notEqual(responses[0].headers.get('X-Request-ID'), responses[1].headers.get('X-Request-ID'));
  assert.deepEqual(events.map(e => e.cache), ['MISS', 'COALESCED']);
  assert.doesNotMatch(JSON.stringify(events), /secret-key|private-name|user_name|token/i);
  mock.mock.mockImplementation(async () => Response.json({ ouid: 'test-id' }));
  const recovered = await saProxy(proxyContext());
  assert.equal(recovered.status, 200);
  assert.equal(recovered.headers.get('X-SA-Cache'), 'MISS');
  assert.equal((await saProxy(proxyContext())).headers.get('X-SA-Cache'), 'HIT');
});

test('Nexon rejects invalid success JSON and HTTP failures are never shared-cacheable', async (t) => {
  t.after(resetSaProxyCacheForTests);
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('broken'));
  const invalid = await saProxy(proxyContext());
  assert.equal(invalid.status, 502);
  assert.equal((await invalid.json()).code, 'INVALID_RESPONSE');
  mock.mock.mockImplementation(async () => Response.json({ error: { message: 'busy' } }, { status: 429 }));
  const limited = await saProxy(proxyContext());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Cache-Control'), 'no-store');
});

test('image deadline includes the image bytes and invalid MIME cannot return success', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const context = { request: { method: 'GET', url: 'https://trackingsa.com/api/sa-image?path=/static/suddenattack/img/cf9b9c46cec3344aeb3ce37ba262ce8b' } };
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: () => new Promise(() => {}) }));
  const pending = saImage(context); await turn(); t.mock.timers.tick(10000);
  const timeout = await pending;
  assert.equal(timeout.status, 504);
  assert.equal(timeout.headers.get('Cache-Control'), 'no-store');
  mock.mock.mockImplementation(async () => new Response('html', { headers: { 'content-type': 'text/html' } }));
  assert.equal((await saImage(context)).status, 502);
});

test('SOOP timeout preserves its bounded stale fallback and records the failure cause', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.after(resetSoopLiveCacheForTests);
  let now = 100000; t.mock.method(Date, 'now', () => now);
  const events = []; t.mock.method(console, 'info', (line) => events.push(JSON.parse(line)));
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ broadcasts: [{ id: '1', title: 'safe', streamerId: 'example' }] }));
  assert.equal((await soopLive(soopContext())).status, 200);
  now += 31000;
  mock.mock.mockImplementation(() => new Promise(() => {}));
  const pending = soopLive(soopContext()); await turn(); t.mock.timers.tick(10000);
  const stale = await pending;
  assert.equal(stale.status, 200);
  assert.equal(stale.headers.get('X-SOOP-Cache'), 'STALE');
  assert.equal((await stale.json()).stale, true);
  assert.equal(events.at(-1).code, 'REQUEST_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(events), /secret-client|client_id/);
  now += 300000;
  const expired = soopLive(soopContext()); await turn(); t.mock.timers.tick(10000);
  assert.equal((await expired).status, 504);
});

test('Cloudflare API preserves correlation and no-store headers on an upstream error', async (t) => {
  t.after(resetSaProxyCacheForTests);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'busy' } }, { status: 503 }));
  const response = await saProxy(proxyContext());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  assert.match(response.headers.get('server-timing'), /^app;dur=/);
});

test('SOOP keeps the first page when slow additional pages exhaust the remaining total budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  t.after(resetSoopLiveCacheForTests);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (new URL(url).searchParams.get('page_no') === '1') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      return Response.json({ total_cnt: 61, page_block: 60, broadcasts: [{ id: 'first', title: 'first page', streamerId: 'example' }] });
    }
    return new Promise(() => {});
  });
  const pending = soopLive(soopContext());
  await turn(); t.mock.timers.tick(5000); await turn();
  t.mock.timers.tick(6950); await turn();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).broadcasts.map(b => b.id), ['first']);
});
