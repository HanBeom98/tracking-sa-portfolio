import test from 'node:test';
import assert from 'node:assert/strict';
import { createShareCardController, createShareCardModel } from '../../src/domains/stats/sudden-attack/ui/share-card.js';
import { createActionMeasurement } from '../../src/domains/stats/sudden-attack/ui/runtime/action-measurement.js';
import { createProductAnalytics } from '../../src/shared/assets/product-analytics.js';
import { measurementBrowser } from '../helpers/measurement-browser.js';

const deferred = () => { let resolve, reject; const promise = new Promise((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
const model = name => createShareCardModel({ player: { nickname: name } }, {}, 'https://trackingsa.com/stats/sudden-attack/');
function fixture(options = {}) {
  const browser = measurementBrowser(), events = [], downloads = [], revoked = [], calls = [];
  const client = createProductAnalytics({ getPageContext: () => ({ page_location: 'https://trackingsa.com/stats/sudden-attack/' }), now: browser.window.performance.now });
  client.setTransport((name, fields) => events.push({ name, ...fields }));
  const actions = createActionMeasurement({ windowRef: browser.window, getAnalytics: () => client });
  const shareButton = { disabled: false, addEventListener() {} }, status = { textContent: '' };
  const downloadClasses = new Set(['hidden']);
  const downloadButton = { disabled: true, addEventListener() {}, classList: { add: c => downloadClasses.add(c), remove: c => downloadClasses.delete(c) } };
  const navigatorRef = options.navigator || { clipboard: { write: async items => { await items[0].items['image/png']; calls.push(['image', items]); }, writeText: async text => calls.push(['link', text]) } };
  if (options.native) {
    navigatorRef.canShare = () => true;
    navigatorRef.share = async value => { calls.push(['native', value]); if (options.native === 'cancel') throw { name: 'AbortError' }; if (options.native === 'failure') throw new Error('native failure'); };
  }
  const controller = createShareCardController({
    panel: { classList: { toggle() {} }, querySelector: () => null }, shareButton, status, downloadButton,
    navigatorRef, windowRef: browser.window, ResizeObserverRef: null,
    getPageUrl: () => 'https://trackingsa.com/stats/sudden-attack/?n=other-page-name',
    matchMediaRef: () => ({ matches: Boolean(options.native) }),
    ClipboardItemRef: class { constructor(items) { this.items = items; } },
    documentRef: { createElement: () => ({ click() { if (options.downloadFails) throw new Error('download failed'); downloads.push({ href: this.href, download: this.download }); } }) },
    urlRef: { createObjectURL: () => 'blob:fixture', revokeObjectURL: value => revoked.push(value) },
    createBlob: options.createBlob || (async value => { calls.push(['blob', value.nickname]); return new Blob(['png'], { type: 'image/png' }); }),
    startMeasurement: options.startMeasurement || actions.startShare,
    waitingNoticeMs: options.waitingNoticeMs ?? 8000,
    generationTimeoutMs: options.generationTimeoutMs ?? 15000,
  });
  controller.render(model('private-A'));
  return { ...browser, controller, events, downloads, revoked, calls, shareButton, status, downloadButton, downloadClasses,
    finishes: () => events.filter(e => e.name === 'sa_share_finish') };
}

test('image copy and link copy emit success only after their promises resolve', async () => {
  const image = deferred(), link = deferred();
  const f = fixture({ navigator: { clipboard: { write: () => image.promise, writeText: () => link.promise } } });
  const imageTask = f.controller.share(), linkTask = f.controller.copyLink();
  await new Promise(setImmediate); assert.equal(f.finishes().length, 0); assert.equal(f.shareButton.disabled, true);
  link.resolve(); await linkTask;
  assert.equal(f.finishes()[0].method, 'clipboard_link');
  image.resolve(); await imageTask;
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['clipboard_link', 'success'], ['clipboard_image', 'success']]);
  assert.equal(f.shareButton.disabled, false);
  assert.ok(!JSON.stringify(f.events).includes('private-'));
});

test('image copy requests clipboard access during the click before asynchronous PNG generation finishes', async () => {
  const image = deferred(), writes = [];
  const png = new Blob(['png'], { type: 'image/png' });
  const f = fixture({ createBlob: () => image.promise, navigator: { clipboard: { write: async items => {
    writes.push(items[0].items['image/png']);
    assert.equal(await items[0].items['image/png'], png);
  } } } });
  const task = f.controller.share();
  assert.equal(writes.length, 1); // No await/microtask may precede the permission request.
  assert.equal(f.finishes().length, 0);
  assert.equal(f.shareButton.disabled, true);
  await new Promise(setImmediate);
  assert.equal(f.downloads.length, 0);
  image.resolve(png); await task;
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['clipboard_image', 'success']]);
});

