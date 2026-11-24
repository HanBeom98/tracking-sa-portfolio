import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionMeasurement } from '../../src/domains/stats/sudden-attack/ui/runtime/action-measurement.js';
import { createProductAnalytics } from '../../src/shared/assets/product-analytics.js';
import { measurementBrowser } from '../helpers/measurement-browser.js';

function fixture(getAnalytics) {
  const browser = measurementBrowser(), events = [];
  const client = createProductAnalytics({ getPageContext: () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/' }),
    now: browser.window.performance.now, trafficScope: 'verification' });
  client.setTransport((name, fields) => events.push({ name, ...fields }));
  const actions = createActionMeasurement({ windowRef: browser.window, getAnalytics: getAnalytics || (() => client) });
  return { ...browser, actions, events, named: name => events.filter(e => e.name === name) };
}

test('favorites count actual state changes, with unknown persistence and no event for an unchanged value', () => {
  const f = fixture();
  f.actions.favoriteChanged('result_button', false, true);
  f.actions.favoriteChanged('result_button', true, false);
  f.actions.favoriteChanged('favorite_chip', true, false);
  f.actions.favoriteChanged('favorite_chip', false, false);
  assert.deepEqual(f.events.map(e => [e.name, e.action, e.action_source, e.persistence]), [
    ['sa_favorite_change', 'add', 'result_button', 'unknown'],
    ['sa_favorite_change', 'remove', 'result_button', 'unknown'],
    ['sa_favorite_change', 'remove', 'favorite_chip', 'unknown'],
  ]);
});

for (const source of ['network', 'fresh_cache', 'stale_cache']) {
  test(`VS completion uses explicit ${source} after current DOM render and can finish only once`, () => {
    const f = fixture(), op = f.actions.startVs('modal', () => true);
    f.advance(35); op.success(source); op.success(source); op.fail({ code: 'NETWORK_ERROR' });
    f.actions.cancelVs();
    assert.deepEqual(f.events.map(e => e.name), ['sa_vs_start', 'sa_vs_finish']);
    assert.deepEqual([f.events[1].outcome, f.events[1].result_source, f.events[1].duration_ms], ['success', source, 35]);
  });
}

test('VS errors and OUID alias self-comparison use bounded categories and no identifying payload', () => {
  const f = fixture();
  f.actions.startVs('favorite_chip', () => true).samePlayer();
  f.actions.startVs('modal', () => true).fail({ code: 'REQUEST_TIMEOUT', message: 'private target' });
  f.actions.startVs('modal', () => true).fail({ name: 'AbortError' });
  assert.deepEqual(f.named('sa_vs_finish').map(e => [e.outcome, e.error_code, e.result_source]), [
    ['failure', 'same_player', 'none'], ['failure', 'timeout', 'none'], ['cancelled', undefined, 'none'],
  ]);
  assert.ok(!JSON.stringify(f.events).includes('private'));
});

test('new search/VS supersedes unfinished comparison and late success or error cannot terminate the next one', () => {
  const f = fixture(), a = f.actions.startVs('modal', () => true);
  const b = f.actions.startVs('favorite_chip', () => true);
  a.success('network'); a.fail({ name: 'AbortError' });
  f.actions.supersedeVs(); b.success('network'); b.fail(new Error('late'));
  assert.deepEqual(f.named('sa_vs_finish').map(e => e.outcome), ['superseded', 'superseded']);
});

test('reset/pagehide cancel unfinished VS once without re-completing after BFCache return', () => {
  const f = fixture(), a = f.actions.startVs('modal', () => true);
  f.actions.cancelVs(); a.success('network');
  const b = f.actions.startVs('favorite_chip', () => true);
  f.dispatch('pagehide'); f.dispatch('pagehide'); f.dispatch('pageshow'); b.success('network');
  assert.deepEqual(f.named('sa_vs_finish').map(e => e.outcome), ['cancelled', 'cancelled']);
});

test('a comparison with no current view or explicit source never claims success', () => {
  const f = fixture();
  f.actions.startVs('modal', () => false).success('network');
  f.actions.startVs('favorite_chip', () => true).success(undefined);
  assert.ok(!f.named('sa_vs_finish').some(e => e.outcome === 'success'));
});

test('independent overlapping shares finish in their actual order, with one finish each', () => {
  const f = fixture(), image = f.actions.startShare('image_button'), link = f.actions.startShare('link_button');
  f.advance(10); link.finish('clipboard_link', 'success');
  f.advance(20); image.finish('png_download', 'download_requested'); image.finish('clipboard_image', 'success');
  assert.deepEqual(f.named('sa_share_finish').map(e => [e.share_source, e.method, e.outcome, e.duration_ms]), [
    ['link_button', 'clipboard_link', 'success', 10], ['image_button', 'png_download', 'download_requested', 30],
  ]);
});

test('native cancellation and clipboard failure remain distinct', () => {
  const f = fixture();
  f.actions.startShare('image_button').finish('native', 'cancelled');
  f.actions.startShare('image_button').finish('clipboard_image', 'failure', { name: 'AbortError', message: 'private' });
  assert.deepEqual(f.named('sa_share_finish').map(e => [e.outcome, e.error_code]), [['cancelled', undefined], ['failure', 'unknown']]);
});

test('missing/throwing analytics cannot alter favorite, VS or share actions', () => {
  for (const getAnalytics of [() => null, () => { throw new Error('blocked'); }, () => ({ createContext: () => ({}), track() { throw new Error('blocked'); } })]) {
    const f = fixture(getAnalytics);
    assert.doesNotThrow(() => {
      f.actions.favoriteChanged('result_button', false, true);
      f.actions.startVs('modal', () => true).success('network');
      f.actions.startShare('image_button').finish('png_download', 'download_requested');
      f.actions.cancelVs();
    });
  }
});
