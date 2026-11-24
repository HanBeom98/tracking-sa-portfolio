import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJson, requestWithTimeout, withRequestDeadline, recordOperation } from '../../src/domains/shared/http-request.js';

const turn = () => new Promise(setImmediate);

test('request deadline aborts a stuck transport without retrying', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, signal;
  const pending = requestJson('/private?token=secret', {}, { timeoutMs: 50, fetchImpl: (_url, init) => {
    calls++; signal = init.signal; return new Promise(() => {});
  } });
  const rejected = assert.rejects(pending, { code: 'REQUEST_TIMEOUT' });
  await turn(); t.mock.timers.tick(50); await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
});

test('request deadline covers body reads after headers arrived', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = requestJson('/api', {}, { timeoutMs: 50, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  const rejected = assert.rejects(pending, { code: 'REQUEST_TIMEOUT' });
  await turn(); t.mock.timers.tick(50); await rejected;
});

test('caller cancellation aborts the fetch and differs from a deadline', async () => {
  const controller = new AbortController();
  let signal;
  const pending = requestJson('/api', {}, { signal: controller.signal, fetchImpl: (_url, init) => { signal = init.signal; return new Promise(() => {}); } });
  const rejected = assert.rejects(pending, { code: 'REQUEST_ABORTED' });
  await turn(); controller.abort(); await rejected;
  assert.equal(signal.aborted, true);
});

test('already cancelled requests never start a network operation', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(requestJson('/api', {}, { signal: controller.signal, fetchImpl: () => { calls++; } }), { code: 'REQUEST_ABORTED' });
  assert.equal(calls, 0);
});

test('JSON and connection failures are classified without retaining provider details', async () => {
  await assert.rejects(requestJson('/api', {}, { fetchImpl: async () => new Response('<bad>') }), { code: 'INVALID_RESPONSE' });
  await assert.rejects(requestWithTimeout('/api', {}, { fetchImpl: async () => { throw new TypeError('token=secret user=Tracking'); } }), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.doesNotMatch(String(error), /secret|Tracking/);
    return true;
  });
  const result = await requestJson('/api', {}, { fetchImpl: async () => new Response('<bad>', { status: 429 }) });
  assert.equal(result.response.status, 429);
  assert.deepEqual(result.data, {});
});

test('successful completion removes its deadline and ignores later caller cancellation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  assert.equal(await withRequestDeadline(async () => 'done', { signal: controller.signal, timeoutMs: 50 }), 'done');
  controller.abort(); t.mock.timers.tick(100);
});

test('operation telemetry accepts only fixed fields and never serializes a supplied error or query', (t) => {
  const events = [];
  t.mock.method(console, 'info', (line) => events.push(JSON.parse(line)));
  recordOperation('public_search', { code: 'REQUEST_TIMEOUT', durationMs: 23, status: 504, requestId: 'safe-id', query: 'Tracking', token: 'secret', error: new Error('private') });
  recordOperation('arbitrary-user-input', { code: 'private' });
  assert.deepEqual(events, [{ event: 'tracking_sa_operation', operation: 'public_search', code: 'REQUEST_TIMEOUT', durationMs: 23, status: 504, requestId: 'safe-id' }]);
});
