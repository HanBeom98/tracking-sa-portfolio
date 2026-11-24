import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { deleteBoardImages, uploadBoardImages } from '../../src/domains/board/infra/board-image-service.js';
import { reportImageCleanup } from '../../src/domains/board/ui/image-cleanup-feedback.js';

const pathFor = (name) => `board-images/owner/${name}.webp`;
const failure = (code) => Object.assign(new Error(code), { code });

test('cleanup retries only transient failures and preserves per-object outcomes', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const turn = () => new Promise(setImmediate);
  const attempts = new Map();
  let settled = false;
  const pending = deleteBoardImages(['ok', 'retry', 'missing', 'denied', 'exhausted'].map(pathFor), {
    ownerUid: 'owner', storage: { ref: (path) => ({ delete: async () => {
      const times = attempts.get(path) || [];
      times.push(Date.now());
      attempts.set(path, times);
      if (path === pathFor('retry') && times.length === 1) throw failure('storage/network-request-failed');
      if (path === pathFor('missing')) throw failure('storage/object-not-found');
      if (path === pathFor('denied')) throw failure('storage/unauthorized');
      if (path === pathFor('exhausted')) throw failure('storage/retry-limit-exceeded');
    } }) },
  }).then(result => { settled = true; return result; });

  // Advance virtual time at both sides of each backoff boundary. Waiting for
  // real event-loop turns only flushes async Storage results, not the delays.
  await turn();
  assert.deepEqual([...attempts.values()], [[0], [0], [0], [0], [0]]);
  t.mock.timers.tick(249);
  await turn();
  assert.deepEqual(attempts.get(pathFor('retry')), [0]);
  assert.deepEqual(attempts.get(pathFor('exhausted')), [0]);
  assert.equal(settled, false);

  t.mock.timers.tick(1);
  await turn();
  assert.deepEqual(attempts.get(pathFor('retry')), [0, 250]);
  assert.deepEqual(attempts.get(pathFor('exhausted')), [0, 250]);
  t.mock.timers.tick(499);
  await turn();
  assert.deepEqual(attempts.get(pathFor('exhausted')), [0, 250]);
  assert.equal(settled, false);

  t.mock.timers.tick(1);
  const result = await pending;
  assert.deepEqual(result.deletedPaths, ['ok', 'retry'].map(pathFor));
  assert.deepEqual(result.missingPaths, [pathFor('missing')]);
  assert.deepEqual(result.failed, [
    { path: pathFor('denied'), code: 'storage/unauthorized', attempts: 1 },
    { path: pathFor('exhausted'), code: 'storage/retry-limit-exceeded', attempts: 3 },
  ]);
  t.mock.timers.tick(5000);
  await turn();
  assert.deepEqual([...attempts], [
    [pathFor('ok'), [0]],
    [pathFor('retry'), [0, 250]],
    [pathFor('missing'), [0]],
    [pathFor('denied'), [0]],
    [pathFor('exhausted'), [0, 250, 750]],
  ]);
});

test('synchronous reference errors do not prevent cleanup of other images', async () => {
  const result = await deleteBoardImages(['bad', 'ok'].map(pathFor), { ownerUid: 'owner', storage: {
    ref(path) { if (path === pathFor('bad')) throw failure('storage/invalid-argument'); return { delete: async () => {} }; },
  } });
  assert.deepEqual(result.deletedPaths, [pathFor('ok')]);
  assert.deepEqual(result.failed, [{ path: pathFor('bad'), code: 'storage/invalid-argument', attempts: 1 }]);
});

test('unavailable Storage reports unattempted objects instead of silent success', async () => {
  const result = await deleteBoardImages([pathFor('old')], { ownerUid: 'owner' });
  assert.deepEqual(result.failed, [{ path: pathFor('old'), code: 'IMAGE_STORAGE_NOT_READY', attempts: 0 }]);
});

test('Storage initialization failure is returned as a cleanup failure', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {
      firebase: { storage() { throw failure('storage/unauthenticated'); } },
    } });
    const result = await deleteBoardImages([pathFor('old')], { ownerUid: 'owner' });
    assert.equal(result.failed[0].code, 'storage/unauthenticated');
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  }
});

test('foreign paths remain skipped and cannot enter cleanup retries', async () => {
  const touched = [];
  const foreign = 'board-images/other/private.webp';
  const result = await deleteBoardImages([foreign, pathFor('old'), pathFor('old')], { ownerUid: 'owner', storage: {
    ref: (path) => ({ delete: async () => touched.push(path) }),
  } });
  assert.deepEqual(touched, [pathFor('old')]);
  assert.deepEqual(result.skippedPaths, [foreign]);
  assert.equal(result.failed.length, 0);
});

