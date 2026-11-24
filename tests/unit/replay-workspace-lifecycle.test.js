import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayWorkspaceSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-workspace-session.js';
import { createReplayOutputController } from '../../src/domains/stats/sudden-attack/replay/ui/replay-output-controller.js';
import { createReplayPreviewController } from '../../src/domains/stats/sudden-attack/replay/ui/replay-preview-controller.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture } from '../fixtures/replay-context.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const analysis = () => analyzeReplay(contextFixture(), 'focus');
function sessionWithResult() {
  const session = createReplayWorkspaceSession(), replay = contextFixture();
  session.acceptReplay(session.beginLoad(), replay); session.setAnalysis(analysis());
  return { session, replay, result: session.analysis };
}

test('replacement file tickets reject old success and failure without clearing the new result', () => {
  const session = createReplayWorkspaceSession(), old = session.beginLoad(), current = session.beginLoad();
  const replay = contextFixture();
  assert.equal(session.acceptReplay(current, replay), true); session.setAnalysis(analysis());
  const result = session.analysis;
  assert.equal(session.acceptReplay(old, {}), false); session.failLoad(old);
  assert.equal(session.replay, replay); assert.equal(session.currentAnalysis('focus'), result);
  assert.equal(session.currentAnalysis('mate'), null);
  session.clearAnalysis(); assert.equal(session.currentAnalysis('focus'), null);
  assert.equal(session.canAnalyze('mate'), true);
});

test('sample tickets survive sample parsing but not user files, mode cancellation or reset', () => {
  const session = createReplayWorkspaceSession();
  const sample = session.beginSample(); session.beginLoad({ sample: true });
  assert.equal(session.isSampleCurrent(sample), true); assert.equal(session.isSample, true);
  session.beginLoad(); assert.equal(session.isSampleCurrent(sample), false);
  const next = session.beginSample(); session.cancelSample(); assert.equal(session.isSampleCurrent(next), false);
  const last = session.beginSample(), load = session.beginLoad({ sample: true }); session.reset();
  assert.equal(session.isSampleCurrent(last), false); assert.equal(session.isLoadCurrent(load), false);
  assert.equal(session.canAnalyze('focus'), false); assert.equal(session.isSample, false);
});

test('comparison cancels in-flight single loading while retaining its completed analysis', () => {
  const { session, result, replay } = sessionWithResult();
  session.cancelLoad(); assert.equal(session.replay, replay); assert.equal(session.currentAnalysis('focus'), result);
  session.dispose(); session.dispose();
  assert.equal(session.currentAnalysis('focus'), null); assert.equal(session.canAnalyze('focus'), false);
  const ticket = session.beginLoad(); assert.equal(session.acceptReplay(ticket, replay), false);
});

function outputHarness(overrides = {}) {
  let result = analysis();
  const button = { isConnected: true, innerHTML: '이미지 공유', disabled: false, hasAttribute: () => false };
  const status = { isConnected: true, textContent: '' };
  const results = { querySelector: () => status, querySelectorAll: () => [button] };
  const playback = { pauses: 0, pause() { this.pauses++; } };
  const controller = createReplayOutputController({ results, getAnalysis: () => result, getPlayback: () => playback,
    isVisible: () => true, location: new URL('https://trackingsa.com/') }, overrides);
  return { controller, button, status, playback, change() { result = analysis(); } };
}

test('canceling PNG creation restores controls immediately and late work cannot open or unlock a new job', async () => {
  const old = deferred(), next = deferred(); let encodings = 0, opens = 0;
  const h = outputHarness({ createBlob: () => (++encodings === 1 ? old.promise : next.promise),
    loadShare: async () => ({ openReplayImageShare() { opens++; return () => {}; } }) });
  const first = h.controller.share(h.button);
  assert.equal(h.button.disabled, true);
  h.controller.closeShare(); assert.equal(h.button.disabled, false);
  const second = h.controller.share(h.button);
  old.resolve(new Blob(['old'])); await first;
  assert.equal(opens, 0); assert.equal(h.button.disabled, true);
  next.resolve(new Blob(['new'])); await second;
  assert.equal(opens, 1); assert.equal(h.button.disabled, false);
});

test('replaced analysis and disposed exports cannot open stale reports or image previews', async () => {
  const report = deferred(), png = deferred(); let opens = 0;
  const h = outputHarness({ loadPrint: () => report.promise, createBlob: () => png.promise,
    loadShare: async () => ({ openReplayImageShare() { opens++; } }) });
  const printing = h.controller.print(h.button); h.change();
  report.resolve({ openReplayPrintReport() { opens++; } }); await printing;
  assert.equal(opens, 0);
  const sharing = h.controller.share(h.button); h.controller.dispose();
  png.resolve(new Blob(['png'])); await sharing; assert.equal(opens, 0);
});

