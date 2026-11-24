import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSwrUI } from '../../src/domains/stats/sudden-attack/ui/utils/ui-helpers.js';

function statusElement() {
  const classes = new Set();
  return { innerHTML: '', textContent: '', className: '', classList: {
    add: (name) => classes.add(name), remove: (name) => classes.delete(name),
    contains: (name) => classes.has(name),
  } };
}

for (const phase of ['before fade', 'during fade']) {
  test(`old success timer ${phase} cannot hide the next search status`, (t) => {
    const timers = [];
    t.mock.method(globalThis, 'setTimeout', (fn) => { timers.push(fn); });
    const status = statusElement();
    updateSwrUI(status, 'fresh');
    if (phase === 'during fade') timers.shift()();
    updateSwrUI(status, 'hide');
    updateSwrUI(status, 'error');
    timers.forEach((fn) => fn());
    assert.equal(status.classList.contains('hidden'), false);
    assert.equal(status.classList.contains('hidden-out'), false);
    assert.match(status.textContent, /갱신/);
  });
}

test('current success status still fades after its display interval', (t) => {
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (fn) => { timers.push(fn); });
  const status = statusElement();
  updateSwrUI(status, 'fresh');
  timers.shift()();
  assert.equal(status.classList.contains('hidden-out'), true);
  timers.shift()();
  assert.equal(status.classList.contains('hidden'), true);
  assert.equal(status.classList.contains('hidden-out'), false);
});
