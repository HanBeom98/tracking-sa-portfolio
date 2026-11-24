import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { escapeHtml } from '../../src/domains/shared/html.js';
import { getVsComparisonData } from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-presenters.js';
import { createViewRequestTracker } from '../../src/domains/stats/sudden-attack/ui/runtime/view-request-tracker.js';
import { recordOperation, requestFailureCode } from '../../src/domains/shared/http-request.js';
import { createSearchMeasurement } from '../../src/domains/stats/sudden-attack/ui/runtime/search-measurement.js';
import { createActionMeasurement } from '../../src/domains/stats/sudden-attack/ui/runtime/action-measurement.js';
import { renderFavoriteSearchButton } from '../../src/domains/stats/sudden-attack/ui/utils/ui-helpers.js';
import { createProductAnalytics } from '../../src/shared/assets/product-analytics.js';
import { measurementBrowser } from '../helpers/measurement-browser.js';

function element() {
  const classes = new Set(['hidden']);
  const children = new Map();
  const listeners = new Map();
  return {
    value: '', innerHTML: '', textContent: '', disabled: false, dataset: {}, style: {},
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    },
    addEventListener: (name, fn) => listeners.set(name, fn),
    dispatch: (name, event = {}) => listeners.get(name)?.(event),
    appendChild() {}, focus() {}, setAttribute() {},
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    },
    querySelectorAll: () => [],
  };
}

const profile = (name, options = {}) => ({
  player: { nickname: name, ouid: name }, matches: [], stats: {}, querySource: 'network', ...options,
});

