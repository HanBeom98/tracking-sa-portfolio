import test from "node:test";
import assert from "node:assert/strict";
import { buildPostService } from "../../src/domains/board/application/postService.js";

function createRepositoryStub() {
  const calls = {
    add: [],
    update: [],
    remove: [],
  };
  return {
    calls,
    repo: {
      add: async (payload) => calls.add.push(payload),
      getById: async (id) => ({ id, title: "t", content: "c", authorUid: "u1" }),
      list: async ({ limit }) => [{ id: "p1", limit }],
      update: async (id, payload) => calls.update.push({ id, payload }),
      remove: async (id) => calls.remove.push({ id }),
    },
  };
}

test("postService createPost uses displayName or email for authorName", async () => {
  const { repo, calls } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });

  await service.createPost({
    title: "제목",
    content: "내용",
    author: { uid: "u1", displayName: "Tracking", email: "a@b.com", photoURL: "p" },
  });
  await service.createPost({
    title: "제목2",
    content: "내용2",
    author: { uid: "u2", email: "b@c.com", photoURL: "" },
  });

  assert.equal(calls.add.length, 2);
  assert.equal(calls.add[0].authorName, "Tracking");
  assert.equal(calls.add[1].authorName, "b@c.com");
});

test("postService update/delete reject non-author user", async () => {
  const { repo } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });
  const post = { id: "p1", authorUid: "u1", title: "t", content: "c" };
  const user = { uid: "u2" };

  await assert.rejects(
    service.updatePost({ id: "p1", title: "new", content: "new", user, post }),
    (error) => error && error.code === "NOT_AUTHORIZED"
  );
  await assert.rejects(
    service.deletePost({ id: "p1", user, post }),
    (error) => error && error.code === "NOT_AUTHORIZED"
  );
});

test("postService canEditPost returns true only for same author", async () => {
  const { repo } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });
  const post = { id: "p1", authorUid: "u1" };

  assert.equal(service.canEditPost({ user: { uid: "u1" }, post }), true);
  assert.equal(service.canEditPost({ user: { uid: "u2" }, post }), false);
});
