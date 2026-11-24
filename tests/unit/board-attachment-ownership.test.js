import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { isOwnedBoardAttachment, isOwnedBoardImagePath } from '../../src/domains/board/domain/attachment-ownership.js';
import { deleteBoardImages, uploadBoardImages } from '../../src/domains/board/infra/board-image-service.js';
import { buildPostService } from '../../src/domains/board/application/postService.js';
import { reportImageCleanup } from '../../src/domains/board/ui/image-cleanup-feedback.js';

const pathFor = (uid, id = 'image') => `board-images/${uid}/${id}.webp`;
const attachmentFor = (uid, id = 'image') => ({
  path: pathFor(uid, id),
  url: `https://firebasestorage.googleapis.com/v0/b/demo-tracking-sa-portfolio.firebasestorage.app/o/${encodeURIComponent(pathFor(uid, id))}?alt=media&token=test`,
  width: 100, align: 'center', name: 'image.png',
});

test('image ownership rejects foreign, nested, encoded and traversal paths', () => {
  assert.equal(isOwnedBoardImagePath(pathFor('owner'), 'owner'), true);
  for (const path of [pathFor('victim'), 'board-images/owner/../victim/image.webp',
    'board-images/owner/nested/image.webp', 'board-images/owner/%2e%2e.webp',
    'board-images/owner/image.webp?other', 'gs://bucket/board-images/owner/image.webp']) {
    assert.equal(isOwnedBoardImagePath(path, 'owner'), false, path);
  }
  assert.equal(isOwnedBoardImagePath(pathFor('owner'), ''), false);
  assert.equal(isOwnedBoardImagePath('board-images/../image.webp', '..'), false);
});

test('attachments bind the URL to the same object in the project bucket', () => {
  const own = attachmentFor('owner');
  assert.equal(isOwnedBoardAttachment(own, 'owner'), true);
  assert.equal(isOwnedBoardAttachment({ ...own, url: own.url.replace('firebasestorage.app', 'appspot.com') }, 'owner'), true);
  for (const url of [attachmentFor('victim').url, own.url.replace('demo-tracking-sa-portfolio', 'another-project'),
    own.url.replace('https:', 'http:'), own.url.replace('/o/', '/another/'),
    own.url.replace('firebasestorage.googleapis.com', 'firebasestorage.googleapis.com.evil.test'),
    own.url + '#fragment', own.url.replace('https://', 'https://user:password@')]) {
    assert.equal(isOwnedBoardAttachment({ ...own, url }, 'owner'), false, url);
  }
});

test('image deletion fails closed without the post owner', async () => {
  const touched = [];
  await deleteBoardImages([pathFor('victim')], { storage: { ref: (path) => { touched.push(path); } } });
  assert.deepEqual(touched, []);
});

test('image deletion ignores foreign and malformed paths and deduplicates own paths', async () => {
  const deleted = [];
  await deleteBoardImages([pathFor('owner'), pathFor('owner'), pathFor('victim'),
    'board-images/owner/../victim/image.webp'], {
    ownerUid: 'owner', storage: { ref: (path) => ({ delete: async () => deleted.push(path) }) },
  });
  assert.deepEqual(deleted, [pathFor('owner')]);
});

test('retained foreign attachments are rejected before any Storage access', async () => {
  await assert.rejects(uploadBoardImages({ uid: 'owner', items: [attachmentFor('victim')],
    storage: { ref() { assert.fail('must not access Storage'); } } }), { code: 'IMAGE_ATTACHMENT_NOT_OWNED' });
});

test('failed uploads clean up only files uploaded for the requested owner', async () => {
  const deleted = [];
  let count = 0;
  const storage = { ref: (path) => ({
    put: async (_file, options) => { assert.equal(options.customMetadata.ownerUid, 'owner'); if (++count === 2) throw Error('upload failed'); },
    getDownloadURL: async () => attachmentFor('owner').url,
    delete: async () => deleted.push(path),
  }) };
  await assert.rejects(uploadBoardImages({ uid: 'owner', storage, items: [
    { file: { name: 'a.png', type: 'image/png', size: 100 } },
    { file: { name: 'b.png', type: 'image/png', size: 100 } },
  ] }), /upload failed/);
  assert.equal(deleted.length, 1);
  assert.equal(isOwnedBoardImagePath(deleted[0], 'owner'), true);
});

