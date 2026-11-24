import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as proxy, resetSaProxyCacheForTests } from '../../functions/api/sa-proxy.js';
import { onRequest as soop, resetSoopLiveCacheForTests } from '../../functions/api/soop-live.js';
import { publicCacheKey, storePublicResponse } from '../../functions/infra/public-response-cache.js';

const originalFetch = globalThis.fetch;
const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
  else delete globalThis.caches;
  resetSaProxyCacheForTests(); resetSoopLiveCacheForTests();
});
function installCache() {
  const entries = new Map();
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    async match(key) { return entries.get(key)?.clone(); },
    async put(key, response) { entries.set(key, response.clone()); },
  } } });
  return entries;
}
const proxyContext = (ouid = 'player-a') => ({
  request: { method: 'GET', url: `https://trackingsa.com/api/sa-proxy?path=/suddenattack/v1/user/basic&ouid=${ouid}` },
  env: { NEXON_API_KEY: 'test-key' },
});
const soopContext = () => ({ request: { method: 'GET', url: 'https://trackingsa.com/api/soop-live' }, env: { SOOP_CLIENT_ID: 'client', SOOP_CATEGORY_ID: '00040005' } });

test('public Nexon results survive a new instance without sharing another player or an old request ID', async () => {
  installCache(); let fetches = 0;
  globalThis.fetch = async () => { fetches++; return Response.json({ user_name: 'fixture' }); };
  const first = await proxy(proxyContext());
  resetSaProxyCacheForTests();
  const second = await proxy(proxyContext());
  assert.equal(fetches, 1); assert.equal(second.headers.get('x-sa-cache'), 'EDGE_HIT');
  assert.notEqual(second.headers.get('x-request-id'), first.headers.get('x-request-id'));
  assert.deepEqual(await second.json(), { user_name: 'fixture' });
  assert.match(second.headers.get('cache-control'), /s-maxage=300/);
  await proxy(proxyContext('player-b')); assert.equal(fetches, 2);
  const noKey = proxyContext(); noKey.env = {};
  assert.equal((await proxy(noKey)).status, 503);
});

test('SOOP ready results survive a new instance but pending configuration and other categories cannot reuse them', async () => {
  installCache(); let fetches = 0;
  globalThis.fetch = async () => { fetches++; return Response.json({ broad: [{ broad_no: 1, user_id: 'fixture', broad_title: 'fixture' }] }); };
  await soop(soopContext()); resetSoopLiveCacheForTests();
  const response = await soop(soopContext());
  assert.equal(response.headers.get('x-soop-cache'), 'EDGE_HIT');
  assert.equal((await response.json()).status, 'ready'); assert.equal(fetches, 1);
  const other = soopContext(); other.env.SOOP_CATEGORY_ID = 'other';
  await soop(other); assert.equal(fetches, 2);
  const otherApp = soopContext(); otherApp.env.SOOP_CLIENT_ID = 'other-client';
  await soop(otherApp); assert.equal(fetches, 3);
  const missing = soopContext(); missing.env = {};
  assert.equal((await (await soop(missing)).json()).status, 'pending');
});

test('provider failures and private/no-store/cookie responses never enter the public cache', async () => {
  const entries = installCache();
  const key = await publicCacheKey('https://trackingsa.com/api/example', 'example', { client_id: 'private-client', ouid: 'private-player' });
  assert.doesNotMatch(key, /private-client|private-player|client_id|ouid/);
  for (const [status, headers] of [
    [503, { 'cache-control': 'public, s-maxage=30' }],
    [200, { 'cache-control': 'private, s-maxage=30' }],
    [200, { 'cache-control': 'public, no-store, s-maxage=30' }],
    [200, { 'cache-control': 'public, s-maxage=30', 'set-cookie': 'fixture=value' }],
  ]) await storePublicResponse({}, key, new Response('{}', { status, headers }));
  assert.equal(entries.size, 0);
  globalThis.fetch = async () => Response.json({}, { status: 503 });
  await proxy(proxyContext()); assert.equal(entries.size, 0);
});

test('cache read/write failures preserve provider responses and background writes do not delay them', async () => {
  installCache(); globalThis.fetch = async () => Response.json({ user_name: 'fixture' });
  globalThis.caches.default.match = async () => { throw new Error('unavailable'); };
  let release;
  globalThis.caches.default.put = () => new Promise(resolve => { release = resolve; });
  const tasks = [], context = proxyContext(); context.waitUntil = task => tasks.push(task);
  const response = await proxy(context);
  assert.equal(response.status, 200); assert.equal(tasks.length, 1);
  release(); await Promise.all(tasks);
  resetSaProxyCacheForTests();
  globalThis.caches.default.put = async () => { throw new Error('unavailable'); };
  assert.equal((await proxy(proxyContext())).status, 200);
});
