import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicSearchView } from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-view.js';
import { resolvePublicSearchError } from '../../src/domains/stats/sudden-attack/application/search-error-messages.js';

function element() {
  const classes = new Set();
  const children = new Map(), handlers = new Map();
  return {
    handlers,
    value: '', textContent: '', innerHTML: '', dataset: {}, style: {}, disabled: false,
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }
    },
    setAttribute() {},
    addEventListener: (name, handler) => handlers.set(name, handler),
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    },
    querySelectorAll: () => []
  };
}

async function withView(run, options = {}) {
  const keys = ['document', 'window', 'MutationObserver'];
  const previous = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  const ids = new Map(['searchError', 'searchErrorTitle', 'searchErrorMessage', 'formInsightSection'].map((id) => [id, element()]));
  const shell = element();
  const elements = Object.fromEntries([
    'searchInput', 'searchBtn', 'refreshBtn', 'compareBtn', 'favoriteBtn', 'resetBtn',
    'loading', 'loadingText', 'recentSearchesContainer', 'favoriteSearchesContainer',
    'searchGuide', 'profileSection', 'statsSection', 'historySection', 'swrStatus', 'resultsShell', 'resultsMeta'
  ].map((key) => [key, element()]));
  const shares = [], timers = [];
  globalThis.document = { getElementById: (id) => ids.get(id), querySelector: () => shell };
  globalThis.window = { clearInterval() {}, setTimeout: (callback) => timers.push(callback) };
  globalThis.MutationObserver = class { observe() {} };
  try {
    const view = createPublicSearchView({
      elements, getPrimaryUserData: () => null, getActiveSeasonMode: () => 'current',
      setActiveSeasonMode() {}, syncFavoriteButton() {}, onSeasonChange() {},
      onShareProfileChange: (profile) => shares.push(profile), ...options
    });
    await run({ view, elements, ids, shell, shares, timers });
  } finally {
    keys.forEach((key, index) => {
      if (previous[index]) Object.defineProperty(globalThis, key, previous[index]);
      else delete globalThis[key];
    });
  }
}

test('failed search preserves the query and replaces empty results with persistent guidance', async () => {
  await withView(({ view, elements, ids, shell, shares }) => {
    elements.searchInput.value = 'Missing';
    view.setSearchPending(true);
    view.showLoading('Missing');
    view.showSearchError(resolvePublicSearchError(new Error('PLAYER_NOT_FOUND')));
    view.setSearchPending(false);
    assert.equal(elements.searchInput.value, 'Missing');
    assert.equal(elements.searchInput.disabled, false);
    assert.equal(elements.searchBtn.disabled, false);
    assert.equal(ids.get('searchError').classList.contains('hidden'), false);
    assert.match(ids.get('searchErrorTitle').textContent, /캐릭터를 찾을 수 없습니다/);
    assert.match(ids.get('searchErrorMessage').textContent, /다시 검색/);
    for (const key of ['resultsShell', 'profileSection', 'statsSection', 'historySection', 'loading', 'refreshBtn', 'compareBtn', 'favoriteBtn', 'swrStatus', 'resultsMeta']) {
      assert.equal(elements[key].classList.contains('hidden'), true, key);
    }
    assert.equal(shell.classList.contains('results-active'), false);
    assert.deepEqual(shares, [null]);
  });
});

test('retry clears the error and stale completion timers cannot hide the new loading state', async () => {
  await withView(({ view, elements, ids, timers }) => {
    view.showLoading('Missing');
    view.finishLoading();
    view.showSearchError(resolvePublicSearchError(new Error('NETWORK_FAILURE')));
    elements.searchInput.value = 'Tracking';
    view.showLoading('Tracking');
    timers.forEach((callback) => callback());
    assert.equal(ids.get('searchError').classList.contains('hidden'), true);
    assert.equal(elements.loading.classList.contains('hidden'), false);
    assert.equal(elements.resultsShell.classList.contains('hidden'), false);
    assert.match(elements.loadingText.textContent, /Tracking/);
    view.reset();
    assert.equal(ids.get('searchError').classList.contains('hidden'), true);
    assert.equal(elements.searchInput.value, '');
  });
});

