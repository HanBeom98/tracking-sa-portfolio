import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_IMAGE_MAX_BYTES,
  ensureBoardImageStorage,
  normalizeBoardAttachment,
  parseBoardImageToken,
  uploadBoardImages,
  validateBoardImageFile,
} from '../../src/domains/board/infra/board-image-service.js';

test('board image validation allows common static web image types', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.doesNotThrow(() => validateBoardImageFile({ type, size: 1024 }));
  }
});

test('board image validation rejects SVG, GIF and oversized files', () => {
  assert.throws(() => validateBoardImageFile({ type: 'image/svg+xml', size: 100 }), /IMAGE_TYPE_NOT_ALLOWED/);
  assert.throws(() => validateBoardImageFile({ type: 'image/gif', size: 100 }), /IMAGE_TYPE_NOT_ALLOWED/);
  assert.throws(() => validateBoardImageFile({ type: 'image/png', size: BOARD_IMAGE_MAX_BYTES + 1 }), /IMAGE_TOO_LARGE/);
});

test('normalizeBoardAttachment bounds width and alignment', () => {
  assert.deepEqual(normalizeBoardAttachment({ width: 500, align: 'float', name: 'a'.repeat(150) }), {
    url: '', path: '', width: 100, align: 'center', name: 'a'.repeat(120),
  });
});

test('uploadBoardImages does not require Storage when no image is attached', async () => {
  assert.deepEqual(await uploadBoardImages({ items: [], uid: 'user', storage: null }), {
    attachments: [], uploadedPaths: [],
  });
});

test('ensureBoardImageStorage keeps an already initialized Storage instance', async () => {
  const storage = { ref() {} };
  assert.equal(await ensureBoardImageStorage(storage), storage);
});

test('parseBoardImageToken accepts only bounded standalone image blocks', () => {
  assert.equal(parseBoardImageToken('[[board-image:1]]', 3), 1);
  assert.equal(parseBoardImageToken('text [[board-image:1]]', 3), null);
  assert.equal(parseBoardImageToken('[[board-image:3]]', 3), null);
  assert.equal(parseBoardImageToken('[[board-image:-1]]', 3), null);
});
