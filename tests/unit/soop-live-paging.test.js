import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, resetSoopLiveCacheForTests, extractSoopBroadcasts } from '../../functions/api/soop-live.js';
import { fetchSoopLive, getSoopLiveEndpoint } from '../../src/domains/home/soop-live.js';
import { projectSoopPage, selectSoopBroadcasts } from '../../src/domains/home/soop-broadcasts.js';

const originalFetch = globalThis.fetch;
const env = { SOOP_CLIENT_ID: 'fixture-private-client-id', SOOP_CATEGORY_ID: '00040005' };
const context = suffix => ({ request: new Request(`https://trackingsa.com/api/soop-live${suffix}`), env });
afterEach(() => { globalThis.fetch = originalFetch; resetSoopLiveCacheForTests(); });

test('paged pipeline matches the previous full-page reference, including late interval, aliases and duplicate ties', async () => {
  for (let seed = 0; seed < 5; seed++) {
    resetSoopLiveCacheForTests();
    const pages = Array.from({ length: 5 }, (_, page) => Array.from({ length: 60 }, (_, index) => {
      const n = page * 60 + index + seed;
      return { broadcast_id: `fixture-${n % 117}`, broadcastTitle: n % 29 === 0 ? 'InTeRvAl 내전' : '방송',
        bj_id: n % 11 === 0 ? '' : `fixture-${n}`, watch_url: n % 23 === 0 ? 'https://play.sooplive.com/explicit/1' : 'javascript:invalid',
        user_nick: `표시명 ${n}`, current_viewers: n % 17, broad_thumb: n % 7 === 0 ? 'http://invalid.example/a' : '//liveimg.sooplive.com/m/fixture',
        provider_internal: env.SOOP_CLIENT_ID };
    }));
    pages[0].splice(0, 3,
      { id: 'tie', title: '방송', streamerId: 'low', viewerCount: 1 },
      { id: 'before', title: '방송', streamerId: 'before', viewerCount: 20 },
      { id: 'tie', title: '방송', streamerId: 'winner', viewerCount: 20 });
    pages[4][59] = { broad_no: 'late', broad_title: 'INTERVAL 마지막 페이지', user_id: 'late', total_view_cnt: 999 };
    const expected = new Map();
    for (const broad of pages) for (const item of extractSoopBroadcasts({ broad })) if (!expected.has(item.id)) expected.set(item.id, item);
    const reference = [...expected.values()].sort((a, b) => {
      const ai = /interval/i.test(a.title), bi = /interval/i.test(b.title);
      return ai !== bi ? (ai ? -1 : 1) : b.viewerCount - a.viewerCount;
    }).slice(0, 12);
    const providerPages = [], clientPages = [];
    globalThis.fetch = async input => {
      const url = new URL(input);
      assert.equal(url.origin, 'https://openapi.sooplive.com');
      assert.equal(url.searchParams.get('client_id'), env.SOOP_CLIENT_ID);
      const page = Number(url.searchParams.get('page_no'));
      providerPages.push(page);
      return Response.json({ total_cnt: 300, page_block: 60, broad: pages[page - 1] });
    };
    const actual = await fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', fetchImpl: async input => {
      const page = Number(new URL(input, 'https://trackingsa.com').searchParams.get('page'));
      clientPages.push(page);
      const response = await onRequest(context(`?page=${page}`));
      const text = await response.clone().text();
      assert.ok(!text.includes(env.SOOP_CLIENT_ID));
      assert.ok(!text.includes('provider_internal'));
      return response;
    } });
    assert.deepEqual(actual.broadcasts, reference, `seed ${seed}`);
    assert.deepEqual(clientPages.sort(), [1, 2, 3, 4, 5]);
    assert.deepEqual(providerPages.sort(), [1, 2, 3, 4, 5]);
    assert.equal(actual.partialFailures, 0);
  }
});

test('page cache is isolated by page and from the legacy full-list cache', async () => {
  const calls = [];
  globalThis.fetch = async input => {
    const page = Number(new URL(input).searchParams.get('page_no'));
    calls.push(page);
    return Response.json({ total_cnt: 120, broad: [{ broad_no: `page-${page}`, user_id: 'fixture' }] });
  };
  const first = await onRequest(context('?page=1'));
  const second = await onRequest(context('?page=2'));
  const hit = await onRequest(context('?page=1'));
  assert.equal(first.headers.get('x-soop-cache'), 'MISS');
  assert.equal(hit.headers.get('x-soop-cache'), 'HIT');
  assert.equal((await second.json()).broadcasts[0].id, 'page-2');
  const legacy = await (await onRequest(context(''))).json();
  assert.equal(legacy.mode, undefined);
  assert.equal(legacy.broadcasts.length, 2);
  assert.deepEqual(calls, [1, 2, 1, 2]);
});

