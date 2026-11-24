import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSoopBroadListUrl,
  extractSoopBroadcasts,
  onRequest,
  resetSoopLiveCacheForTests,
} from '../../functions/api/soop-live.js';

const originalFetch = global.fetch;

function createContext(env = {}) {
  return {
    request: { method: 'GET', url: 'https://trackingsa.com/api/soop-live' },
    env,
  };
}

afterEach(() => {
  global.fetch = originalFetch;
  resetSoopLiveCacheForTests();
});

test('SOOP live API reports pending before provider credentials are configured', async () => {
  const response = await onRequest(createContext());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-SOOP-Cache'), 'DISABLED');
  assert.deepEqual(await response.json(), {
    status: 'pending',
    provider: 'SOOP',
    category: 'Sudden Attack',
    broadcasts: [],
    message: 'SOOP Developers 승인 후 라이브 방송을 연결합니다.',
  });
});

test('SOOP response variants are normalized and sorted by viewer count', () => {
  const broadcasts = extractSoopBroadcasts({
    data: {
      items: [
        { broad_no: 2, broad_title: '두 번째', user_nick: '비제이2', view_cnt: '12', bj_id: 'bj2' },
        { broad_no: 1, broad_title: '첫 번째', user_nick: '비제이1', view_cnt: '340', bj_id: 'bj1' },
      ],
    },
  });

  assert.equal(broadcasts.length, 2);
  assert.equal(broadcasts[0].id, '1');
  assert.equal(broadcasts[0].streamerName, '비제이1');
  assert.equal(broadcasts[0].viewerCount, 340);
  assert.equal(broadcasts[0].watchUrl, 'https://play.sooplive.com/bj1/1');
});

test('SOOP broad list URL uses the official category query parameters', () => {
  const url = new URL(buildSoopBroadListUrl({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  }));

  assert.equal(url.origin, 'https://openapi.sooplive.com');
  assert.equal(url.pathname, '/broad/list');
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('select_key'), 'cate');
  assert.equal(url.searchParams.get('select_value'), '00040000');
  assert.equal(url.searchParams.get('order_type'), 'view_cnt');
  assert.equal(url.searchParams.get('page_no'), '1');
});

test('SOOP broad list URL supports additional result pages', () => {
  const url = new URL(buildSoopBroadListUrl({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  }, 3));

  assert.equal(url.searchParams.get('page_no'), '3');
});

test('SOOP official broad response and protocol-relative thumbnails are normalized', () => {
  const broadcasts = extractSoopBroadcasts({
    broad: [{
      broad_no: '123',
      broad_title: 'Sudden Attack',
      user_id: 'tracking',
      user_nick: 'Tracking',
      broad_thumb: '//liveimg.sooplive.com/m/123',
      total_view_cnt: '25',
    }],
  });

  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].thumbnailUrl, 'https://liveimg.sooplive.com/m/123');
  assert.equal(broadcasts[0].watchUrl, 'https://play.sooplive.com/tracking/123');
});

test('SOOP broadcasts with interval in the title are placed first regardless of case', () => {
  const broadcasts = extractSoopBroadcasts({
    broadcasts: [
      { broad_no: 'popular', broad_title: '시청자 많은 방송', bj_id: 'popular', view_cnt: 900 },
      { broad_no: 'interval-low', broad_title: '오늘의 InTeRvAl 내전', bj_id: 'interval-low', view_cnt: 10 },
      { broad_no: 'interval-high', broad_title: 'INTERVAL 공식 방송', bj_id: 'interval-high', view_cnt: 50 },
    ],
  });

  assert.deepEqual(broadcasts.map((broadcast) => broadcast.id), [
    'interval-high',
    'interval-low',
    'popular',
  ]);
});

test('SOOP live API finds interval broadcasts beyond the first provider page', async () => {
  resetSoopLiveCacheForTests();
  const requestedPages = [];
  global.fetch = async (url) => {
    const pageNo = Number(new URL(url).searchParams.get('page_no'));
    requestedPages.push(pageNo);
    return new Response(JSON.stringify(pageNo === 1
      ? {
          total_cnt: 61,
          page_block: 60,
          broad: [{ broad_no: 'popular', broad_title: '인기 방송', user_id: 'popular', total_view_cnt: 500 }],
        }
      : {
          total_cnt: 61,
          page_block: 60,
          broad: [{ broad_no: 'interval', broad_title: 'Interval 내전', user_id: 'interval', total_view_cnt: 8 }],
        }), { status: 200 });
  };

  const response = await onRequest(createContext({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  }));
  const body = await response.json();

  assert.deepEqual(requestedPages.sort(), [1, 2]);
  assert.deepEqual(body.broadcasts.map((broadcast) => broadcast.id), ['interval', 'popular']);
});