test('early clipboard denial waits for the same PNG then falls back once without an unhandled rejection', async () => {
  const image = deferred(); let renders = 0, writes = 0;
  const f = fixture({ createBlob: () => { renders++; return image.promise; }, navigator: { clipboard: {
    write: () => { writes++; return Promise.reject(new Error('denied before PNG ready')); },
  } } });
  const task = f.controller.share();
  await new Promise(setImmediate);
  assert.equal(f.shareButton.disabled, true); assert.equal(f.downloads.length, 0); assert.equal(f.finishes().length, 0);
  image.resolve(new Blob(['png'], { type: 'image/png' })); await task;
  assert.equal(renders, 1); assert.equal(writes, 1); assert.equal(f.downloads.length, 1);
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['png_download', 'download_requested']]);
  assert.equal(f.shareButton.disabled, false);
});

for (const native of ['success', 'cancel', 'failure']) {
  test(`native ${native} has exactly one finish and PNG fallback is not a second attempt`, async () => {
    const f = fixture({ native }); await f.controller.share();
    assert.equal(f.events.filter(e => e.name === 'sa_share_start').length, 1);
    assert.equal(f.finishes().length, 1);
    assert.deepEqual([f.finishes()[0].method, f.finishes()[0].outcome], native === 'failure' ? ['png_download', 'download_requested'] : ['native', native === 'cancel' ? 'cancelled' : 'success']);
    assert.equal(f.downloads.length, native === 'failure' ? 1 : 0);
    assert.equal(f.calls.filter(([type]) => type === 'image').length, 0);
    assert.equal(f.shareButton.disabled, false);
    if (native === 'cancel') assert.match(f.status.textContent, /취소했습니다/);
    if (native === 'failure') assert.match(f.status.textContent, /저장을 요청/);
  });
}

test('unsupported image clipboard requests PNG once and never reports successful sharing', async () => {
  const f = fixture({ navigator: {} }); await f.controller.share();
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['png_download', 'download_requested']]);
  assert.equal(f.downloads[0].download, 'tracking-sa-private-A.png');
  assert.deepEqual(f.revoked, ['blob:fixture']);
});

test('clipboard rejection and failed PNG request produce one final failure and release its URL', async () => {
  const f = fixture({ navigator: { clipboard: { write: async () => { throw new Error('private failure'); } } }, downloadFails: true });
  await f.controller.share();
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome, e.error_code]), [['png_download', 'failure', 'unknown']]);
  assert.deepEqual(f.revoked, ['blob:fixture']); assert.equal(f.shareButton.disabled, false);
});

test('failed image generation finishes once without automatically generating the same image again', async () => {
  let renders = 0;
  const f = fixture({ createBlob: async () => { renders++; throw new Error('private canvas error'); } });
  await f.controller.share(); assert.equal(renders, 1); assert.equal(f.downloads.length, 0);
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['clipboard_image', 'failure']]);
});

test('a clipboard AbortError does not become a native user cancellation or add a fallback', async () => {
  const f = fixture({ navigator: { clipboard: { write: async () => { throw { name: 'AbortError' }; } } } });
  await f.controller.share();
  assert.deepEqual(f.finishes().map(e => [e.method, e.outcome]), [['clipboard_image', 'failure']]);
  assert.equal(f.downloads.length, 0);
});