test('upload rollback preserves the original error and exposes cleanup failure', async () => {
  const original = failure('storage/download-failed');
  await assert.rejects(uploadBoardImages({ uid: 'owner', items: [{ file: { name: 'test.png', type: 'image/png', size: 1 } }],
    storage: { ref: () => ({ put: async () => {}, getDownloadURL: async () => { throw original; },
      delete: async () => { throw failure('storage/unauthorized'); } }) },
  }), (error) => {
    assert.equal(error, original);
    assert.equal(error.imageCleanupResult.failed[0].code, 'storage/unauthorized');
    return true;
  });
});

function handlerContext(page, { saveError, cleanupFailure = true, cacheError = false } = {}) {
  const calls = { deleted: [], reports: [], errors: [], alerts: [], submitting: [], saved: 0 };
  const context = {
    postId: 'p1', window: { location: {} }, console: { error() {} },
    t: (_key, fallback) => fallback, alert: (text) => calls.alerts.push(text), confirm: () => true,
    reportImageCleanup: (result) => calls.reports.push(result),
    showError: (error) => calls.errors.push(error),
    clearBoardListCache: () => { if (cacheError) throw Error('cache failed'); }, clearCommentListCache() {},
    createFirestorePostRepository: () => ({}), buildPostService: () => ({}),
    uploadBoardImages: async () => ({ attachments: [{ path: pathFor('new') }], uploadedPaths: [pathFor('new')] }),
    deleteBoardImages: async (paths, { ownerUid }) => {
      calls.deleted.push({ paths: [...paths], ownerUid });
      return { failed: cleanupFailure ? paths.map((path) => ({ path, code: 'storage/unauthorized', attempts: 1 })) : [] };
    },
    getCurrentUser: () => ({ uid: 'owner' }), getCurrentUserProfile: () => ({ nickname: 'Owner' }),
    assertBoardNickname() {}, renderWriteAccess() {}, getBoardRedirectPath: () => '/board',
  };
  const save = async () => { calls.saved++; if (saveError) throw saveError; };
  context.createEditPostUseCases = () => ({ submitEdit: save });
  context.submitPost = save;
  const form = { onSubmit: (fn) => { calls.submit = fn; }, setSubmitting: (value) => calls.submitting.push(value) };
  context.editForm = form;
  context.postView = { onDelete: (fn) => { calls.submit = fn; }, onEdit() {} };
  const source = readFileSync(`src/domains/board/${page}/main.js`, 'utf8');
  const start = page === 'edit' ? 'function attachSubmit(' : page === 'post' ? 'function attachPostActions(' : 'function bindWriteSubmit(';
  const end = page === 'edit' ? 'function buildEditorUser(' : page === 'post' ? 'function buildViewerUser(' : 'function getWritePageElements(';
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  const post = { id: 'p1', authorUid: 'owner', attachments: [{ path: pathFor('old') }] };
  if (page === 'edit') context.attachSubmit(post, { uid: 'owner' });
  else if (page === 'post') context.attachPostActions(post, { uid: 'owner' }, { deletePost: save });
  else context.bindWriteSubmit(form, {});
  return { calls, context };
}

for (const page of ['edit', 'post']) {
  test(`${page}: committed post remains successful when old-image cleanup fails`, async () => {
    const { calls, context } = handlerContext(page);
    await calls.submit({ attachments: [] });
    assert.equal(calls.saved, 1);
    assert.deepEqual(calls.deleted, [{ paths: [pathFor('old')], ownerUid: 'owner' }]);
    assert.equal(calls.reports[0].failed.length, 1);
    assert.deepEqual(calls.errors, []);
    assert.match(context.window.location.href, /\/board/);
  });
}

for (const page of ['edit', 'write']) {
  test(`${page}: failed save cleans new uploads and restores the form despite cleanup failure`, async () => {
    const original = failure('permission-denied');
    const { calls, context } = handlerContext(page, { saveError: original });
    await calls.submit({ attachments: [] });
    assert.deepEqual(calls.deleted, [{ paths: [pathFor('new')], ownerUid: 'owner' }]);
    assert.equal(calls.errors[0], original);
    assert.deepEqual(calls.submitting, [true, false]);
    assert.equal(context.window.location.href, undefined);
    assert.equal(calls.reports[0].failed.length, 1);
  });
  test(`${page}: a post-save UI exception cannot roll back referenced new images`, async () => {
    const { calls } = handlerContext(page, { cacheError: true });
    await assert.rejects(calls.submit({ attachments: [] }), /cache failed/);
    assert.equal(calls.saved, 1);
    assert.deepEqual(calls.deleted, []);
  });
}

test('cleanup feedback is quiet on success and informs only on remaining failures', () => {
  const source = readFileSync('src/domains/board/ui/image-cleanup-feedback.js', 'utf8').replace('export ', '');
  const alerts = [];
  const logs = [];
  const context = { console: { warn: (...args) => logs.push(args) }, alert: (text) => alerts.push(text) };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.reportImageCleanup({ failed: [] });
  context.reportImageCleanup({ failed: [{ path: pathFor('old'), code: 'storage/unauthorized' }] });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /일부 첨부 이미지/);
  assert.equal(logs.length, 1);
  assert.equal(typeof reportImageCleanup, 'function');
});