// Execute the real entry-point handlers with network and DOM adapters replaced.
// This checks their wiring, including callback/catch/finally and browser history.
async function pageHarness(page) {
  const browser = measurementBrowser(), productEvents = [];
  const client = createProductAnalytics({ getPageContext: () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/' }), now: browser.window.performance.now });
  client.setTransport((name, fields) => productEvents.push({ name, ...fields }));
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const events = [], requests = [], listeners = new Map(), alerts = [], errors = [], favorites = new Set();
  let viewOptions;
  const window = {
    ...browser.window, trackingSaProductAnalytics: client,
    db: {}, location: new URL('https://trackingsa.com/stats/sudden-attack/'),
    addEventListener(name, listener) {
      const previous = listeners.get(name);
      listeners.set(name, previous ? (...args) => { previous(...args); listener(...args); } : listener);
    }, scrollTo() {},
    history: { pushState: (_state, _title, url) => { window.location = new URL(url); } },
  };
  const context = {
    window, URL, URLSearchParams, document: { ...browser.document, getElementById: node, createElement: element },
    console: { log() {}, error: (...args) => errors.push(args) },
    alert: (message) => alerts.push(message), requestAnimationFrame: (fn) => fn(),
    setTimeout, escapeHtml, getVsComparisonData, createViewRequestTracker, createSearchMeasurement, createActionMeasurement, recordOperation, requestFailureCode,
    getCurrentUser: () => null, requireAuth: async () => null, subscribeAuthState: () => () => {},
    createSaApplication: () => ({ crewRepo: { isStaff: () => false }, repository: {}, service: {}, pageUseCases: {
      loadPlayerProfile(name, rankings, onFreshData, options) {
        return new Promise((resolve, reject) => requests.push({ name, onFreshData, options,
          resolve(value) { options?.onQueryState?.({ source: value.querySource, revalidating: value.isStale }); resolve(value); }, reject }));
      },
      loadCrewDashboard: async () => ({ rankings: [], formattedDate: '', highlights: [] }),
      loadPublicMatchCategory: () => new Promise((resolve, reject) => { context.resolveCategory = resolve; context.rejectCategory = reject; }),
      invalidatePublicMatchCategories() {},
    } }),
    BalancerManager: class { updateRankings() {} },
    AdminManager: class { adminMenuBtn = node('adminMenuBtn'); updateRankings() {} },
    createShareCardController: (options) => { context.shareOptions = options; return { render() {} }; }, createShareCardModel() {},
    createPublicSearchView(options) {
      viewOptions = options;
      return {
        invalidatePendingMatches() {},
        updateSearchGuide() {},
        setSearchPending: (pending) => { node('characterName').disabled = pending; events.push(['pending', pending]); },
        showLoading: (name) => { node('loading').classList.remove('hidden'); events.push(['loading', name]); },
        finishLoading: () => { node('loading').classList.add('hidden'); events.push(['finish']); },
        renderProfile: (value) => { events.push(['profile', value]); options.onProfileRendered?.(value, { isConnected: true }); },
        renderVs: (primary, target) => events.push(['vs', primary, target]),
        reset: () => { node('loading').classList.add('hidden'); node('characterName').value = ''; events.push(['reset']); },
        showSearchError: (error) => events.push(['error', error]),
      };
    },
    updateSwrUI: (_element, type) => events.push(['swr', type]),
    saveSearch: (_key, name) => events.push(['saved', name]),
    renderRecentSearches: (_container, _key, search) => { context.recentSearch = search; },
    renderFavoriteSearches: (_container, _key, search, remove, compare) => { context.favoriteSearch = search; context.removeFavorite = remove; context.compareFavorite = compare; }, clearRecentSearches() {},
    removeFavoriteSearch: (_key, name) => favorites.delete(name.toLowerCase()),
    toggleFavoriteSearch(_key, name) { const key = name.toLowerCase(); if (favorites.has(key)) favorites.delete(key); else favorites.add(key); },
    isFavoriteSearch: (_key, name) => favorites.has(name.toLowerCase()),
    renderFavoriteSearchButton,
    resolvePublicSearchError: (error) => ({ message: error.message }), resolvePlayerNotFoundMessage: () => null,
  };
  const source = readFileSync(`src/domains/stats/sudden-attack/${page === 'public' ? 'home-main' : 'main'}.js`, 'utf8');
  const executable = source.replace(/^import .*;\r?\n/gm, '');
  const runtime = ['public-search-history', 'sa-page-runtime'].map((name) =>
    readFileSync(`src/domains/stats/sudden-attack/ui/runtime/${name}.js`, 'utf8').replace(/^export /gm, '')
  ).join('\n');
  runInNewContext(`${runtime}\n${executable}\n globalThis.api = {handleSearch, resetSearchState, executeVsMode, runFavoriteVsCompare, getProfile: () => primaryUserData, selectSeason: mode => { activeSeasonMode = mode; }};`, context);
  await new Promise(setImmediate);
  return { ...context.api, node, requests, events, alerts, errors, listeners, window,
    getViewOptions: () => viewOptions, resolveCategory: (value) => context.resolveCategory(value), rejectCategory: (error) => context.rejectCategory(error),
    productEvents, browser, recentSearch: (...args) => context.recentSearch(...args), favoriteSearch: (...args) => context.favoriteSearch(...args),
    removeFavorite: (...args) => context.removeFavorite(...args), getShareOptions: () => context.shareOptions };
}

for (const page of ['public', 'league']) {
  test(`${page}: late A result cannot replace B or save A into recent searches`, async () => {
    const h = await pageHarness(page);
    const a = h.handleSearch('A');
    const b = h.handleSearch('B');
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve(profile('B'));
    await b;
    const before = h.events.length;
    h.requests[0].resolve(profile('A'));
    await a;
    assert.equal(h.getProfile().player.nickname, 'B');
    assert.equal(h.node('characterName').value, 'B');
    assert.equal(h.window.location.searchParams.get('n'), 'B');
    assert.equal(h.events.length, before);
    assert.deepEqual(h.events.filter(([type]) => type === 'saved'), [['saved', 'B']]);
  });

  test(`${page}: late A failure/finally cannot stop B loading or display an error`, async () => {
    const h = await pageHarness(page);
    const a = h.handleSearch('A');
    const b = h.handleSearch('B');
    const before = h.events.length;
    h.requests[0].reject(new Error('A failed'));
    await a;
    assert.equal(h.events.length, before);
    assert.equal(h.node('loading').classList.contains('hidden'), false);
    if (page === 'public') assert.equal(h.node('characterName').disabled, true);
    assert.equal(h.alerts.length + h.errors.length, 0);
    h.requests[1].resolve(profile('B'));
    await b;
    assert.equal(h.getProfile().player.nickname, 'B');
  });

  test(`${page}: old background success and failure cannot change B`, async () => {
    const h = await pageHarness(page);
    const a = h.handleSearch('A');
    h.requests[0].resolve(profile('A', { isStale: true }));
    await a;
    const b = h.handleSearch('B');
    const before = h.events.length;
    h.requests[0].onFreshData(profile('A'));
    h.requests[0].onFreshData(null, { error: new Error('old revalidation failed') });
    assert.equal(h.events.length, before);
    assert.equal(h.node('loading').classList.contains('hidden'), false);
    h.requests[1].resolve(profile('B'));
    await b;
    const after = h.events.length;
    h.requests[0].onFreshData(profile('A'));
    assert.equal(h.getProfile().player.nickname, 'B');
    assert.equal(h.events.length, after);
  });

  for (const mode of ['foreground', 'background']) {
    test(`${page}: browser back to the empty view invalidates ${mode} updates`, async () => {
      const h = await pageHarness(page);
      const a = h.handleSearch('A');
      if (mode === 'background') { h.requests[0].resolve(profile('A', { isStale: true })); await a; }
      h.window.location = new URL('https://trackingsa.com/stats/sudden-attack/');
      h.listeners.get('popstate')({ state: {} });
      const before = h.events.length;
      if (mode === 'foreground') { h.requests[0].resolve(profile('A')); await a; }
      else h.requests[0].onFreshData(profile('A'));
      assert.equal(h.getProfile(), null);
      assert.equal(h.node('characterName').value, '');
      assert.equal(h.node('loading').classList.contains('hidden'), true);
      assert.equal(h.events.length, before);
    });
  }

  for (const comparison of ['executeVsMode', 'runFavoriteVsCompare']) {
    test(`${page}: superseded ${comparison} success/error cannot alter a new search`, async () => {
      for (const fails of [false, true]) {
        const h = await pageHarness(page);
        const a = h.handleSearch('A'); h.requests[0].resolve(profile('A', { isStale: true })); await a;
        h.node('vsTargetName').value = 'Target';
        const compare = h[comparison]('Target');
        const beforeBackground = h.events.length;
        h.requests[0].onFreshData(profile('A'));
        assert.equal(h.events.length, beforeBackground, 'profile refresh must not interrupt comparison');
        const b = h.handleSearch('B');
        const before = h.events.length;
        if (fails) h.requests[1].reject(new Error('comparison failed'));
        else h.requests[1].resolve(profile('Target'));
        await compare;
        assert.equal(h.events.length, before);
        assert.equal(h.node('loading').classList.contains('hidden'), false);
        assert.equal(h.alerts.length + h.errors.length, 0);
        h.requests[2].resolve(profile('B')); await b;
        assert.equal(h.getProfile().player.nickname, 'B');
      }
    });
  }

  test(`${page}: immediate background data cannot be replaced by the initial stale result`, async () => {
    const h = await pageHarness(page);
    const a = h.handleSearch('A');
    const fresh = profile('A', { revision: 2 });
    h.requests[0].onFreshData(fresh);
    h.requests[0].resolve(profile('A', { revision: 1, isStale: true }));
    await a;
    assert.equal(h.getProfile().revision, 2);
    assert.deepEqual(h.events.filter(([type]) => type === 'swr').map(([, type]) => type), ['hide', 'fresh']);
  });

  test(`${page}: the current background callback still updates its own profile`, async () => {
    const h = await pageHarness(page);
    const a = h.handleSearch('A'); h.requests[0].resolve(profile('A', { isStale: true })); await a;
    h.requests[0].onFreshData(profile('A', { revision: 2 }));
    assert.equal(h.getProfile().revision, 2);
    assert.equal(h.events.at(-1)[1], 'fresh');
  });
}

test('public: a late category response cannot attach A matches to B', async () => {
  const h = await pageHarness('public');
  const a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a;
  const category = h.getViewOptions().onMatchCategoryChange('party');
  const b = h.handleSearch('B'); h.requests[1].resolve(profile('B')); await b;
  h.resolveCategory({ matches: [{ matchId: 'A-match' }] });
  assert.equal(await category, null);
  assert.equal(h.getProfile().player.nickname, 'B');
  assert.equal(h.getProfile().matchCategoryViews, undefined);
});

test('public measurement ignores blank input and records each real search entry point', async () => {
  const h = await pageHarness('public');
  await h.handleSearch(); assert.equal(h.productEvents.length, 0);
  await h.handleSearch('   ', true, false, 'direct_link'); assert.equal(h.requests.length, 0);
  h.node('characterName').value = 'A';
  const click = h.node('searchBtn').dispatch('click'); h.requests.at(-1).resolve(profile('A')); await click; h.browser.paint();
  h.node('characterName').dispatch('keypress', { key: 'Enter' }); h.requests.at(-1).resolve(profile('A')); await new Promise(setImmediate); h.browser.paint();
  const recent = h.recentSearch('A'); h.requests.at(-1).resolve(profile('A')); await recent; h.browser.paint();
  const favorite = h.favoriteSearch('A'); h.requests.at(-1).resolve(profile('A')); await favorite; h.browser.paint();
  const refresh = h.node('refreshBtn').dispatch('click'); h.requests.at(-1).resolve(profile('A')); await refresh; h.browser.paint();
  h.listeners.get('popstate')({ state: { name: 'A' } }); h.requests.at(-1).resolve(profile('A')); await new Promise(setImmediate); h.browser.paint();
  h.listeners.get('sa-request-search')({ detail: { name: 'A' } }); h.requests.at(-1).resolve(profile('A')); await new Promise(setImmediate); h.browser.paint();
  assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_search_start').map(e => e.entry_point),
    ['input_button', 'input_enter', 'recent', 'favorite', 'refresh', 'history', 'in_page']);
  assert.equal(h.productEvents.filter(e => e.name === 'sa_search_finish' && e.outcome === 'success').length, 7);
});

test('public measurement keeps first stale result distinct from failed background revalidation', async () => {
  const h = await pageHarness('public');
  const a = h.handleSearch('A'); h.requests[0].resolve(profile('A', { isStale: true, querySource: 'stale_cache' })); await a; h.browser.paint();
  assert.equal(h.productEvents.filter(e => e.name === 'sa_search_finish').length, 0);
  h.requests[0].onFreshData(null, { error: { code: 'REQUEST_TIMEOUT' } });
  const finish = h.productEvents.find(e => e.name === 'sa_search_finish');
  assert.deepEqual([finish.outcome, finish.result_shown, finish.result_source, finish.revalidation, finish.error_code], ['partial', 1, 'stale_cache', 'failure', 'timeout']);
});

test('public measurement handles fast SWR and ignores late callbacks after a new search', async () => {
  const h = await pageHarness('public'), a = h.handleSearch('A');
  h.requests[0].options.onQueryState({ source: 'stale_cache', revalidating: true });
  h.requests[0].onFreshData(profile('A'));
  h.requests[0].resolve(profile('A', { isStale: true, querySource: 'stale_cache' })); await a; h.browser.paint();
  assert.equal(h.productEvents.find(e => e.name === 'sa_search_first_result').result_source, 'network');
  assert.equal(h.productEvents.find(e => e.name === 'sa_search_finish').revalidation, 'success');
  const b = h.handleSearch('B'), c = h.handleSearch('C');
  h.requests[1].reject({ code: 'REQUEST_TIMEOUT' }); await b;
  h.requests[2].resolve(profile('C')); await c; h.browser.paint();
  assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_search_finish').map(e => e.outcome), ['success', 'superseded', 'success']);
});

for (const comparison of ['executeVsMode', 'runFavoriteVsCompare']) {
  test(`public measurement closes a stale search on ${comparison} without counting VS as a search`, async () => {
    const h = await pageHarness('public'), a = h.handleSearch('A');
    h.requests[0].resolve(profile('A', { isStale: true, querySource: 'stale_cache' })); await a; h.browser.paint();
    h.node('vsTargetName').value = 'B'; const vs = h[comparison]('B');
    h.requests[0].onFreshData(profile('A'));
    h.requests[1].resolve(profile('B')); await vs; h.browser.paint();
    assert.equal(h.productEvents.filter(e => e.name === 'sa_search_start').length, 1);
    assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_search_finish').map(e => [e.outcome, e.revalidation]), [['superseded', 'interrupted']]);
  });
}

test('public reset and pagehide close each unfinished attempt once', async () => {
  const h = await pageHarness('public'), a = h.handleSearch('A'); h.resetSearchState();
  h.requests[0].resolve(profile('A')); await a; h.browser.paint();
  const b = h.handleSearch('B'); h.listeners.get('pagehide')(); h.listeners.get('pagehide')();
  h.requests[1].resolve(profile('B')); await b; h.browser.paint();
  assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_search_finish').map(e => [e.outcome, e.result_shown]), [['cancelled', 0], ['cancelled', 0]]);
});

test('league handlers do not start public product measurements', async () => {
  const h = await pageHarness('league'), a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a; h.browser.paint();
  assert.deepEqual(h.productEvents, []);
});

test('public favorite state events follow result-button and chip updates without counting a stale removal twice', async () => {
  const h = await pageHarness('public'), a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a;
  h.node('favoriteBtn').dispatch('click'); h.node('favoriteBtn').dispatch('click'); h.node('favoriteBtn').dispatch('click');
  h.removeFavorite('A'); h.removeFavorite('A');
  assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_favorite_change').map(e => [e.action, e.action_source, e.persistence]), [
    ['add', 'result_button', 'unknown'], ['remove', 'result_button', 'unknown'], ['add', 'result_button', 'unknown'], ['remove', 'favorite_chip', 'unknown'],
  ]);
});

