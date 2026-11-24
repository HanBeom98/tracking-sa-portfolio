import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { initializeAnalytics } from '../../src/shared/assets/analytics-loader.js';

function fixture({ href = 'https://trackingsa.com/stats/sudden-attack/?n=private', readyState = 'loading' } = {}) {
  const listeners = new Map(), timers = new Map(), scripts = [];
  let nextTimer = 0;
  const window = {
    location: { href },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const document = { readyState, referrer: 'https://search.naver.com/path?query=private', title: 'private nickname',
    createElement: () => ({}), getElementById: id => scripts.find(s => s.id === id), head: { appendChild: script => scripts.push(script) } };
  const client = initializeAnalytics(window, document);
  return { window, document, client, scripts, timers, dispatch: name => listeners.get(name)?.(), runTimer: delay => {
    const entry = [...timers].find(([, value]) => value.delay === delay);
    assert.ok(entry, `Missing ${delay}ms timer`); timers.delete(entry[0]); entry[1].callback();
  }, events: () => (window.dataLayer || []).map(args => Array.from(args)).filter(args => args[0] === 'event') };
}

test('analytics loader waits for interaction and initializes each provider/config only once', () => {
  const f = fixture(); assert.equal(f.scripts.length, 0);
  assert.equal(f.window.trackingSaProductAnalytics, f.client);
  f.dispatch('pointerdown');
  assert.deepEqual(f.scripts.map(s => s.id), ['tracking-sa-google-analytics', 'tracking-sa-microsoft-clarity']);
  assert.equal(f.window.dataLayer.length, 2);
  f.dispatch('keydown'); f.dispatch('touchstart');
  assert.equal(initializeAnalytics(f.window, f.document), f.client);
  assert.equal(f.scripts.length, 2);
  assert.equal(f.window.dataLayer.length, 2);
});

test('analytics loader also starts after load delay and does not auto-create product events', () => {
  for (const readyState of ['loading', 'complete']) {
    const f = fixture({ readyState });
    if (readyState === 'loading') f.dispatch('load');
    f.runTimer(4000);
    assert.equal(f.scripts.length, 2);
    f.scripts[0].onload();
    assert.deepEqual(f.events(), []);
    assert.equal(f.client.getStatus().ready, true);
  }
});

test('queued product event waits for actual SDK load and flushes once to the intended stream', () => {
  const f = fixture(); const context = f.client.createContext();
  f.client.track('sa_search_start', { entry_point: 'direct_link' }, context);
  f.dispatch('pointerdown'); assert.equal(f.events().length, 0);
  f.scripts[0].onload(); f.scripts[0].onload();
  const [event] = f.events();
  assert.equal(f.events().length, 1);
  assert.equal(event[1], 'sa_search_start');
  assert.equal(event[2].send_to, 'G-PORTFOLIO');
  assert.equal(event[2].page_location, 'https://trackingsa.com/stats/sudden-attack/');
  assert.equal(f.client.track('sa_search_start', { entry_point: 'direct_link' }, context), false);
});

test('SDK error/timeout drops pending data, permits no late replay and leaves Clarity independent', () => {
  for (const failure of ['error', 'timeout']) {
    const f = fixture(); f.client.track('sa_search_start', { entry_point: 'input_enter' }, f.client.createContext());
    f.dispatch('keydown');
    if (failure === 'error') f.scripts[0].onerror(); else f.runTimer(10000);
    f.scripts[0].onload();
    assert.equal(f.client.getStatus().disabled, true);
    assert.equal(f.client.getStatus().pending, 0);
    assert.equal(f.events().length, 0);
    assert.equal(f.scripts[1].id, 'tracking-sa-microsoft-clarity');
  }
});

test('GA config sanitizes public-search page context while unrelated pages retain existing config behavior', () => {
  const f = fixture(); f.dispatch('touchstart');
  const config = Array.from(f.window.dataLayer[1]);
  assert.deepEqual(config, ['config', 'G-PORTFOLIO', { page_location: 'https://trackingsa.com/stats/sudden-attack/', page_referrer: 'https://search.naver.com/', page_title: '서든어택 전적 검색 | Tracking SA' }]);
  const other = fixture({ href: 'https://trackingsa.com/board/?category=notice' }); other.dispatch('pointerdown');
  assert.deepEqual(Array.from(other.window.dataLayer[1]), ['config', 'G-PORTFOLIO', {}]);
});

test('GA setup or delivery failure cannot stop the other provider or propagate to the product', () => {
  const f = fixture(); f.window.gtag = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => f.dispatch('pointerdown'));
  assert.equal(f.client.getStatus().disabled, true);
  assert.deepEqual(f.scripts.map(s => s.id), ['tracking-sa-microsoft-clarity']);
});

test('common head loads the ES module and the product dependency is mapped as a generated asset', () => {
  const head = fs.readFileSync(new URL('../../src/shared/ui/head.html', import.meta.url), 'utf8');
  const map = fs.readFileSync(new URL('../../scripts/public_sync_map.txt', import.meta.url), 'utf8');
  assert.match(head, /<script type="module" src="\/analytics-loader\.js"><\/script>/);
  assert.match(map, /src\/shared\/assets\/product-analytics\.js\|public\/product-analytics\.js/);
});

test('verification config marks automatic events and queued product events without persisting the mode', () => {
  const f = fixture({ href: 'https://trackingsa.com/stats/sudden-attack/?measurement_scope=verification&n=private' });
  f.client.track('sa_search_start', { entry_point: 'input_button' }, f.client.createContext());
  // Search history can replace the query before the lazy SDK starts.
  f.window.location.href = 'https://trackingsa.com/stats/sudden-attack/?n=other';
  f.dispatch('pointerdown'); f.scripts[0].onload();
  const config = Array.from(f.window.dataLayer[1])[2];
  assert.deepEqual(config, { page_location: 'https://trackingsa.com/stats/sudden-attack/', page_referrer: 'https://search.naver.com/', page_title: '서든어택 전적 검색 | Tracking SA', debug_mode: true, traffic_scope: 'verification', measurement_version: 'v1' });
  assert.equal(f.events()[0][2].debug_mode, true);
  assert.equal(f.events()[0][2].traffic_scope, 'verification');
  const normal = fixture({ href: 'https://trackingsa.com/stats/sudden-attack/' }); normal.dispatch('pointerdown');
  assert.equal(Object.hasOwn(Array.from(normal.window.dataLayer[1])[2], 'debug_mode'), false);
  const unrelated = fixture({ href: 'https://trackingsa.com/board/?measurement_scope=verification' }); unrelated.dispatch('pointerdown');
  assert.deepEqual(Array.from(unrelated.window.dataLayer[1])[2], {});
});
