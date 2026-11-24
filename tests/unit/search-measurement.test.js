import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchMeasurement, searchMeasurementError } from '../../src/domains/stats/sudden-attack/ui/runtime/search-measurement.js';
import { createProductAnalytics } from '../../src/shared/assets/product-analytics.js';
import { measurementBrowser } from '../helpers/measurement-browser.js';

function fixture(options = {}) {
  const browser = measurementBrowser(), events = [];
  if (options.noIntersectionObserver) delete browser.window.IntersectionObserver;
  const client = createProductAnalytics({ getPageContext: () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/' }),
    trafficScope: 'verification', now: browser.window.performance.now });
  client.setTransport((name, fields) => events.push({ name, ...fields }));
  const measurement = createSearchMeasurement({ windowRef: browser.window, documentRef: browser.document, getAnalytics: () => client });
  const target = { isConnected: true };
  return { ...browser, events, measurement, target,
    start: (entry = 'input_button') => measurement.start(entry, () => true),
    named: name => events.filter(event => event.name === name),
  };
}

for (const source of ['network', 'fresh_cache']) {
  test(`${source}: waits for a visible paint, then emits one first result before finish`, () => {
    const f = fixture(), op = f.start();
    op.rendered(source, f.target); op.complete();
    assert.equal(f.events.length, 1);
    f.frame(); assert.equal(f.events.length, 1);
    f.frame();
    assert.deepEqual(f.events.map(e => e.name), ['sa_search_start', 'sa_search_first_result', 'sa_search_finish']);
    assert.equal(f.events[1].duration_ms, 32);
    assert.equal(f.events[1].result_source, source);
    assert.equal(f.events[2].outcome, 'success');
    assert.equal(f.events[2].result_shown, 1);
    assert.equal(f.events[2].revalidation, 'not_needed');
    op.complete(); op.fail(new Error('late')); op.rendered(source, f.target); f.paint();
    assert.equal(f.named('sa_search_first_result').length, 1);
    assert.equal(f.named('sa_search_finish').length, 1);
  });
}

test('stale cache can be painted first and finish only after the fresh result paints', () => {
  const f = fixture(), op = f.start('recent');
  op.queryState({ source: 'stale_cache', revalidating: true });
  op.rendered('stale_cache', f.target); f.paint();
  assert.equal(f.named('sa_search_finish').length, 0);
  op.rendered('network', f.target); op.revalidated();
  assert.equal(f.named('sa_search_finish').length, 0);
  f.paint();
  assert.equal(f.named('sa_search_first_result')[0].result_source, 'stale_cache');
  assert.deepEqual(f.named('sa_search_finish').map(e => [e.outcome, e.result_source, e.revalidation]), [['success', 'network', 'success']]);
});

test('failed revalidation before the cache paints waits and finishes as partial', () => {
  const f = fixture(), op = f.start();
  op.queryState({ revalidating: true });
  op.revalidated({ code: 'REQUEST_TIMEOUT', message: 'private raw error' });
  assert.equal(f.events.length, 1);
  op.rendered('stale_cache', f.target); f.paint();
  const finish = f.named('sa_search_finish')[0];
  assert.deepEqual([finish.outcome, finish.result_shown, finish.result_source, finish.revalidation, finish.error_code],
    ['partial', 1, 'stale_cache', 'failure', 'timeout']);
  assert.ok(!JSON.stringify(f.events).includes('private'));
});

test('fast revalidation replaces an unpainted cache result without a false first cache event', () => {
  const f = fixture(), op = f.start();
  op.queryState({ revalidating: true });
  op.rendered('stale_cache', f.target); f.frame();
  op.rendered('network', f.target); op.revalidated(); f.paint();
  assert.equal(f.named('sa_search_first_result').length, 1);
  assert.equal(f.named('sa_search_first_result')[0].result_source, 'network');
  assert.equal(f.named('sa_search_finish')[0].revalidation, 'success');
});

for (const painted of [false, true]) {
  test(`replacement preserves actual cache display=${painted} and ignores late callbacks including abort`, () => {
    const f = fixture(), a = f.start();
    a.queryState({ revalidating: true }); a.rendered('stale_cache', f.target);
    if (painted) f.paint();
    const b = f.start('favorite');
    a.revalidated({ code: 'REQUEST_ABORTED' }); a.revalidated(); a.fail(new Error('old')); a.rendered('network', f.target);
    const finishA = f.named('sa_search_finish')[0];
    assert.equal(finishA.outcome, 'superseded'); assert.equal(finishA.revalidation, 'interrupted');
    assert.equal(finishA.result_shown, painted ? 1 : 0);
    b.rendered('network', f.target); b.complete(); f.paint();
    assert.equal(f.named('sa_search_finish').length, 2);
    assert.equal(f.named('sa_search_finish')[1].outcome, 'success');
    assert.equal(f.named('sa_search_first_result').length, painted ? 2 : 1);
  });
}

test('failure records a bounded error without a result and abort is cancellation', () => {
  const f = fixture(), a = f.start();
  a.fail({ code: 'NETWORK_ERROR', message: 'private' });
  assert.deepEqual(f.named('sa_search_finish').map(e => [e.outcome, e.error_code, e.result_shown, e.result_source]), [['failure', 'network', 0, 'none']]);
  const b = f.start('history'); b.fail({ name: 'AbortError' });
  assert.equal(f.named('sa_search_finish')[1].outcome, 'cancelled');
  assert.equal(f.named('sa_search_first_result').length, 0);
});

