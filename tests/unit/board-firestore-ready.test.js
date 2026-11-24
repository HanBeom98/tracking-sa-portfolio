import {test, describe, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {waitForFirestoreReady} from '../../src/domains/board/infra/firestore-ready.js';

describe('board Firestore readiness', () => {
  let previousWindow;
  beforeEach(t => {
    previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {configurable: true, writable: true, value: {}});
    t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: 0});
  });
  afterEach(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });
  async function tick(t, milliseconds) {
    t.mock.timers.tick(milliseconds);
    await Promise.resolve();
  }

  test('a ready Firestore lets the caller continue without a polling delay', async () => {
    const db = {collection() { throw new Error('Waiting must not issue database queries'); }};
    window.db = db;
    assert.equal(await waitForFirestoreReady(), undefined);
    assert.equal(Date.now(), 0);
    assert.equal(window.db, db);
  });

  test('delayed SDK initialization releases a waiting caller on a later poll', async t => {
    let continued = false;
    const waiting = waitForFirestoreReady().then(() => { continued = true; });
    await tick(t, 50);
    assert.equal(continued, false);
    window.db = {};
    await tick(t, 50);
    await waiting;
    assert.equal(continued, true);
    assert.equal(Date.now(), 100);
  });

  test('missing Firestore preserves the default deadline and existing error message', async t => {
    let rejected = false;
    const checked = assert.rejects(waitForFirestoreReady(), {message: 'FIRESTORE_NOT_READY'})
      .then(() => { rejected = true; });
    await tick(t, 5000);
    assert.equal(rejected, false); // The existing condition is > timeout, not >=.
    await tick(t, 50);
    await checked;
    assert.equal(rejected, true);
  });

  test('callers can retain a custom deadline without changing the polling interval', async t => {
    const checked = assert.rejects(waitForFirestoreReady(100), {message: 'FIRESTORE_NOT_READY'});
    await tick(t, 50);
    await tick(t, 50);
    await tick(t, 50);
    await checked;
    assert.equal(Date.now(), 150);
  });

  test('SDK readiness wins when a delayed timer resumes after the nominal deadline', async t => {
    const waiting = waitForFirestoreReady(100);
    t.mock.timers.tick(150);
    window.db = {}; // Browser timer throttling must not reject an already ready SDK.
    await waiting;
  });
});