for (const fails of [false, true]) {
  test(`old more-matches ${fails ? 'failure' : 'result'} cannot restore a previous profile`, async () => {
    let resolve, reject;
    await withView(async ({ view, elements, shares }) => {
      const a = { player: { nickname: 'A' }, matches: [], stats: {} };
      view.renderProfile(a);
      const button = elements.historySection.querySelector('.match-history-more-btn');
      const pending = button.handlers.get('click')();
      view.showLoading('B');
      if (fails) reject(new Error('old matches failed'));
      else resolve({ matches: [{ matchId: 'A-match' }], hasMore: false });
      await pending;
      assert.equal(a.matchCategoryHistory, undefined);
      assert.deepEqual(shares, [a]);
      assert.match(elements.loadingText.textContent, /B/);
      assert.equal(elements.loading.classList.contains('hidden'), false);
    }, {
      onLoadMoreMatches: () => new Promise((res, rej) => { resolve = res; reject = rej; })
    });
  });
}

test('old category completion cannot enable or rerender the next profile tabs', async () => {
  let resolve;
  await withView(async ({ view, elements, shares }) => {
    const tab = element(); tab.dataset.category = 'party';
    elements.historySection.querySelectorAll = () => [tab];
    const a = { player: { nickname: 'A' }, matches: [], stats: {} };
    view.renderProfile(a);
    const pending = tab.handlers.get('click')();
    assert.equal(tab.disabled, true);
    view.showLoading('B');
    resolve(a);
    await pending;
    assert.equal(tab.disabled, true, 'the old completion must not touch the next view');
    assert.deepEqual(shares, [a]);
    assert.match(elements.loadingText.textContent, /B/);
  }, { onMatchCategoryChange: () => new Promise((res) => { resolve = res; }) });
});

test('a previous completion timer cannot hide a new search loading indicator', async () => {
  await withView(({ view, elements, timers }) => {
    view.showLoading('A'); view.finishLoading();
    view.showLoading('B');
    timers.forEach((fn) => fn());
    assert.equal(elements.loading.classList.contains('hidden'), false);
    assert.match(elements.loadingText.textContent, /B/);
  });
});

test('starting a comparison detaches pending more-matches from the profile view', async () => {
  let resolve;
  await withView(async ({ view, elements, shares }) => {
    const a = { player: { nickname: 'A' }, matches: [], stats: {} };
    view.renderProfile(a);
    const pending = elements.historySection.querySelector('.match-history-more-btn').handlers.get('click')();
    view.invalidatePendingMatches();
    resolve({ matches: [{ matchId: 'A-match' }], hasMore: false });
    await pending;
    assert.equal(a.matchCategoryHistory, undefined);
    assert.deepEqual(shares, [a]);
  }, { onLoadMoreMatches: () => new Promise((res) => { resolve = res; }) });
});

test('more-matches prevents concurrent requests and appends only unseen valid IDs', async () => {
  let complete, calls = 0;
  await withView(async ({ view, elements, shares }) => {
    const first = { matchId: 'first' };
    const profile = { player: { nickname: 'A' }, matches: [first], stats: {} };
    view.renderProfile(profile);
    const button = elements.historySection.querySelector('.match-history-more-btn');
    const pending = button.handlers.get('click')();
    await button.handlers.get('click')();
    assert.equal(calls, 1);
    assert.equal(button.disabled, true);
    complete({ matches: [first, {}, { matchId: 'second' }], hasMore: true });
    await pending;
    assert.deepEqual(profile.matchCategoryHistory.all, { matches: [first, { matchId: 'second' }], hasMore: true });
    assert.deepEqual(elements.historySection.querySelector('sa-match-list').matchRecords,
      [first, { matchId: 'second' }].map(match => ({ ...match, context: 'public' })));
    assert.deepEqual(shares, [profile, profile]);
  }, { onLoadMoreMatches: (_category, matches) => {
    calls += 1;
    assert.equal(matches[0].matchId, 'first');
    return new Promise(resolve => { complete = resolve; });
  } });
});

test('more-matches stops pagination when the server returns only existing matches', async () => {
  await withView(async ({ view, elements }) => {
    const profile = { player: { nickname: 'A' }, matches: [{ matchId: 'same' }], stats: {} };
    view.renderProfile(profile);
    await elements.historySection.querySelector('.match-history-more-btn').handlers.get('click')();
    assert.equal(profile.matchCategoryHistory.all.hasMore, false);
    assert.equal(profile.matchCategoryHistory.all.matches.length, 1);
    assert.match(elements.historySection.innerHTML, /조회 가능한 이전 경기 기록을 모두 표시했습니다/);
  }, { onLoadMoreMatches: async () => ({ matches: [{ matchId: 'same' }], hasMore: true }) });
});

