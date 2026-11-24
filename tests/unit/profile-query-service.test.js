import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileQueryService } from '../../src/domains/stats/sudden-attack/application/profile-query-service.js';
import { SaProfileCache } from '../../src/domains/stats/sudden-attack/application/sa-profile-cache.js';
import { SaPageUseCases } from '../../src/domains/stats/sudden-attack/application/sa-page-use-cases.js';

function createCache(entry) {
  return {
    buildKey: (name, scope) => `${scope || 'default'}:${name.toLowerCase()}`,
    get: () => entry,
    set: () => {},
  };
}

test('stale profile revalidation completes even when fresh data is unchanged', async () => {
  const cachedData = { player: { nickname: 'Tracking' }, matches: [] };
  const query = new ProfileQueryService(
    { fetchFreshData: async () => cachedData },
    createCache({ data: cachedData, timestamp: 1 }),
    { freshTtlMs: 1 },
  );

  let resolveCompleted;
  const completed = new Promise((resolve) => { resolveCompleted = resolve; });
  const result = await query.getFullPlayerProfile(
    'Tracking',
    [],
    (fresh, update) => resolveCompleted({ fresh, update }),
  );
  const background = await completed;

  assert.equal(result.isStale, true);
  assert.equal(result.querySource, 'stale_cache');
  assert.equal(background.fresh.isStale, false);
  assert.equal(background.fresh.querySource, 'network');
  assert.equal(background.update.changed, false);
});

