import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductAnalytics, getProductAnalytics, getPublicMeasurementContext, getMeasurementScope, MEASUREMENT_SCOPE_KEY, MAX_PENDING_EVENTS, EVENT_TTL_MS } from '../../src/shared/assets/product-analytics.js';

const page = () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/', page_referrer: 'https://search.naver.com/path?query=private#secret' });
function fixture(options = {}) {
  let time = 0;
  const sent = [];
  const client = createProductAnalytics({ getPageContext: page, now: () => time, ...options });
  return { client, sent, advance: (ms) => { time += ms; }, ready: () => client.setTransport((name, fields) => sent.push({ name, fields })),
    start: (context = client.createContext(), input = {}) => client.track('sa_search_start', { entry_point: 'input_button', ...input }, context) };
}

test('events before SDK readiness flush once in order and keep separate operation contexts', () => {
  const f = fixture(), context = f.client.createContext();
  assert.equal(f.start(context), true);
  assert.equal(f.client.track('sa_search_first_result', { entry_point: 'input_button', result_source: 'network', duration_ms: 12.4 }, context), true);
  assert.equal(f.start(context), false);
  assert.equal(f.sent.length, 0);
  f.ready();
  assert.deepEqual(f.sent.map(e => e.name), ['sa_search_start', 'sa_search_first_result']);
  assert.equal(f.sent[1].fields.duration_ms, 12);
  assert.equal(f.ready(), false);
  f.start();
  assert.equal(f.sent.length, 3);
  assert.equal(f.client.getStatus().duplicates, 1);
});

test('buffer is bounded and oldest events are discarded without replay', () => {
  const f = fixture();
  for (let i = 0; i < MAX_PENDING_EVENTS + 3; i++) f.start();
  assert.equal(f.client.getStatus().pending, MAX_PENDING_EVENTS);
  assert.equal(f.client.getStatus().dropped, 3);
  f.ready();
  assert.equal(f.sent.length, MAX_PENDING_EVENTS);
  assert.equal(f.client.getStatus().pending, 0);
});

test('events at the expiry boundary are dropped rather than sent as current activity', () => {
  const f = fixture();
  f.start(); f.advance(EVENT_TTL_MS); f.start(); f.ready();
  assert.equal(f.sent.length, 1);
  assert.equal(f.client.getStatus().dropped, 1);
});

test('transport failures are not retried or propagated, including after an uncertain send', () => {
  const f = fixture(); let calls = 0;
  f.start();
  assert.doesNotThrow(() => f.client.setTransport(() => { calls++; throw new Error('private response'); }));
  assert.equal(calls, 1);
  f.start();
  assert.equal(calls, 2);
  assert.equal(f.client.getStatus().dropped, 2);
  assert.equal(f.client.setTransport(() => {}), false);
});

test('reentrant transport preserves FIFO order without double flushing', () => {
  const f = fixture(); f.start();
  let calls = 0;
  f.client.setTransport(() => { calls++; if (calls === 1) f.start(); });
  assert.equal(calls, 2);
  assert.equal(f.client.getStatus().pending, 0);
});

test('blocked SDK disables and clears pending data and refuses a late SDK callback', () => {
  const f = fixture(); f.start(); f.client.disable();
  assert.equal(f.start(), false);
  assert.equal(f.ready(), false);
  assert.deepEqual(f.client.getStatus(), { pending: 0, sent: 0, dropped: 1, duplicates: 0, ready: false, disabled: true });
});

test('only fixed fields are captured; raw identifiers, page overrides and errors are ignored', () => {
  const f = fixture(); const input = { entry_point: 'favorite', nickname: 'private', ouid: 'private-id', email: 'private@example.test', token: 'secret', error: new Error('secret'), measurement_version: 'bad', traffic_scope: 'verification', page_location: 'https://private.test/?n=secret', page_title: 'secret' };
  Object.defineProperty(input, 'unknownGetter', { get() { throw new Error('must not read unknown fields'); } });
  assert.equal(f.start(undefined, input), true);
  input.entry_point = 'recent';
  f.ready();
  assert.deepEqual(f.sent[0].fields, { entry_point: 'favorite', page_location: 'https://trackingsa.com/stats/sudden-attack/', page_referrer: 'https://search.naver.com/', page_title: '서든어택 전적 검색 | Tracking SA', measurement_version: 'v1', traffic_scope: 'production' });
});