test('current category completion clears pending tabs before rendering the selected history', async () => {
  let category = 'all', complete;
  await withView(async ({ view, elements }) => {
    const tab = element(); tab.dataset.category = 'party';
    elements.historySection.querySelectorAll = () => [tab];
    const profile = { player: { nickname: 'A' }, matches: [], stats: {},
      matchCategoryViews: { party: { label: '파티랭크', matches: [{ matchId: 'party' }], stats: {} } } };
    view.renderProfile(profile);
    const pending = tab.handlers.get('click')();
    assert.equal(tab.disabled, true);
    assert.equal(tab.classList.contains('loading'), true);
    category = 'party'; complete(profile);
    await pending;
    assert.equal(tab.disabled, false);
    assert.equal(tab.classList.contains('loading'), false);
    assert.match(elements.historySection.innerHTML, /파티랭크 매치 기록/);
    assert.equal(elements.historySection.querySelector('sa-match-list').matchRecords[0].matchId, 'party');
    assert.equal(elements.statsSection.querySelector('#seasonStatsSummary').sourceHeader, '');
  }, { getActiveMatchCategory: () => category,
    onMatchCategoryChange: () => new Promise(resolve => { complete = resolve; }) });
});

test('profile metadata escapes markup while activity and sharing retain original player data', async () => {
  const name = '<b>위장닉</b> & "Tracking"';
  const label = '<i>최근</i> & 기록';
  const calls = [];
  await withView(async ({ view, elements, shares }) => {
    const profile = { player: { nickname: name, ouid: 'stable-ouid' }, stats: {},
      seasonViews: { current: { label, matches: [], stats: {} } } };
    view.renderProfile(profile);
    assert.match(elements.resultsMeta.innerHTML, /&lt;b&gt;위장닉&lt;\/b&gt; &amp; &quot;Tracking&quot;/);
    assert.match(elements.resultsMeta.innerHTML, /&lt;i&gt;최근&lt;\/i&gt; &amp; 기록/);
    assert.match(elements.historySection.innerHTML, /&lt;i&gt;최근&lt;\/i&gt; &amp; 기록 매치 기록/);
    const card = elements.profileSection.querySelector('sa-player-card');
    assert.equal(card.player.nickname, name);
    const progress = () => {};
    await card.activityLoader(null, progress);
    await card.activityDayLoader(null, [], '2026-10-25');
    assert.deepEqual(calls, [[profile.player, progress], [profile.player, [], '2026-10-25']]);
    assert.equal(shares[0], profile);
  }, { loadPlayerActivity: (...args) => calls.push(args), loadPlayerActivityDay: (...args) => calls.push(args) });
});

test('partial category failure keeps current history and displays an inline retry notice', async()=>{
  await withView(async({view,elements,shares})=>{
    const tab=element();tab.dataset.category='party';
    elements.historySection.querySelectorAll=()=>[tab];
    const profile={player:{nickname:'Fixture'},matches:[{matchId:'good'}],stats:{}};
    view.renderProfile(profile);
    await tab.handlers.get('click')();
    assert.equal(tab.disabled,false);
    assert.deepEqual(shares,[profile]);
    assert.equal(profile.matchCategoryViews,undefined);
    assert.match(elements.historySection.querySelector('.match-query-notice').textContent,/일부 경기 유형/);
  },{onMatchCategoryChange:async()=>{throw Object.assign(new Error('private'),{code:'MATCH_QUERY_PARTIAL'});}});
});

test('VS cards, table and radar receive the same previous-window data instead of current profile stats',async()=>{
  await withView(({view,elements})=>{
    const profile=(nickname,old)=>({player:{nickname},stats:{kdPercent:99},seasonViews:{
      current:{stats:{kdPercent:80,totalMatchesCount:20},matches:[{matchId:'current'}]},
      previous:{stats:old,matches:[{matchId:'previous'}]}
    }});
    const a=profile('A',{kdPercent:30,totalMatchesCount:6,radar:{combat:30}});
    const b=profile('B',{kdPercent:70,totalMatchesCount:20,radar:{combat:70}});
    view.renderVs(a,b);
    const payload=elements.statsSection.querySelector('#vsStats').vsModeData;
    assert.equal(payload.primary.kdPercent,30);assert.equal(payload.target.kdPercent,70);
    assert.equal(payload.primary.totalMatchesCount,6);assert.match(payload.comparisonLabel,/21~40/);
    for(const [id,value] of [['#primaryCard',30],['#targetCard',70]]) {
      const card=elements.profileSection.querySelector(id).player;
      assert.equal(card.kdPercent,value);assert.equal(card.context,'public');
      assert.deepEqual(card.recentMatches,[{matchId:'previous'}]);
    }
  },{getActiveSeasonMode:()=> 'previous'});
});
