import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { ProfileQueryService } from '../../src/domains/stats/sudden-attack/application/profile-query-service.js';
import { SaProfileCache } from '../../src/domains/stats/sudden-attack/application/sa-profile-cache.js';
import { readBoardListCache, writeBoardListCache, clearBoardListCache } from '../../src/domains/board/application/board-list-cache.js';
import { readCommentListCache, writeCommentListCache, clearCommentListCache } from '../../src/domains/board/application/comment-list-cache.js';
import { readHomeNoticeCache, writeHomeNoticeCache, fetchHomeNotices } from '../../src/domains/home/notice-ticker.js';
import { getRecentSearches, saveSearch, clearRecentSearches, getFavoriteSearches, toggleFavoriteSearch, removeFavoriteSearch } from '../../src/domains/stats/sudden-attack/ui/utils/ui-helpers.js';
import { applyCurrentLangTranslations } from '../../src/domains/account/ui/account-renderer.js';

const fail = () => { throw Object.assign(new Error('Browser storage blocked'), { name: 'SecurityError' }); };
const unavailable = { getItem: fail, setItem: fail, removeItem: fail };
const full = { getItem: () => null, setItem() { throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' }); }, removeItem: fail };

async function withStorage(mode, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', mode === 'getter'
    ? { configurable: true, get: fail }
    : { configurable: true, writable: true, value: mode === 'quota' ? full : unavailable });
  try { return await run(); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
}

function runtimeContext(mode) {
  const classes = new Set();
  const classList = {
    add: (key) => classes.add(key), remove: (key) => classes.delete(key),
    toggle(key, force = !classes.has(key)) { if (force) classes.add(key); else classes.delete(key); return force; },
  };
  const themeButton = {};
  const events = [];
  const root = {
    console, URL, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setInterval: () => ({ unref() {} }), clearInterval() {},
    translations: { ko: {} }, dispatchEvent: (event) => events.push(event),
    document: {
      body: { classList }, documentElement: { classList, setAttribute() {} },
      querySelectorAll: () => [], querySelector: () => null,
      getElementById: (id) => id === 'color-change' ? themeButton : null,
    },
    location: { pathname: '/account/', search: '', href: 'http://localhost/account/', reload() { events.push('reload'); } },
  };
  root.window = root;
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(root, name, mode === 'getter'
    ? { configurable: true, get: fail }
    : { configurable: true, writable: true, value: mode === 'quota' ? full : unavailable });
  vm.createContext(root);
  const load = (file) => vm.runInContext(fs.readFileSync(`src/shared/assets/${file}`, 'utf8'), root);
  return { root, load, classes, themeButton, events };
}

for (const mode of ['getter', 'methods']) {
  test(`profile queries still fetch, cache in memory and refresh when storage ${mode} fail`, async () => {
    await withStorage(mode, async () => {
      let calls = 0;
      const query = new ProfileQueryService({ fetchFreshData: async () => ({ revision: ++calls }) });
      assert.equal((await query.getFullPlayerProfile('Tracking')).revision, 1);
      assert.equal((await query.getFullPlayerProfile('Tracking')).revision, 1);
      assert.equal((await query.getFullPlayerProfile('Tracking', [], null, { forceRefresh: true })).revision, 2);
      assert.equal(new SaProfileCache(unavailable).get('missing'), null);
    });
  });

  test(`board, comment and home cache ${mode} errors become cache misses and allow live notices`, async () => {
    await withStorage(mode, async () => {
      assert.equal(readBoardListCache(), null);
      assert.equal(writeBoardListCache([]), false);
      assert.doesNotThrow(() => clearBoardListCache());
      assert.equal(readCommentListCache({ postId: 'post' }), null);
      assert.equal(writeCommentListCache([], { postId: 'post' }), false);
      assert.doesNotThrow(() => clearCommentListCache('post'));
      assert.equal(readHomeNoticeCache({ projectId: 'demo' }), null);
      assert.equal(writeHomeNoticeCache([], { projectId: 'demo' }), false);
      let calls = 0;
      const notices = await fetchHomeNotices({
        config: { projectId: 'demo', apiKey: 'demo-key' }, firebaseApp: null, nowMs: 1000,
        fetchImpl: async () => { calls += 1; return { ok: true, json: async () => [{ document: {
          name: 'projects/demo/documents/board_posts/notice', fields: {
            category: { stringValue: 'notice' }, title: { stringValue: 'Live notice' },
            createdAt: { timestampValue: new Date(1000).toISOString() },
          },
        } }] }; },
      });
      assert.equal(calls, 1);
      assert.equal(notices[0].title, 'Live notice');
    });
  });

  test(`shell initializes translations and theme interactions when storage ${mode} fail`, () => {
    const { root, load, classes, themeButton, events } = runtimeContext(mode);
    load('app-shell-runtime.js');
    const shell = root.createAppShellRuntime();
    shell.initShell();
    assert.equal(shell.getCurrentLang(), 'ko');
    assert.equal(classes.has('dark-mode'), true);
    themeButton.onclick();
    assert.equal(classes.has('dark-mode'), false);
    assert.equal(themeButton.innerText, '☀️');
    assert.equal(events.at(-1).detail.theme, 'light');
  });
}

for (const mode of ['getter', 'quota']) {
  test(`recent searches and favorites remain usable in this page when storage ${mode} fail`, async () => {
    await withStorage(mode, () => {
      const recent = `blocked-recent-${mode}`;
      const favorites = `blocked-favorites-${mode}`;
      saveSearch(recent, 'Tracking');
      saveSearch(recent, 'Second');
      saveSearch(recent, 'tracking');
      assert.deepEqual(getRecentSearches(recent), ['tracking', 'Second']);
      clearRecentSearches(recent);
      assert.deepEqual(getRecentSearches(recent), []);
      assert.equal(toggleFavoriteSearch(favorites, 'Tracking'), true);
      assert.deepEqual(getFavoriteSearches(favorites), ['Tracking']);
      assert.equal(toggleFavoriteSearch(favorites, 'tracking'), false);
      assert.deepEqual(getFavoriteSearches(favorites), []);
      toggleFavoriteSearch(favorites, 'Second');
      removeFavoriteSearch(favorites, 'second');
      assert.deepEqual(getFavoriteSearches(favorites), []);
    });
  });

  test(`auth prompts and the pending return path survive session storage ${mode} failures`, async () => {
    const { root, load } = runtimeContext(mode);
    load('auth-session-runtime.js');
    let listener;
    let prompts = 0;
    const runtime = root.createAuthSessionRuntime({
      getAuthService: async () => ({ onAuthStateChanged(cb) { listener = cb; cb({ user: null }); } }),
      onAuthRequired: () => { prompts += 1; },
    });
    await runtime.init();
    assert.equal(await runtime.requireAuth({ redirectTo: '/board/write/' }), null);
    assert.equal(prompts, 1);
    listener({ user: { uid: 'member' }, profile: { nickname: 'Member' } });
    assert.equal(runtime.getCurrentUser().uid, 'member');
    assert.equal(root.location.href, '/board/write/');
  });
}

test('unremovable stored login targets do not cause exceptions or reload loops', async () => {
  const { root, load, events } = runtimeContext('getter');
  Object.defineProperty(root, 'sessionStorage', { value: { getItem: () => '/account/', removeItem: fail } });
  load('auth-session-runtime.js');
  let listener;
  const runtime = root.createAuthSessionRuntime({ getAuthService: async () => ({ onAuthStateChanged(cb) { listener = cb; } }) });
  await runtime.init();
  listener({ user: { uid: 'member' } });
  listener({ user: { uid: 'member' } });
  assert.equal(events.includes('reload'), false);
});

test('auth-gated links can open login through the session runtime when redirect storage is blocked', async () => {
  const { root, load } = runtimeContext('getter');
  let click;
  let target;
  root.document.querySelectorAll = () => [{ addEventListener(_event, handler) { click = handler; }, getAttribute: () => '/account/' }];
  root.requireAuth = async (options) => { target = options.redirectTo; };
  load('auth-prompt-kit.js');
  root.createAuthPromptKit({ getCurrentUser: () => null, getAuthStateReady: () => Promise.resolve(null) }).initAuthGateLinks();
  await click({ preventDefault() {} });
  assert.equal(target, '/account/');
});

test('account language fallback works when the storage getter throws', async () => {
  await withStorage('getter', () => {
    const previousWindow = globalThis.window;
    const languages = [];
    globalThis.window = { applyTranslations: (lang) => languages.push(lang) };
    try { applyCurrentLangTranslations(); }
    finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
    assert.deepEqual(languages, ['ko']);
  });
});

test('temporary favorite writes override stale persisted data and recover without changing other keys', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map([['recovery-favorites', '["Stored"]'], ['other-key', 'keep']]);
  let blocked = true;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => entries.get(key) ?? null,
    setItem(key, value) { if (blocked) fail(); entries.set(key, value); },
  } });
  try {
    toggleFavoriteSearch('recovery-favorites', 'New');
    assert.deepEqual(getFavoriteSearches('recovery-favorites'), ['New', 'Stored']);
    removeFavoriteSearch('recovery-favorites', 'stored');
    assert.deepEqual(getFavoriteSearches('recovery-favorites'), ['New']);
    blocked = false;
    toggleFavoriteSearch('recovery-favorites', 'Third');
    assert.deepEqual(JSON.parse(entries.get('recovery-favorites')), ['Third', 'New']);
    assert.equal(entries.get('other-key'), 'keep');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('unavailable storage keeps existing collection limits and public and league keys separate', async () => {
  await withStorage('getter', () => {
    for (let index = 0; index < 10; index += 1) {
      saveSearch('limited-public-recent', `Player${index}`);
      toggleFavoriteSearch('limited-public-favorite', `Player${index}`);
    }
    saveSearch('limited-league-recent', 'LeagueMember');
    assert.equal(getRecentSearches('limited-public-recent').length, 5);
    assert.equal(getFavoriteSearches('limited-public-favorite').length, 8);
    assert.deepEqual(getRecentSearches('limited-league-recent'), ['LeagueMember']);
  });
});

test('same-page login with blocked redirect persistence updates state without reloading the session', async () => {
  const { root, load, events } = runtimeContext('getter');
  load('auth-session-runtime.js');
  let listener;
  const runtime = root.createAuthSessionRuntime({ getAuthService: async () => ({ onAuthStateChanged(cb) { listener = cb; cb({ user: null }); } }) });
  await runtime.init();
  await runtime.requireAuth({ redirectTo: '/account/' });
  listener({ user: { uid: 'member' } });
  assert.equal(runtime.getCurrentUser().uid, 'member');
  assert.equal(events.includes('reload'), false);
});

test('auth bootstrap storage failures resolve guest readiness instead of leaving auth gates waiting', async () => {
  const { root, load } = runtimeContext('getter');
  load('auth-session-runtime.js');
  let prompts = 0;
  const runtime = root.createAuthSessionRuntime({ getAuthService: async () => fail(), onAuthRequired: () => { prompts += 1; } });
  await runtime.init();
  assert.equal(await runtime.waitForReady(), null);
  assert.equal(await runtime.requireAuth({ redirectTo: '/account/' }), null);
  assert.equal(prompts, 1);
});
