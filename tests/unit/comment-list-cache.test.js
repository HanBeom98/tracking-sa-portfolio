import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMENT_LIST_CACHE_TTL_MS,
  clearCommentListCache,
  readCommentListCache,
  writeCommentListCache
} from "../../src/domains/board/application/comment-list-cache.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("comment list cache reuses a post's comments for one minute", () => {
  const storage = createStorage();
  const comments = [{ id: "comment-1", content: "hello" }];

  assert.equal(writeCommentListCache(comments, { postId: "post-1", storage, now: 1_000 }), true);
  assert.deepEqual(
    readCommentListCache({
      postId: "post-1",
      storage,
      now: 1_000 + COMMENT_LIST_CACHE_TTL_MS - 1
    }),
    comments
  );
  assert.equal(readCommentListCache({ postId: "post-2", storage, now: 1_001 }), null);

  clearCommentListCache("post-1", storage);
  assert.equal(readCommentListCache({ postId: "post-1", storage, now: 1_001 }), null);
});

test('legacy comment names containing emails are not reused after privacy migration', () => {
  const storage = createStorage();
  storage.setItem('board-comments:v1:p1', JSON.stringify({ comments: [{ authorName: 'private@example.test' }], expiresAt: 999_999 }));
  assert.equal(readCommentListCache({ postId: 'p1', storage, now: 1000 }), null);
  assert.equal(storage.getItem('board-comments:v1:p1'), null);
});
