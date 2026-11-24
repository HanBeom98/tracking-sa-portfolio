import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, resetSaProxyCacheForTests } from '../../functions/api/sa-proxy.js';

const originalFetch = global.fetch;

function createContext(path, params = {}) {
  const url = new URL('https://trackingsa.com/api/sa-proxy');
  url.searchParams.set('path', path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return {
    request: { method: 'GET', url: url.toString() },
    env: { NEXON_API_KEY: 'test-key' }
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  resetSaProxyCacheForTests();
});

test('SA proxy reuses a successful match detail response', async () => {
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ match_id: 'match-1' }), { status: 200 });
  };
  const context = createContext('/suddenattack/v1/match-detail', { match_id: 'match-1' });

  const first = await onRequest(context);
  const second = await onRequest(context);

  assert.equal(fetchCount, 1);
  assert.equal(first.headers.get('X-SA-Cache'), 'MISS');
  assert.equal(second.headers.get('X-SA-Cache'), 'HIT');
  assert.match(second.headers.get('Cache-Control'), /s-maxage=86400/);
  assert.deepEqual(await second.json(), { match_id: 'match-1' });
});

test('SA proxy coalesces simultaneous identical requests', async () => {
  let fetchCount = 0;
  let releaseFetch;
  global.fetch = () => {
    fetchCount += 1;
    return new Promise((resolve) => {
      releaseFetch = () => resolve(new Response(JSON.stringify({ match: [] }), { status: 200 }));
    });
  };
  const context = createContext('/suddenattack/v1/match', {
    ouid: 'ouid-1',
    match_type: '랭크전 솔로',
    match_mode: '폭파미션'
  });

  const firstPromise = onRequest(context);
  const secondPromise = onRequest(context);
  await new Promise((resolve) => setImmediate(resolve));
  releaseFetch();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(fetchCount, 1);
  assert.equal(first.headers.get('X-SA-Cache'), 'MISS');
  assert.equal(second.headers.get('X-SA-Cache'), 'COALESCED');
  assert.match(first.headers.get('Cache-Control'), /s-maxage=30/);
});

test('SA proxy does not cache unsuccessful Nexon responses', async () => {
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ error: { message: 'temporary' } }), { status: 503 });
  };
  const context = createContext('/suddenattack/v1/user/recent-info', { ouid: 'ouid-1' });

  const first = await onRequest(context);
  const second = await onRequest(context);

  assert.equal(first.status, 503);
  assert.equal(second.status, 503);
  assert.equal(fetchCount, 2);
  assert.equal(second.headers.get('X-SA-Cache'), 'MISS');
});

test('SA proxy fails before calling Nexon when the server API key is missing', async () => {
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response('{}', { status: 200 });
  };
  const context = createContext('/suddenattack/v1/user/basic', { ouid: 'ouid-1' });
  context.env = {};

  const response = await onRequest(context);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(body.code, 'NEXON_API_KEY_MISSING');
  assert.equal(fetchCount, 0);
});

test('SA proxy rejects absolute external URLs before attaching the API key', async () => {
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response('{}', { status: 200 });
  };

  const response = await onRequest(createContext('https://attacker.example/collect'));

  assert.equal(response.status, 400);
  assert.equal(fetchCount, 0);
});

test('SA proxy rejects non-Sudden Attack paths and non-GET methods', async () => {
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response('{}', { status: 200 });
  };

  const wrongPath = await onRequest(createContext('/maplestory/v1/id'));
  const postContext = createContext('/suddenattack/v1/id');
  postContext.request.method = 'POST';
  const wrongMethod = await onRequest(postContext);

  assert.equal(wrongPath.status, 400);
  assert.equal(wrongMethod.status, 405);
  assert.equal(fetchCount, 0);
});

test('SA proxy allows the bounded Sudden Attack static metadata paths', async () => {
  let requestedUrl = '';
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ tier: [] }), { status: 200 });
  };

  const response = await onRequest(createContext('/static/suddenattack/meta/tier'));

  assert.equal(response.status, 200);
  assert.equal(new URL(requestedUrl).pathname, '/static/suddenattack/meta/tier');
});
