import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeSoopText,
  formatSoopViewerCount,
  getSoopLiveEndpoint,
  renderSoopBroadcasts,
  setupSoopLiveDisclosure,
} from '../../src/domains/home/soop-live.js';

test('SOOP live UI escapes provider text and formats viewer counts', () => {
  assert.equal(escapeSoopText('<script>"방송"</script>'), '&lt;script&gt;&quot;방송&quot;&lt;/script&gt;');
  assert.equal(formatSoopViewerCount(12345), '12,345');
});

test('SOOP live UI uses the configured API base URL', () => {
  assert.equal(
    getSoopLiveEndpoint({ runtimeConfig: { apiBaseUrl: 'https://api.example.com/api/' } }),
    'https://api.example.com/api/soop-live'
  );
  assert.equal(getSoopLiveEndpoint(null), '/api/soop-live');
});

test('SOOP live UI renders safe outbound broadcast cards', () => {
  const grid = { innerHTML: '' };
  renderSoopBroadcasts(grid, [{
    title: '<오늘의 방송>',
    streamerName: 'Tracking & SA',
    viewerCount: 321,
    thumbnailUrl: 'https://cdn.example.com/live.jpg?a=1&b=2',
    watchUrl: 'https://www.sooplive.co.kr/station/tracking',
  }]);

  assert.match(grid.innerHTML, /class="live-card"/);
  assert.match(grid.innerHTML, /target="_blank" rel="noopener noreferrer"/);
  assert.match(grid.innerHTML, /Tracking &amp; SA/);
  assert.match(grid.innerHTML, /&lt;오늘의 방송&gt;/);
  assert.match(grid.innerHTML, /321명/);
});

test('SOOP live UI expands and collapses responsive broadcast lists', () => {
  const listeners = {};
  const toggle = {
    hidden: false,
    textContent: '',
    attributes: {},
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const actions = { hidden: true };
  const root = {
    dataset: {},
    querySelector(selector) {
      return selector === '[data-soop-live-actions]' ? actions : toggle;
    },
  };
  const viewport = {
    matchMedia: () => ({ matches: true, addEventListener() {} }),
  };

  setupSoopLiveDisclosure(root, 12, viewport);

  assert.equal(actions.hidden, false);
  assert.equal(root.dataset.hasMobileOverflow, 'true');
  assert.equal(root.dataset.hasDesktopOverflow, 'true');
  assert.equal(toggle.textContent, '방송 더 보기 (9)');
  assert.equal(toggle.attributes['aria-expanded'], 'false');

  listeners.click();
  assert.equal(root.dataset.expanded, 'true');
  assert.equal(toggle.textContent, '방송 접기');
  assert.equal(toggle.attributes['aria-expanded'], 'true');
});