test('stale profile revalidation reports background failures', async () => {
  const cachedData = { player: { nickname: 'Tracking' }, matches: [] };
  const expectedError = new Error('network failed');
  const query = new ProfileQueryService(
    { fetchFreshData: async () => { throw expectedError; } },
    createCache({ data: cachedData, timestamp: 1 }),
    { freshTtlMs: 1 },
  );

  let resolveCompleted;
  const completed = new Promise((resolve) => { resolveCompleted = resolve; });
  const result = await query.getFullPlayerProfile(
    'Tracking',
    [],
    (fresh, update) => resolveCompleted({ fresh, update }),
  );
  const background = await completed;

  assert.equal(result.isStale, true);
  assert.equal(background.fresh, null);
  assert.equal(background.update.error, expectedError);
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createStoredCache({ failRemoval = false } = {}) {
  const entries = new Map();
  return new SaProfileCache({
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => {
      if (failRemoval) throw new Error('storage unavailable');
      entries.delete(key);
    },
  });
}

for (const scope of ['public', 'league']) {
  test(`${scope} refresh bypasses both memory and persistent profile cache`, async () => {
    let calls = 0;
    const cache = createStoredCache();
    const query = new ProfileQueryService({ fetchFreshData: async () => ({ revision: ++calls }) }, cache);
    const useCases = new SaPageUseCases({ profileQueryService: query });
    await useCases.loadPlayerProfile('Tracking', [], null, { scope });
    assert.equal((await useCases.loadPlayerProfile('Tracking', [], null, { scope })).revision, 1);
    const fresh = await useCases.loadPlayerProfile('Tracking', [], null, { scope, forceRefresh: true });
    assert.equal(fresh.revision, 2);
    assert.equal(fresh.isStale, false);
    const anotherPage = new ProfileQueryService({ fetchFreshData: () => assert.fail('cache should be fresh') }, cache);
    assert.equal((await anotherPage.getFullPlayerProfile('Tracking', [], null, { scope })).revision, 2);
  });
}

test('profile refresh only invalidates the matching normalized name and scope', async () => {
  let calls = 0;
  const query = new ProfileQueryService({ fetchFreshData: async () => ({ revision: ++calls }) }, createStoredCache());
  await query.getFullPlayerProfile('Tracking', [], null, { scope: 'public' });
  await query.getFullPlayerProfile('Tracking', [], null, { scope: 'league' });
  await query.getFullPlayerProfile('Other', [], null, { scope: 'public' });
  await query.getFullPlayerProfile(' TRACKING ', [], null, { scope: 'public', forceRefresh: true });
  assert.equal((await query.getFullPlayerProfile('Tracking', [], null, { scope: 'public' })).revision, 4);
  assert.equal((await query.getFullPlayerProfile('Tracking', [], null, { scope: 'league' })).revision, 2);
  assert.equal((await query.getFullPlayerProfile('Other', [], null, { scope: 'public' })).revision, 3);
  assert.equal(calls, 4);
});

for (const fails of [false, true]) {
  test(`refresh supersedes old foreground ${fails ? 'failure' : 'result'} without losing new deduplication`, async () => {
    const requests = [];
    const query = new ProfileQueryService({ fetchFreshData: () => {
      const request = deferred(); requests.push(request); return request.promise;
    } }, createStoredCache());
    const old = query.getFullPlayerProfile('Tracking');
    const fresh = query.getFullPlayerProfile('Tracking', [], null, { forceRefresh: true });
    assert.equal(requests.length, 2);
    if (fails) requests[0].reject(new Error('old request failed'));
    else requests[0].resolve({ revision: 1 });
    await new Promise(setImmediate);
    const duplicate = query.getFullPlayerProfile('Tracking');
    assert.equal(requests.length, 2);
    requests[1].resolve({ revision: 2 });
    const results = await Promise.all([old, fresh, duplicate]);
    assert.ok(results.every((result) => result.revision === 2));
    assert.equal((await query.getFullPlayerProfile('Tracking')).revision, 2);
  });
}

for (const fails of [false, true]) {
  test(`old background ${fails ? 'failure' : 'result'} cannot overwrite a refreshed profile or notify its view`, async () => {
    const cache = createStoredCache();
    cache.set(cache.buildKey('Tracking'), { revision: 0 }, 1);
    const requests = [];
    const query = new ProfileQueryService({ fetchFreshData: () => {
      const request = deferred(); requests.push(request); return request.promise;
    } }, cache);
    let updates = 0;
    const stale = await query.getFullPlayerProfile('Tracking', [], () => { updates++; });
    assert.equal(stale.isStale, true);
    const fresh = query.getFullPlayerProfile('Tracking', [], null, { forceRefresh: true });
    requests[1].resolve({ revision: 2 });
    await fresh;
    if (fails) requests[0].reject(new Error('expired request failed'));
    else requests[0].resolve({ revision: 1 });
    await new Promise(setImmediate);
    assert.equal(updates, 0);
    assert.equal((await query.getFullPlayerProfile('Tracking')).revision, 2);
    assert.equal(cache.get(cache.buildKey('Tracking')).data.revision, 2);
  });
}

test('refresh does not revive persistent data when storage removal fails', async () => {
  const cache = createStoredCache({ failRemoval: true });
  let calls = 0;
  const query = new ProfileQueryService({ fetchFreshData: async () => ({ revision: ++calls }) }, cache);
  await query.getFullPlayerProfile('Tracking');
  assert.equal((await query.getFullPlayerProfile('Tracking', [], null, { forceRefresh: true })).revision, 2);
  assert.equal(calls, 2);
});

test('query sources explicitly distinguish network, fresh cache and forced refresh without storing metadata', async () => {
  const cache = createStoredCache(), states = [], options = [];
  const query = new ProfileQueryService({ fetchFreshData: async (_name, _rankings, opts) => { options.push(opts); return { revision: options.length }; } }, cache);
  const observe = state => states.push(state);
  assert.equal((await query.getFullPlayerProfile('A', [], null, { scope: 'public', onQueryState: observe })).querySource, 'network');
  assert.equal((await query.getFullPlayerProfile('A', [], null, { scope: 'public', onQueryState: observe })).querySource, 'fresh_cache');
  assert.equal((await query.getFullPlayerProfile('A', [], null, { scope: 'public', forceRefresh: true, onQueryState: observe })).querySource, 'network');
  assert.deepEqual(states.map(s => s.source), ['network', 'fresh_cache', 'network']);
  assert.ok(options.every(opts => !Object.hasOwn(opts, 'onQueryState')));
  assert.equal(cache.get(cache.buildKey('A', 'public')).data.querySource, undefined);
});

test('stale query notifies revalidation before returning and optional observer errors cannot fail it', async () => {
  const pending = deferred(), states = [];
  const query = new ProfileQueryService({ fetchFreshData: () => pending.promise }, createCache({ data: { revision: 1 }, timestamp: 1 }));
  const result = query.getFullPlayerProfile('A', [], null, { onQueryState: state => { states.push(state); throw new Error('observer failed'); } });
  assert.deepEqual(states, [{ source: 'stale_cache', revalidating: true }]);
  assert.equal((await result).querySource, 'stale_cache');
  pending.resolve({ revision: 2 }); await new Promise(setImmediate);
  assert.equal((await query.getFullPlayerProfile('A')).querySource, 'fresh_cache');
});