test('unknown events, raw enum values, missing contexts and throwing known getters fail closed', () => {
  const f = fixture(); f.ready();
  assert.equal(f.client.track('page_view', {}, f.client.createContext()), false);
  assert.equal(f.client.track('__proto__', {}, f.client.createContext()), false);
  assert.equal(f.client.track('sa_search_start', { entry_point: 'Tracking' }, f.client.createContext()), false);
  assert.equal(f.client.track('sa_search_start', { entry_point: 'favorite' }, {}), false);
  const input = {}; Object.defineProperty(input, 'entry_point', { get() { throw new Error('blocked'); } });
  assert.equal(f.client.track('sa_search_start', input, f.client.createContext()), false);
  assert.equal(f.sent.length, 0);
});

test('failed validation does not consume the context and all defined entry points are allowed', () => {
  const f = fixture(); f.ready(); const context = f.client.createContext();
  assert.equal(f.start(context, { entry_point: 'invalid' }), false);
  assert.equal(f.start(context, { entry_point: 'recent' }), true);
  for (const entry_point of ['input_button', 'input_enter', 'favorite', 'direct_link', 'history', 'in_page', 'refresh']) assert.equal(f.start(undefined, { entry_point }), true);
  assert.equal(f.sent.length, 8);
});

test('non-finite, negative and non-numeric durations are not forwarded', () => {
  const f = fixture(); f.ready();
  for (const duration_ms of [NaN, Infinity, -1, '12', undefined, Number.MAX_SAFE_INTEGER + 1]) assert.equal(f.client.track('sa_search_first_result', { entry_point: 'input_button', result_source: 'network', duration_ms }, f.client.createContext()), false);
  assert.equal(f.sent.length, 0);
});

test('search finish separates cache partial success and refuses contradictory outcomes', () => {
  const f = fixture(); f.ready();
  const base = { entry_point: 'favorite', outcome: 'partial', result_shown: 1, result_source: 'stale_cache', revalidation: 'failure', duration_ms: 2, error_code: 'timeout' };
  assert.equal(f.client.track('sa_search_finish', base, f.client.createContext()), true);
  for (const changed of [{ error_code: 'private error' }, { result_shown: 0 }, { result_source: 'network' }, { revalidation: 'success' }, { outcome: 'failure' }, { outcome: 'success' }]) assert.equal(f.client.track('sa_search_finish', { ...base, ...changed }, f.client.createContext()), false);
  assert.equal(f.sent.length, 1);
});

test('fresh cache and superseded/cancelled operations retain their distinct outcomes', () => {
  const f = fixture(); f.ready();
  for (const [outcome, result_shown, result_source, revalidation] of [['success', 1, 'fresh_cache', 'not_needed'], ['success', 1, 'network', 'success'], ['superseded', 0, 'none', 'interrupted'], ['cancelled', 1, 'stale_cache', 'interrupted']]) assert.equal(f.client.track('sa_search_finish', { entry_point: 'refresh', outcome, result_shown, result_source, revalidation, duration_ms: 0 }, f.client.createContext()), true);
  assert.equal(f.sent.length, 4);
});

test('favorite, summary and VS events validate the promised schema without sending a nickname', () => {
  const f = fixture(); f.ready();
  for (const [name, input] of [['sa_summary_view', { entry_point: 'favorite' }], ['sa_favorite_change', { action: 'add', action_source: 'result_button', persistence: 'unknown' }], ['sa_vs_start', { vs_source: 'favorite_chip' }], ['sa_vs_finish', { vs_source: 'modal', outcome: 'failure', result_source: 'none', duration_ms: 20, error_code: 'same_player' }]]) assert.equal(f.client.track(name, input, f.client.createContext()), true);
  assert.equal(f.client.track('sa_vs_finish', { vs_source: 'modal', outcome: 'success', result_source: 'none', duration_ms: 3 }, f.client.createContext()), false);
  assert.equal(f.sent.length, 4);
});

test('share finish never calls a PNG request a completed share and distinguishes native cancellation', () => {
  const f = fixture(); f.ready();
  const base = { share_source: 'image_button', method: 'png_download', outcome: 'download_requested', duration_ms: 10 };
  assert.equal(f.client.track('sa_share_start', { share_source: 'image_button' }, f.client.createContext()), true);
  assert.equal(f.client.track('sa_share_finish', base, f.client.createContext()), true);
  assert.equal(f.client.track('sa_share_finish', { ...base, outcome: 'success' }, f.client.createContext()), false);
  assert.equal(f.client.track('sa_share_finish', { ...base, method: 'native', outcome: 'cancelled' }, f.client.createContext()), true);
  assert.equal(f.client.track('sa_share_finish', { ...base, method: 'clipboard_image', outcome: 'cancelled' }, f.client.createContext()), false);
  assert.equal(f.client.track('sa_share_finish', { ...base, share_source: 'link_button', method: 'clipboard_link', outcome: 'success' }, f.client.createContext()), true);
});