for (const comparison of ['executeVsMode', 'runFavoriteVsCompare']) {
  test(`public ${comparison} distinguishes validation, cached DOM completion and OUID-alias rejection`, async () => {
    const h = await pageHarness('public'); await h[comparison]('B');
    const a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a;
    h.node('vsTargetName').value = 'a'; await h[comparison]('a');
    assert.equal(h.productEvents.filter(e => e.name === 'sa_vs_start').length, 0);
    h.node('vsTargetName').value = 'B'; const vs = h[comparison]('B');
    h.requests[1].resolve(profile('B', { querySource: 'stale_cache' })); await vs;
    const finishes = () => h.productEvents.filter(e => e.name === 'sa_vs_finish');
    assert.deepEqual([finishes()[0].outcome, finishes()[0].result_source, finishes()[0].vs_source], ['success', 'stale_cache', comparison === 'executeVsMode' ? 'modal' : 'favorite_chip']);
    h.node('vsTargetName').value = 'Alias'; const alias = h[comparison]('Alias');
    h.requests[2].resolve(profile('Alias', { player: { nickname: 'Alias', ouid: 'A' } })); await alias;
    assert.deepEqual([finishes()[1].outcome, finishes()[1].error_code], ['failure', 'same_player']);
  });

  test(`public ${comparison} finishes timeout and supersession once and ignores the old response`, async () => {
    const h = await pageHarness('public'), a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a;
    h.node('vsTargetName').value = 'B'; const failed = h[comparison]('B');
    h.requests[1].reject({ code: 'REQUEST_TIMEOUT', message: 'private error' }); await failed;
    const old = h[comparison]('B'); const next = h.handleSearch('C');
    h.requests[2].resolve(profile('B')); await old;
    h.requests[3].resolve(profile('C')); await next;
    assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_vs_finish').map(e => [e.outcome, e.error_code]), [['failure', 'timeout'], ['superseded', undefined]]);
    assert.ok(!JSON.stringify(h.productEvents).includes('private error'));
  });
}

