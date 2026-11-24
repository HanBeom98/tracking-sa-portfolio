import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HOME_NOTICE_CACHE_TTL_MS,
  writeHomeNoticeCache,
  readHomeNoticeCache,
  fetchHomeNotices,
  getFirebaseAppCheckToken,
  getActiveHomeNotices,
  getFirestoreNoticeEndpoint,
  normalizeFirestoreNotice,
  updateHomeNoticeMarquee,
} from '../../src/domains/home/notice-ticker.js';

test('notice timeout includes App Check acquisition and cannot populate a late cache', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = createStorage();
  let releaseToken, fetchCalls = 0;
  const pending = fetchHomeNotices({ config: { projectId: 'demo', apiKey: 'public-config' }, storage, timeoutMs: 50,
    firebaseApp: { appCheck: () => ({ getToken: () => new Promise(resolve => { releaseToken = resolve; }) }) },
    fetchImpl: async () => { fetchCalls++; return Response.json([]); },
  });
  const rejected = assert.rejects(pending, { code: 'REQUEST_TIMEOUT' });
  await new Promise(setImmediate); t.mock.timers.tick(50); await rejected;
  releaseToken({ token: 'private-appcheck-token' }); await new Promise(setImmediate);
  assert.equal(fetchCalls, 0);
  assert.equal(readHomeNoticeCache({ projectId: 'demo', storage }), null);
});

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function firestoreNotice({ id, title, createdAt, category = 'notice' }) {
  return {
    document: {
      name: `projects/test/databases/(default)/documents/board_posts/${id}`,
      fields: {
        title: { stringValue: title },
        category: { stringValue: category },
        createdAt: { timestampValue: new Date(createdAt).toISOString() },
      },
    },
  };
}

test('normalizeFirestoreNotice maps safe display fields only', () => {
  const result = normalizeFirestoreNotice(firestoreNotice({ id: 'notice-1', title: '업데이트 안내', createdAt: 1000 }));
  assert.deepEqual(result, { id: 'notice-1', title: '업데이트 안내', category: 'notice', createdAt: 1000 });
});

test('getActiveHomeNotices keeps recent notices and excludes notices older than 14 days', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  const results = [
    firestoreNotice({ id: 'new', title: '새 공지', createdAt: now - 1000 }),
    firestoreNotice({ id: 'old', title: '오래된 공지', createdAt: now - (15 * 24 * 60 * 60 * 1000) }),
    firestoreNotice({ id: 'free', title: '자유글', category: 'free', createdAt: now - 500 }),
  ];

  assert.deepEqual(getActiveHomeNotices(results, now).map((notice) => notice.id), ['new']);
});

test('getFirestoreNoticeEndpoint requires project configuration', () => {
  assert.equal(getFirestoreNoticeEndpoint({}), '');
  assert.match(getFirestoreNoticeEndpoint({ projectId: 'tracking-sa', apiKey: 'key value' }), /tracking-sa.*key=key%20value/);
});

test('fetchHomeNotices reuses the Firestore result for ten minutes', async () => {
  const storage = createStorage();
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async json() {
        return [firestoreNotice({ id: 'cached', title: '공지', createdAt: now - 1_000 })];
      }
    };
  };
  const options = {
    config: { projectId: 'tracking-sa', apiKey: 'key' },
    fetchImpl,
    storage
  };

  await fetchHomeNotices({ ...options, nowMs: now });
  const cached = await fetchHomeNotices({
    ...options,
    nowMs: now + HOME_NOTICE_CACHE_TTL_MS - 1
  });

  assert.equal(fetchCount, 1);
  assert.equal(cached[0].id, 'cached');

  await fetchHomeNotices({ ...options, nowMs: now + HOME_NOTICE_CACHE_TTL_MS });
  assert.equal(fetchCount, 2);
});

test('fetchHomeNotices attaches an App Check token to direct Firestore requests', async () => {
  let requestHeaders = null;
  const firebaseApp = {
    appCheck() {
      return {
        async getToken() {
          return { token: 'verified-token' };
        }
      };
    }
  };

  await fetchHomeNotices({
    config: { projectId: 'tracking-sa', apiKey: 'key' },
    storage: createStorage(),
    firebaseApp,
    fetchImpl: async (_url, request) => {
      requestHeaders = request.headers;
      return { ok: true, async json() { return []; } };
    }
  });

  assert.equal(requestHeaders['X-Firebase-AppCheck'], 'verified-token');
  assert.equal(await getFirebaseAppCheckToken(firebaseApp), 'verified-token');
});

test('updateHomeNoticeMarquee moves only overflowing mobile notice titles', () => {
  const classes = new Set();
  const properties = {};
  const text = { scrollWidth: 420 };
  const link = {
    clientWidth: 180,
    querySelector: () => text,
    classList: {
      toggle(name, active) {
        active ? classes.add(name) : classes.delete(name);
      },
    },
    style: {
      setProperty(name, value) {
        properties[name] = value;
      },
    },
  };

  updateHomeNoticeMarquee(link, { matchMedia: () => ({ matches: true }) });
  assert.equal(classes.has('is-marquee'), true);
  assert.equal(properties['--notice-marquee-distance'], '240px');

  updateHomeNoticeMarquee(link, { matchMedia: () => ({ matches: false }) });
  assert.equal(classes.has('is-marquee'), false);
});

test('empty home notice cache does not hide a newly published notice', async () => {
  const storage = createStorage();
  const nowMs = Date.parse('2026-10-21T00:00:00Z');
  writeHomeNoticeCache([], { projectId: 'test', storage, nowMs });
  const notices = await fetchHomeNotices({
    config: { projectId: 'test', apiKey: 'key' }, storage, nowMs: nowMs + 1,
    fetchImpl: async () => ({ ok: true, json: async () => [
      firestoreNotice({ id: 'new', title: 'New notice', createdAt: nowMs })
    ] })
  });
  assert.equal(notices[0].id, 'new');
});

test('cached home notices expire at the 14-day boundary', () => {
  const storage = createStorage();
  const nowMs = Date.parse('2026-10-21T00:00:00Z');
  const createdAt = nowMs - 14 * 24 * 60 * 60 * 1000 + 1;
  writeHomeNoticeCache([{ id: 'old', createdAt }], { projectId: 'test', storage, nowMs });
  assert.equal(readHomeNoticeCache({ projectId: 'test', storage, nowMs }).length, 1);
  assert.deepEqual(readHomeNoticeCache({ projectId: 'test', storage, nowMs: nowMs + 1 }), []);
});
