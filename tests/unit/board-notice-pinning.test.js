import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTICE_PIN_DURATION_DAYS,
  isActivePinnedNotice,
  sortPostsWithActiveNoticesFirst,
} from "../../src/domains/board/domain/noticePinning.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.UTC(2026, 6, 22);
const timestamp = (ms) => ({ seconds: Math.floor(ms / 1000) });

test("notice remains pinned for 14 days and expires at the boundary", () => {
  const recentNotice = { category: "notice", createdAt: timestamp(NOW_MS - 13 * DAY_MS) };
  const expiredNotice = {
    category: "notice",
    createdAt: timestamp(NOW_MS - NOTICE_PIN_DURATION_DAYS * DAY_MS),
  };

  assert.equal(isActivePinnedNotice(recentNotice, NOW_MS), true);
  assert.equal(isActivePinnedNotice(expiredNotice, NOW_MS), false);
  assert.equal(isActivePinnedNotice({ ...recentNotice, category: "free" }, NOW_MS), false);
});

test("only active notices sort above newer free posts", () => {
  const posts = [
    { id: "active", category: "notice", createdAt: timestamp(NOW_MS - 2 * DAY_MS) },
    { id: "free", category: "free", createdAt: timestamp(NOW_MS - DAY_MS) },
    { id: "expired", category: "notice", createdAt: timestamp(NOW_MS - 20 * DAY_MS) },
  ];

  assert.deepEqual(
    sortPostsWithActiveNoticesFirst(posts, NOW_MS).map((post) => post.id),
    ["active", "free", "expired"],
  );
});
