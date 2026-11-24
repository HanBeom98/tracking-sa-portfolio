import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_LIST_CACHE_TTL_MS,
  clearBoardListCache,
  readBoardListCache,
  writeBoardListCache
} from "../../src/domains/board/application/board-list-cache.js";

function createStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("board list cache reuses posts for five minutes", () => {
  const storage = createStorage();
  const posts = [{ id: "post-1", createdAt: { seconds: 100 } }];

  assert.equal(writeBoardListCache(posts, { category: "free", storage, now: 1_000 }), true);
  assert.deepEqual(
    readBoardListCache({ category: "free", storage, now: 1_000 + BOARD_LIST_CACHE_TTL_MS - 1 }),
    posts
  );
});

test("board list cache expires and keeps categories isolated", () => {
  const storage = createStorage();
  writeBoardListCache([{ id: "notice-1" }], { category: "notice", storage, now: 1_000 });

  assert.equal(readBoardListCache({ category: "free", storage, now: 1_001 }), null);
  assert.equal(
    readBoardListCache({ category: "notice", storage, now: 1_000 + BOARD_LIST_CACHE_TTL_MS }),
    null
  );
});

test("board list cache fails open when browser storage is unavailable", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };

  assert.equal(readBoardListCache({ storage }), null);
  assert.equal(writeBoardListCache([], { storage }), false);
});

test("board list cache clears all list categories after a write", () => {
  const storage = createStorage();
  writeBoardListCache([{ id: "all" }], { storage });
  writeBoardListCache([{ id: "free" }], { category: "free", storage });
  writeBoardListCache([{ id: "notice" }], { category: "notice", storage });

  clearBoardListCache(storage);

  assert.equal(readBoardListCache({ storage }), null);
  assert.equal(readBoardListCache({ category: "free", storage }), null);
  assert.equal(readBoardListCache({ category: "notice", storage }), null);
});

test('legacy board caches containing emails are discarded instead of reused', () => {
  const storage = createStorage();
  for (const category of ['all', 'free', 'notice']) storage.setItem(`board-list:v1:${category}`, JSON.stringify({ posts: [{ authorEmail: 'private@example.test' }], expiresAt: 999_999 }));
  assert.equal(readBoardListCache({ storage, now: 1000 }), null);
  for (const category of ['all', 'free', 'notice']) assert.equal(storage.getItem(`board-list:v1:${category}`), null);
});

test("board mutations invalidate home notice caches without clearing other storage", () => {
  const storage = createStorage();
  storage.setItem("home-notices:v1:project-a", "cached");
  storage.setItem("home-notices:v1:project-b", "cached");
  storage.setItem("theme", "dark");
  clearBoardListCache(storage);
  assert.equal(storage.getItem("home-notices:v1:project-a"), null);
  assert.equal(storage.getItem("home-notices:v1:project-b"), null);
  assert.equal(storage.getItem("theme"), "dark");
});