test('clear releases open output resources exactly once and a new report can still open', async () => {
  let reportClosed = 0, shareClosed = 0;
  const h = outputHarness({ loadPrint: async () => ({ openReplayPrintReport(_a, options) {
    return () => { reportClosed++; options.onClose(); };
  } }), createBlob: async () => new Blob(['png']), loadShare: async () => ({ openReplayImageShare(options) {
    return () => { shareClosed++; options.onClose(); };
  } }) });
  await h.controller.print(h.button); await h.controller.share(h.button);
  h.controller.clear(); h.controller.clear(); assert.equal(reportClosed, 1); assert.equal(shareClosed, 1);
  await h.controller.print(h.button); h.controller.dispose(); assert.equal(reportClosed, 2);
  assert.equal(h.playback.pauses, 2);
});

test('a canceled print import cannot unlock a newer pending print on the same button', async () => {
  const old = deferred(), next = deferred(); let calls = 0;
  const h = outputHarness({ loadPrint: () => (++calls === 1 ? old.promise : next.promise) });
  const first = h.controller.print(h.button); h.controller.closePrint();
  const second = h.controller.print(h.button);
  old.resolve({ openReplayPrintReport() { assert.fail('stale report opened'); } }); await first;
  assert.equal(h.button.disabled, true);
  next.resolve({ openReplayPrintReport: () => () => {} }); await second;
  assert.equal(h.button.disabled, false);
});

function previewHarness(url, loaders) {
  let result = analysis(), visible = true;
  const panel = { remove() {} };
  const results = { classList: { contains: () => !visible }, querySelector: () => panel, insertAdjacentHTML() {} };
  const controller = createReplayPreviewController({ results, shell: {}, location: new URL(url), getAnalysis: () => result,
    getPlayback: () => null, scrollBehavior: 'auto' }, loaders);
  return { controller, get result() { return result; }, change() { result = analysis(); }, hide() { visible = false; } };
}

test('production and non-opt-in pages load none of the local preview or purchase modules', async () => {
  const forbidden = () => assert.fail('local module loaded outside opt-in');
  for (const url of ['https://trackingsa.com/?coaching=review&transport=api&purchase=flow', 'http://localhost:4173/?coaching=review', 'http://127.0.0.1:4173/']) {
    const h = previewHarness(url, { loadCoaching: forbidden, loadPurchase: forbidden, loadEngine: forbidden, loadReview: forbidden, loadApi: forbidden });
    await h.controller.show(h.result, {}); h.controller.dispose();
  }
});

test('late purchase and mock modules never mount after disposal', async () => {
  for (const mode of ['review&transport=api&purchase=flow', 'mock']) {
    const gate = deferred();
    const h = previewHarness('http://127.0.0.1:4173/?coaching=' + mode, { loadPurchase: () => gate.promise, loadCoaching: () => gate.promise });
    h.controller.dispose();
    gate.resolve({ mountReplayPurchaseFlow() { assert.fail('late purchase mounted'); }, createLocalReplayCoachingPanel() { assert.fail('late mock mounted'); } });
    await tick();
  }
});

test('purchase UI survives replay resets but its page disposer runs only once', async () => {
  let closed = 0;
  const h = previewHarness('http://127.0.0.1:4173/?coaching=review&transport=api&purchase=flow', {
    loadPurchase: async () => ({ mountReplayPurchaseFlow: () => () => { closed++; } }),
  });
  await tick(); h.controller.clear(); assert.equal(closed, 0);
  h.controller.dispose(); h.controller.dispose(); assert.equal(closed, 1);
});

test('a replaced review ignores its late API adapter; current reviews retain the same request history', async () => {
  const api = deferred(); const histories = []; let renders = 0, released = 0;
  const h = previewHarness('http://127.0.0.1:4173/?coaching=review&transport=api', {
    loadEngine: async () => ({ buildReplayCoachingReview: () => ({ candidates: [] }) }),
    loadReview: async () => ({ isLocalReviewPreview: () => true, renderReplayReviewPanel() { renders++; return ''; } }),
    loadApi: () => api.promise,
  });
  const first = h.controller.show(h.result, {}); await tick(); assert.equal(renders, 1);
  h.change(); h.controller.clear();
  api.resolve({ mountReplayReviewApi(_p, _r, options) { histories.push(options.records); return () => { released++; }; } });
  await first; assert.equal(histories.length, 0);
  await h.controller.show(h.result, {}); h.controller.clear();
  await h.controller.show(h.result, {}); h.controller.dispose();
  assert.equal(histories.length, 2); assert.equal(histories[0], histories[1]); assert.equal(released, 2);
});