test('page context strips query, fragment, dynamic title and referrer paths', () => {
  const window = { location: { href: 'https://trackingsa.com/stats/sudden-attack/?n=private#secret' } };
  const document = { referrer: 'https://search.naver.com/path?query=private', title: 'private nickname' };
  assert.deepEqual(getPublicMeasurementContext(window, document), { page_location: 'https://trackingsa.com/stats/sudden-attack/', page_referrer: 'https://search.naver.com/', page_title: '서든어택 전적 검색 | Tracking SA' });
  window.location.href = 'https://trackingsa.com/board/';
  assert.equal(getPublicMeasurementContext(window, document), null);
  window.location.href = 'javascript:secret';
  assert.equal(getPublicMeasurementContext(window, document), null);
});

test('malformed page context and out-of-scope pages cannot queue product events', () => {
  for (const getPageContext of [() => null, () => { throw new Error('blocked'); }, () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/?n=secret' }), () => ({ page_location: 'https://user:demo-52d58f22@example.com/stats/sudden-attack/' })]) {
    const f = fixture({ getPageContext }); assert.equal(f.start(), false); assert.equal(f.client.getStatus().pending, 0);
  }
});

test('verification mode is explicit in production and automatic on local/preview hosts', () => {
  const window = { location: { href: 'https://trackingsa.com/stats/sudden-attack/' }, sessionStorage: { getItem: key => key === MEASUREMENT_SCOPE_KEY ? 'verification' : null } };
  assert.equal(getMeasurementScope(window), 'verification');
  window.sessionStorage.getItem = () => null;
  assert.equal(getMeasurementScope(window), 'production');
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getMeasurementScope(window), 'production');
  window.location.href = 'http://127.0.0.1:4173/stats/sudden-attack/';
  assert.equal(getMeasurementScope(window), 'verification');
  window.location.href = 'https://example.tracking-sa.pages.dev/stats/sudden-attack/';
  assert.equal(getMeasurementScope(window), 'verification');
  const f = fixture({ trafficScope: 'verification' }); f.start(); f.ready();
  assert.equal(f.sent[0].fields.traffic_scope, 'verification');
});

test('one browser document shares a client while separate windows and contexts remain independent', () => {
  const window = { location: { href: 'https://trackingsa.com/stats/sudden-attack/' } }, document = { referrer: '' };
  const first = getProductAnalytics(window, document);
  assert.equal(first, getProductAnalytics(window, document));
  assert.notEqual(first, getProductAnalytics({ ...window }, document));
  const f = fixture(); assert.equal(f.start(first.createContext()), false);
});

test('verification URL is an exact public-page opt-in and works without storage', () => {
  const window = { location: { href: 'https://trackingsa.com/stats/sudden-attack/?measurement_scope=verification&n=private' } };
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });
  assert.equal(getMeasurementScope(window), 'verification');
  for (const suffix of ['?measurement_scope=production', '?measurement_scope=VERIFICATION', '?measurement_scope=verification&measurement_scope=production', '?measurement_scope=verification&measurement_scope=verification', '?other=verification', '']) {
    window.location.href = 'https://trackingsa.com/stats/sudden-attack/' + suffix;
    assert.equal(getMeasurementScope(window), 'production');
  }
  window.location.href = 'https://trackingsa.com/board/?measurement_scope=verification';
  assert.equal(getMeasurementScope(window), 'production');
  window.location.href = 'https://www.trackingsa.com/stats/sudden-attack?measurement_scope=verification';
  assert.equal(getMeasurementScope(window), 'verification');
});

test('only verification events carry DebugView flag and callers cannot force it on production', () => {
  const normal = fixture(), check = fixture({ trafficScope: 'verification' });
  normal.start(undefined, { debug_mode: true }); check.start(); normal.ready(); check.ready();
  assert.equal(Object.hasOwn(normal.sent[0].fields, 'debug_mode'), false);
  assert.equal(check.sent[0].fields.debug_mode, true);
  assert.equal(check.sent[0].fields.traffic_scope, 'verification');
  assert.equal(check.sent[0].fields.page_location, 'https://trackingsa.com/stats/sudden-attack/');
});