test('post service rejects foreign attachments on create and admin edit', async () => {
  const saved = [];
  const service = buildPostService({ postRepository: {
    add: async (data) => saved.push(data), update: async (_id, data) => saved.push(data),
  } });
  const common = { title: 'title', content: 'body' };
  await assert.rejects(service.createPost({ ...common, author: { uid: 'owner', nickname: 'Owner' }, attachments: [attachmentFor('victim')] }), { code: 'IMAGE_ATTACHMENT_NOT_OWNED' });
  await assert.rejects(service.updatePost({ ...common, id: 'p1', user: { uid: 'admin', role: 'admin' },
    post: { authorUid: 'owner' }, attachments: [attachmentFor('admin')] }), { code: 'IMAGE_ATTACHMENT_NOT_OWNED' });
  await service.updatePost({ ...common, id: 'p1', user: { uid: 'admin', role: 'admin' },
    post: { authorUid: 'owner' }, attachments: [attachmentFor('owner')] });
  assert.equal(saved.length, 1);
});

test('admin deleting a legacy post never deletes a foreign attachment', async () => {
  const source = readFileSync('src/domains/board/post/main.js', 'utf8');
  const handler = source.slice(source.indexOf('function attachPostActions('), source.indexOf('function buildViewerUser('));
  const deleted = [];
  let click;
  let postDeleted = false;
  const noop = () => {};
  const storage = { ref: (path) => ({ delete: async () => deleted.push(path) }) };
  const context = {
    postView: { onDelete: (fn) => { click = fn; }, onEdit: noop }, postId: 'p1',
    confirm: () => true, alert: noop, console, reportImageCleanup,
    clearBoardListCache: noop, clearCommentListCache: noop, window: { location: {} },
    deleteBoardImages: (paths, options) => deleteBoardImages(paths, { ...options, storage }),
  };
  vm.createContext(context);
  vm.runInContext(handler, context);
  context.attachPostActions({ id: 'p1', authorUid: 'owner', attachments: [attachmentFor('owner'), attachmentFor('victim')] },
    { uid: 'admin', role: 'admin' }, { deletePost: async () => { postDeleted = true; } });
  await click();
  assert.equal(postDeleted, true);
  assert.deepEqual(deleted, [pathFor('owner')]);
});

test('admin edit uploads and cleans removed images in the post authors directory', async () => {
  const source = readFileSync('src/domains/board/edit/main.js', 'utf8');
  const handler = source.slice(source.indexOf('function attachSubmit('), source.indexOf('function buildEditorUser('));
  let submit;
  const owners = [];
  const deleted = [];
  const noop = () => {};
  const storage = { ref: (path) => ({ delete: async () => deleted.push(path) }) };
  const context = {
    editForm: { onSubmit: (fn) => { submit = fn; }, setSubmitting: noop }, postId: 'p1',
    uploadBoardImages: async ({ uid }) => { owners.push(uid); return { attachments: [attachmentFor('owner', 'new')], uploadedPaths: [] }; },
    deleteBoardImages: (paths, options) => deleteBoardImages(paths, { ...options, storage }),
    createFirestorePostRepository: () => ({}), buildPostService: () => ({}),
    createEditPostUseCases: () => ({ submitEdit: async () => {} }),
    clearBoardListCache: noop, alert: noop, t: (_key, fallback) => fallback,
    window: { location: {} }, console, showError: assert.fail, reportImageCleanup,
  };
  vm.createContext(context);
  vm.runInContext(handler, context);
  context.attachSubmit({ authorUid: 'owner', attachments: [attachmentFor('owner', 'old'), attachmentFor('victim')] }, { uid: 'admin', role: 'admin' });
  await submit({ attachments: [] });
  assert.deepEqual(owners, ['owner']);
  assert.deepEqual(deleted, [pathFor('owner', 'old')]);
});