test('hidden tabs defer first result/finish, and replacement cannot replay their pending result', () => {
  const f = fixture(); f.visibility('hidden');
  const a = f.start(); a.rendered('network', f.target); a.complete(); f.paint(); f.advance(2000);
  assert.equal(f.events.length, 1);
  f.visibility('visible'); f.paint();
  assert.equal(f.named('sa_search_finish').length, 1);
  assert.ok(f.named('sa_search_first_result')[0].duration_ms >= 2000);
  f.visibility('hidden'); const b = f.start(); b.rendered('network', f.target); b.complete();
  f.measurement.supersede(); f.visibility('visible'); f.paint();
  assert.equal(f.named('sa_search_first_result').length, 1);
  assert.equal(f.named('sa_search_finish')[1].result_shown, 0);
});

test('hiding between animation frames restarts observation on return', () => {
  const f = fixture(), op = f.start(); op.rendered('network', f.target); op.complete(); f.frame();
  f.visibility('hidden'); f.paint(); assert.equal(f.events.length, 1);
  f.visibility('visible'); f.paint(); assert.equal(f.named('sa_search_first_result').length, 1);
});

test('summary requires 50 percent intersection for one uninterrupted visible second', () => {
  const f = fixture(), op = f.start(); op.rendered('network', f.target); op.complete(); f.paint();
  f.intersect(f.target, 0.49); f.advance(1100); assert.equal(f.named('sa_summary_view').length, 0);
  f.intersect(f.target, 0.5); f.advance(999); assert.equal(f.named('sa_summary_view').length, 0);
  f.visibility('hidden'); f.advance(1000); f.visibility('visible');
  f.advance(1100); assert.equal(f.named('sa_summary_view').length, 0, 'intersection must be refreshed after visibility return');
  f.intersect(f.target, 1); f.advance(1000); assert.equal(f.named('sa_summary_view').length, 1);
  op.rendered('network', f.target); f.paint(); f.intersect(f.target, 1); f.advance(1000);
  assert.equal(f.named('sa_summary_view').length, 1);
});

test('scrolling out, replacing DOM and disconnecting the target reset or prevent exposure', () => {
  const f = fixture(), op = f.start(); op.rendered('network', f.target); op.complete(); f.paint();
  f.intersect(f.target, 1); f.advance(600); f.intersect(f.target, 0.4); f.advance(500);
  assert.equal(f.named('sa_summary_view').length, 0);
  f.intersect(f.target, 1); f.advance(500);
  const replacement = { isConnected: true }; op.rendered('network', replacement); f.paint();
  f.intersect(replacement, 1); f.advance(999); assert.equal(f.named('sa_summary_view').length, 0);
  replacement.isConnected = false; f.advance(1); assert.equal(f.named('sa_summary_view').length, 0);
});

test('replacement closes old observers and does not count their delayed callbacks', () => {
  const f = fixture(), a = f.start(); a.rendered('stale_cache', f.target); f.paint();
  f.intersect(f.target, 1); f.advance(500); const observer = f.observers[0];
  f.start('refresh'); observer.callback([{ target: f.target, isIntersecting: true, intersectionRatio: 1 }]); f.advance(2000);
  assert.equal(f.named('sa_summary_view').length, 0);
});

for (const action of ['cancel', 'pagehide']) {
  test(`${action} terminates only the unfinished search and cannot replay on BFCache return`, () => {
    const f = fixture(), op = f.start(); op.queryState({ revalidating: true });
    op.rendered('stale_cache', f.target);
    if (action === 'cancel') f.measurement.cancel(); else f.dispatch('pagehide');
    f.dispatch('pagehide'); f.dispatch('pageshow'); op.revalidated(); f.paint();
    assert.equal(f.named('sa_search_finish').length, 1);
    assert.equal(f.named('sa_search_finish')[0].outcome, 'cancelled');
    assert.equal(f.named('sa_search_finish')[0].revalidation, 'interrupted');
    assert.equal(f.named('sa_search_first_result').length, 0);
  });
}

test('missing IntersectionObserver does not fabricate a summary or prevent zero-match result completion', () => {
  const f = fixture({ noIntersectionObserver: true }), op = f.start();
  op.rendered('network', null); op.complete(); f.paint(); f.advance(2000);
  assert.equal(f.named('sa_search_finish')[0].outcome, 'success');
  assert.equal(f.named('sa_summary_view').length, 0);
  f.dispatch('pagehide'); assert.equal(f.named('sa_search_finish').length, 1);
});

test('unavailable or throwing analytics remains optional and cannot fail search lifecycle calls', () => {
  for (const getAnalytics of [() => null, () => { throw new Error('blocked'); }, () => ({ createContext: () => ({}), track() { throw new Error('blocked'); } })]) {
    const f = measurementBrowser();
    const measurement = createSearchMeasurement({ windowRef: f.window, documentRef: f.document, getAnalytics });
    assert.doesNotThrow(() => {
      const op = measurement.start('input_button', () => true);
      op.rendered('network', { isConnected: true }); op.complete(); f.paint(); measurement.cancel();
    });
  }
});

test('error categories never serialize raw errors', () => {
  for (const [error, expected] of [[{ code: 'REQUEST_TIMEOUT' }, 'timeout'], [{ code: 'INVALID_RESPONSE' }, 'invalid_response'],
    [{ code: 'HTTP_ERROR' }, 'http'], [{ code: 'RATE_LIMITED' }, 'rate_limited'], [{ message: 'PLAYER_NOT_FOUND' }, 'not_found'],
    [{ code: 'permission-denied' }, 'permission'], [{ message: 'TEST_KEY_LIMITATION' }, 'permission'], [{ message: 'private input' }, 'unknown']]) {
    assert.equal(searchMeasurementError(error), expected);
  }
});