test('SOOP live API keeps first-page broadcasts when an additional page fails', async () => {
  global.fetch = async (url) => {
    const pageNo = Number(new URL(url).searchParams.get('page_no'));
    if (pageNo > 1) return new Response('unavailable', { status: 503 });
    return new Response(JSON.stringify({
      total_cnt: 61,
      page_block: 60,
      broad: [{ broad_no: 'popular', broad_title: '인기 방송', user_id: 'popular', total_view_cnt: 500 }],
    }), { status: 200 });
  };

  const response = await onRequest(createContext({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.broadcasts.map((broadcast) => broadcast.id), ['popular']);
});

test('bounded SOOP results preserve full normalization, late interval priority and valid duplicate ordering', async () => {
  const pages = [
    Array.from({ length: 60 }, (_, index) => ({ broad_no: String(index), broad_title: `방송 ${index}`, user_id: `fixture-${index}`, total_view_cnt: 1000 - index, broad_thumb: `//liveimg.sooplive.com/m/${index}` })),
    [
      { broad_no: 'invalid', broad_title: 'INTERVAL', total_view_cnt: 999999 },
      { broad_no: 'duplicate', broad_title: 'InTeRvAl', user_id: 'preferred', total_view_cnt: 3, broad_thumb: '//liveimg.sooplive.com/m/preferred' },
      { broad_no: 'duplicate', broad_title: 'Interval', user_id: 'lower', total_view_cnt: 1 },
      { broad_no: 'late', broad_title: 'Interval 내전', user_id: 'late', total_view_cnt: 2, broad_thumb: 'http://invalid.example/image' },
      { broad_no: '0', broad_title: '나중 페이지 중복', user_id: 'later-duplicate', total_view_cnt: 99999 },
    ],
  ];
  global.fetch = async url => Response.json({ total_cnt: 65, page_block: 60, broad: pages[Number(new URL(url).searchParams.get('page_no')) - 1] });
  const expected = new Map();
  for (const broad of pages) for (const item of extractSoopBroadcasts({ broad })) if (!expected.has(item.id)) expected.set(item.id, item);
  const reference = [...expected.values()].sort((a, b) => {
    const ai = a.title.toLocaleLowerCase('en-US').includes('interval'), bi = b.title.toLocaleLowerCase('en-US').includes('interval');
    return ai !== bi ? (ai ? -1 : 1) : b.viewerCount - a.viewerCount;
  }).slice(0, 12);
  const body = await (await onRequest(createContext({ SOOP_CLIENT_ID: 'client-id', SOOP_CATEGORY_ID: '00040005' }))).json();
  assert.deepEqual(body.broadcasts, reference);
  assert.equal(body.broadcasts[0].streamerId, 'preferred');
  assert.equal(body.broadcasts[1].thumbnailUrl, '');
  assert.equal(body.broadcasts.length, 12);
});

test('SOOP live API caches successful normalized responses', async () => {
  let fetchCount = 0;
  global.fetch = async (url, options) => {
    fetchCount += 1;
    const providerUrl = new URL(url);
    assert.equal(providerUrl.searchParams.get('client_id'), 'client-id');
    assert.equal(providerUrl.searchParams.get('select_value'), '00040000');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return new Response(JSON.stringify({
      broadcasts: [{ broad_no: 'live-1', broad_title: '라이브', bj_id: 'tracking', view_cnt: 25 }],
    }), { status: 200 });
  };
  const context = createContext({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  });

  const first = await onRequest(context);
  const second = await onRequest(context);
  const body = await second.json();

  assert.equal(fetchCount, 1);
  assert.equal(first.headers.get('X-SOOP-Cache'), 'MISS');
  assert.equal(second.headers.get('X-SOOP-Cache'), 'HIT');
  assert.equal(body.status, 'ready');
  assert.equal(body.broadcasts[0].id, 'live-1');
});

test('candidate selection matches the full sorted-page reference across aliases, duplicates, invalid links and stable ties', async () => {
  for (let seed = 0; seed < 8; seed++) {
    resetSoopLiveCacheForTests();
    const pages = Array.from({ length: 5 }, (_, p) => Array.from({ length: 60 }, (_, i) => {
      const n = p * 60 + i + seed;
      return {
        id: n % 19 === 0 ? '' : `fixture-${n % 83}`,
        title: n % 17 === 0 ? 'InTeRvAl 내전' : `방송 ${n % 9}`,
        streamer_id: n % 7 === 0 ? '' : `fixture-${n % 31}`,
        watch_url: n % 13 === 0 ? 'https://play.sooplive.com/explicit/1' : 'http://not-allowed.example',
        viewer_count: String((n * 17) % 11 - 2),
        thumbnail_url: n % 2 ? '//liveimg.sooplive.com/m/fixture' : 'http://not-allowed.example',
      };
    }));
    pages[0].splice(0, 3,
      { id: 'tie-duplicate', title: '방송', streamer_id: 'low', viewer_count: 1 },
      { id: 'tie-before', title: '방송', streamer_id: 'before', viewer_count: 20 },
      { id: 'tie-duplicate', title: '방송', streamer_id: 'winner', viewer_count: 20 });
    pages[4][59] = { broad_no: 'late-interval', broad_title: 'Interval 마지막 페이지', user_id: 'late', total_view_cnt: 30 };
    const byId = new Map();
    for (const broad of pages) for (const item of extractSoopBroadcasts({ broad })) if (!byId.has(item.id)) byId.set(item.id, item);
    const reference = [...byId.values()].sort((a,b) => {
      const ai = /interval/i.test(a.title), bi = /interval/i.test(b.title);
      return ai !== bi ? (ai ? -1 : 1) : b.viewerCount - a.viewerCount;
    }).slice(0, 12);
    global.fetch = async url => Response.json({ total_cnt: 300, page_block: 60, broad: pages[Number(new URL(url).searchParams.get('page_no')) - 1] });
    const actual = await (await onRequest(createContext({ SOOP_CLIENT_ID: 'client-id', SOOP_CATEGORY_ID: '00040005' }))).json();
    assert.deepEqual(actual.broadcasts, reference, `seed ${seed}`);
    assert.equal(actual.broadcasts[0].id, 'late-interval');
  }
});

test('SOOP live API hides provider errors behind a stable response', async () => {
  global.fetch = async () => new Response('unavailable', { status: 503 });
  const response = await onRequest(createContext({
    SOOP_CLIENT_ID: 'client-id',
    SOOP_CATEGORY_ID: '00040000',
  }));
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(response.headers.get('X-SOOP-Cache'), 'ERROR');
  assert.equal(body.status, 'error');
  assert.deepEqual(body.broadcasts, []);
});
