import test from "node:test";
import assert from "node:assert/strict";
import { buildCommentService } from "../../src/domains/board/application/commentService.js";

function setup() {
  const calls = { add: [], remove: [], softDelete: [] };
  const repository = {
    list: async () => [{ id: "c1", content: "hello" }],
    add: async (...args) => calls.add.push(args),
    remove: async (...args) => calls.remove.push(args),
    softDelete: async (...args) => calls.softDelete.push(args),
  };
  return { service: buildCommentService({ commentRepository: repository }), calls };
}

test("comments can be created only on free posts", async () => {
  const { service, calls } = setup();
  const user = { uid: "u1", nickname: "사용자", displayName: "stale" };
  await service.createComment({ post: { id: "p1", category: "free" }, content: "  반가워요  ", user });
  assert.equal(calls.add[0][1].content, "반가워요");
  assert.equal(calls.add[0][1].parentId, null);
  assert.equal(calls.add[0][1].authorName, "사용자");
  assert.equal("authorEmail" in calls.add[0][1], false);
  await assert.rejects(() => service.createComment({ post: { id: "n1", category: "notice" }, content: "댓글", user }), { code: "COMMENTS_NOT_ALLOWED" });
});

test("replies reference a top-level comment and cannot nest again", async () => {
  const { service, calls } = setup();
  const post = { id: "p1", category: "free" };
  const user = { uid: "u1", nickname: "사용자", displayName: "stale" };
  await service.createComment({ post, content: "답글", user, parentComment: { id: "c1", parentId: null } });
  assert.equal(calls.add[0][1].parentId, "c1");
  await assert.rejects(() => service.createComment({ post, content: "중첩", user, parentComment: { id: "r1", parentId: "c1" } }), { code: "INVALID_PARENT_COMMENT" });
});

test("comment deletion is limited to its author or an admin", async () => {
  const { service, calls } = setup();
  const post = { id: "p1", category: "free" };
  const comment = { id: "c1", authorUid: "u1", parentId: "parent-1" };
  await assert.rejects(() => service.deleteComment({ post, comment, user: { uid: "u2", role: "free" } }), { code: "NOT_AUTHORIZED" });
  await service.deleteComment({ post, comment, user: { uid: "admin", role: "admin" } });
  assert.deepEqual(calls.remove[0], ["p1", "c1"]);
});

test("deleting any parent keeps a tombstone so concurrent replies cannot become orphaned", async () => {
  const { service, calls } = setup();
  const post = { id: "p1", category: "free" };
  const comment = { id: "c1", authorUid: "u1", parentId: null };
  await service.deleteComment({ post, comment, user: { uid: "u1", role: "free" } });
  assert.deepEqual(calls.softDelete[0], ["p1", "c1"]);
  assert.equal(calls.remove.length, 0);
});