test('public VS pagehide/reset cancellation coexists with the search observer and late response guards', async () => {
  const h = await pageHarness('public'), a = h.handleSearch('A'); h.requests[0].resolve(profile('A')); await a; h.browser.paint();
  const vs = h.runFavoriteVsCompare('B'); h.listeners.get('pagehide')(); h.listeners.get('pagehide')();
  h.requests[1].resolve(profile('B')); await vs;
  const next = h.runFavoriteVsCompare('C'); h.resetSearchState(); h.requests[2].resolve(profile('C')); await next;
  assert.deepEqual(h.productEvents.filter(e => e.name === 'sa_vs_finish').map(e => e.outcome), ['cancelled', 'cancelled']);
  assert.equal(h.productEvents.filter(e => e.name === 'sa_search_finish').length, 1);
});

test('public entry point injects action measurement into the existing share controller', async () => {
  const h = await pageHarness('public');
  h.getShareOptions().startMeasurement('link_button').finish('clipboard_link', 'success');
  assert.deepEqual(h.productEvents.map(e => e.name), ['sa_share_start', 'sa_share_finish']);
});

test('a failed category query preserves the displayed previous window and category selection',async()=>{
  const h=await pageHarness('public');
  const search=h.handleSearch('Fixture');h.requests[0].resolve(profile('Fixture'));await search;
  const view=h.getViewOptions();view.setActiveSeasonMode('previous');
  const pending=view.onMatchCategoryChange('party');
  h.rejectCategory({code:'MATCH_QUERY_PARTIAL'});
  await assert.rejects(pending,{code:'MATCH_QUERY_PARTIAL'});
  assert.equal(view.getActiveSeasonMode(),'previous');
  assert.equal(view.getActiveMatchCategory(),'all');
  assert.equal(h.getProfile().matchCategoryViews,undefined);
});

test('league VS passes the selected previous-season stats and scores to the real summary component',async()=>{
  const h=await pageHarness('league');
  const make=name=>profile(name,{stats:{kdPercent:99,crewMmr:1500},seasonViews:{
    current:{stats:{kdPercent:80,crewMmr:1400,totalMatchesCount:20}},
    previous:{stats:{kdPercent:30,crewMmr:1250,crewHsr:1260,isCrew:true,totalMatchesCount:6}}
  }});
  const search=h.handleSearch('A');h.requests[0].resolve(make('A'));await search;
  h.selectSeason('previous');
  h.node('vsTargetName').value='B';
  const pending=h.executeVsMode('B');h.requests[1].resolve(make('B'));await pending;
  const payload=h.node('statsSummary').querySelector('#vsStats').vsModeData;
  assert.equal(payload.comparisonLabel,'지난 시즌');
  for(const side of ['primary','target']) {
    assert.equal(payload[side].kdPercent,30);assert.equal(payload[side].crewMmr,1250);
    assert.equal(payload[side].crewHsr,1260);assert.equal(payload[side].totalMatchesCount,6);
  }
});