test('link rejection is a failure, while absent model is not an accepted attempt', async () => {
  const f = fixture({ navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
  await f.controller.copyLink(); assert.equal(f.finishes()[0].outcome, 'failure');
  f.controller.render(null); const before = f.events.length;
  await f.controller.copyLink(); await f.controller.share(); assert.equal(f.events.length, before);
});

test('pending image action keeps its snapshot and rejects duplicate actions across model changes', async () => {
  const gate = deferred(), rendered = [];
  const f = fixture({ navigator: {}, createBlob: async value => { rendered.push(value.nickname); await gate.promise; return new Blob(['png']); } });
  const a = f.controller.share(); f.controller.render(model('private-B'));
  await f.controller.share(); f.controller.render(null);
  gate.resolve(); await a;
  assert.deepEqual(rendered, ['private-A']);
  assert.equal(f.status.textContent, '');
  f.controller.render(model('private-B')); await f.controller.share();
  assert.deepEqual(rendered, ['private-A', 'private-B']);
  assert.deepEqual(f.downloads.map(d => d.download), ['tracking-sa-private-A.png', 'tracking-sa-private-B.png']);
  assert.equal(f.finishes().length, 2);
});

for (const lateResult of ['resolve', 'reject']) {
  test(`explicit PNG recovery finishes once while pending clipboard later ${lateResult}s`, async () => {
    const gate = deferred();
    const f = fixture({ navigator: { clipboard: { write: () => gate.promise } }, waitingNoticeMs: 1 });
    const task = f.controller.share();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(f.downloadClasses.has('hidden'), false);
    assert.match(f.status.textContent, /응답이 늦어/);
    assert.equal(f.finishes().length, 0);
    await f.controller.downloadPendingImage(); await f.controller.downloadPendingImage();
    assert.equal(f.downloads.length, 1);
    assert.equal(f.shareButton.disabled, true); // The browser write cannot be cancelled; do not issue another.
    assert.deepEqual(f.finishes().map(e => [e.method,e.outcome]), [['png_download','download_requested']]);
    const message = f.status.textContent;
    if (lateResult === 'resolve') gate.resolve(); else gate.reject(new Error('late rejection'));
    await task;
    assert.equal(f.status.textContent, message);
    assert.equal(f.finishes().length, 1); assert.equal(f.downloads.length, 1);
    assert.equal(f.shareButton.disabled, false);
  });
}

test('slow clipboard success is not recorded as failure by the waiting notice', async () => {
  const gate = deferred(); const f = fixture({ navigator: { clipboard: { write: () => gate.promise } }, waitingNoticeMs: 1 });
  const task = f.controller.share(); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(f.finishes().length, 0); assert.equal(f.downloads.length, 0);
  gate.resolve(); await task;
  assert.equal(f.finishes()[0].outcome, 'success'); assert.equal(f.downloads.length, 0);
});

test('a newer link message is not overwritten by an older image action', async () => {
  const gate = deferred(); const f = fixture({ navigator: { clipboard: { write: () => gate.promise, writeText: async () => {} } } });
  const task = f.controller.share(); await new Promise(setImmediate);
  await f.controller.copyLink(); const message=f.status.textContent;
  gate.resolve(); await task; assert.equal(f.status.textContent, message);
  assert.equal(f.finishes().length, 2);
});

test('switching the result during a browser write explains its state without displaying an old success', async () => {
  const gate=deferred();const f=fixture({navigator:{clipboard:{write:()=>gate.promise}}});
  const task=f.controller.share();await new Promise(setImmediate);f.controller.render(model('private-B'));
  assert.match(f.status.textContent,/이전 카드 작업/);assert.equal(f.shareButton.disabled,true);
  gate.resolve();await task;
  assert.match(f.status.textContent,/현재 카드를 공유/);assert.equal(f.shareButton.disabled,false);
  assert.equal(f.finishes().length,1);
});

test('generation deadline restores the button and ignores a late generated image', async () => {
  const gate = deferred(); const f = fixture({ createBlob: () => gate.promise, generationTimeoutMs: 1 });
  await f.controller.share(); assert.equal(f.shareButton.disabled, false);
  assert.equal(f.finishes()[0].error_code, 'timeout'); assert.equal(f.downloads.length, 0);
  gate.resolve(new Blob(['late'])); await new Promise(setImmediate);
  assert.equal(f.calls.length, 0); assert.equal(f.finishes().length, 1);
});

test('throwing measurement callbacks cannot change actual share/link success or button recovery', async () => {
  for (const startMeasurement of [() => { throw new Error('start failed'); }, () => ({ finish() { throw new Error('finish failed'); } })]) {
    const f = fixture({ startMeasurement }); await f.controller.share(); await f.controller.copyLink();
    assert.equal(f.calls.filter(([type]) => ['image', 'link'].includes(type)).length, 2);
    assert.equal(f.downloads.length, 0); assert.equal(f.shareButton.disabled, false);
  }
});