test('page API rejects invalid or repeated page values without provider calls', async () => {
  globalThis.fetch = () => { throw new Error('UNEXPECTED_PROVIDER_CALL'); };
  for (const suffix of ['?page=0', '?page=11', '?page=1.5', '?page=-1', '?page=01', '?page=', '?page=1&page=2']) {
    const response = await onRequest(context(suffix));
    assert.equal(response.status, 400, suffix);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('paged loading keeps successful pages in page order even when later pages fail or finish first', async () => {
  const payload = page => ({ status: 'ready', mode: 'page', page, pageCount: 3, stale: page === 3,
    broadcasts: [{ id: 'duplicate', streamerId: `page-${page}`, title: '방송', viewerCount: page }] });
  const actual = await fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', fetchImpl: async input => {
    const page = Number(new URL(input, 'https://trackingsa.com').searchParams.get('page'));
    if (page === 2) return new Response('unavailable', { status: 503 });
    return Response.json(payload(page));
  } });
  assert.equal(actual.broadcasts[0].streamerId, 'page-1');
  assert.equal(actual.partialFailures, 1);
  assert.equal(actual.stale, true);
});

test('paged first-page failures and malformed page counts stop before fan-out; pending needs one request', async () => {
  for (const data of [{ status: 'ready', mode: 'page', page: 1, pageCount: 100000, broadcasts: [] },
    { status: 'ready', mode: 'page', page: 2, pageCount: 2, broadcasts: [] }]) {
    let calls = 0;
    await assert.rejects(fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', fetchImpl: async () => { calls++; return Response.json(data); } }), { code: 'INVALID_RESPONSE' });
    assert.equal(calls, 1);
  }
  let pendingCalls = 0;
  const pending = await fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', fetchImpl: async () => { pendingCalls++; return Response.json({ status: 'pending', broadcasts: [] }); } });
  assert.equal(pending.status, 'pending');
  assert.equal(pendingCalls, 1);
});

test('paged first-page HTTP failures retain status and safe correlation IDs without response bodies or retries', async () => {
  let calls = 0;
  await assert.rejects(fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', fetchImpl: async () => {
    calls++;
    return new Response('private-upstream-error', { status: 502, headers: { 'X-Request-ID': 'safe-correlation-123' } });
  } }), error => {
    assert.equal(error.code, 'HTTP_ERROR');
    assert.equal(error.status, 502);
    assert.equal(error.requestId, 'safe-correlation-123');
    assert.ok(!error.message.includes('private-upstream-error'));
    return true;
  });
  assert.equal(calls, 1);
});

test('paged loading has one total deadline, cancels fan-out and never retries', async () => {
  let calls = 0;
  const signals = [];
  await assert.rejects(fetchSoopLive({ endpoint: '/api/soop-live', mode: 'paged', timeoutMs: 25, fetchImpl: async (input, options) => {
    calls++;
    if (calls === 1) return Response.json({ status: 'ready', mode: 'page', page: 1, pageCount: 10, broadcasts: [] });
    signals.push(options.signal);
    return new Promise(() => {});
  } }), { code: 'REQUEST_TIMEOUT' });
  assert.equal(calls, 5); // First page plus at most four concurrent page readers.
  assert.ok(signals.every(signal => signal.aborted));
});

test('projected fields keep safe final links and discard arbitrary provider data', () => {
  const projected = projectSoopPage({ broad: [{ user_id: 'fixture', broad_no: '1', broad_thumb: 'javascript:alert(1)', watch_url: 'http://invalid.example', access_token: 'do-not-forward' }] });
  assert.ok(!JSON.stringify(projected).includes('do-not-forward'));
  const [item] = selectSoopBroadcasts([{ broadcasts: projected }]);
  assert.equal(item.thumbnailUrl, '');
  assert.equal(item.watchUrl, 'https://play.sooplive.com/fixture/1');
  assert.equal(getSoopLiveEndpoint({ runtimeConfig: { apiBaseUrl: '/api' } }), '/api/soop-live');
});
