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
      getById: async (id) => ({ id, title: "t", content: "c", authorUid: "u1", category: "free" }),
      list: async ({ limit, category }) => [{ id: "p1", limit, category }],
      update: async (id, payload) => calls.update.push({ id, payload }),
      remove: async (id) => calls.remove.push({ id }),
    },
  };
}

test("postService createPost uses displayName or email for authorName and supports category", async () => {
  const { repo, calls } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });

  await service.createPost({
    title: "제목",
    content: "내용",
    author: { uid: "u1", displayName: "Tracking", email: "a@b.com", photoURL: "p" },
    category: "free"
  });
  await service.createPost({
    title: "공지",
    content: "내용2",
    author: { uid: "admin1", role: "admin", email: "admin@test.com" },
    category: "notice"
  });

  assert.equal(calls.add.length, 2);
  assert.equal(calls.add[0].authorName, "Tracking");
  assert.equal(calls.add[0].category, "free");
  assert.equal(calls.add[1].category, "notice");
});

test("postService createPost blocks non-admin from notice category", async () => {
  const { repo } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });

  await assert.rejects(
    service.createPost({
      title: "몰래공지",
      content: "내용",
      author: { uid: "u1", role: "free" },
      category: "notice"
    }),
    (error) => error && error.code === "NOT_AUTHORIZED"
  );
});

test("postService update/delete allow author or admin", async () => {
  const { repo, calls } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });
  const post = { id: "p1", authorUid: "u1", title: "t", content: "c", category: "free" };
  
  // Author can update
  await service.updatePost({ id: "p1", title: "new", content: "new", user: { uid: "u1", role: "free" }, post });
  // Admin can update
  await service.updatePost({ id: "p1", title: "admin-new", content: "new", user: { uid: "admin1", role: "admin" }, post });
  
  // Non-author cannot update
  await assert.rejects(
    service.updatePost({ id: "p1", title: "bad", content: "bad", user: { uid: "u2", role: "free" }, post }),
    (error) => error && error.code === "NOT_AUTHORIZED"
  );

  assert.equal(calls.update.length, 2);
});

test("postService canEditPost returns true for author or admin", async () => {
  const { repo } = createRepositoryStub();
  const service = buildPostService({ postRepository: repo });
  const post = { id: "p1", authorUid: "u1", category: "free" };
  const noticePost = { id: "p2", authorUid: "admin1", category: "notice" };

  assert.equal(service.canEditPost({ user: { uid: "u1", role: "free" }, post }), true);
  assert.equal(service.canEditPost({ user: { uid: "admin1", role: "admin" }, post }), true);
  assert.equal(service.canEditPost({ user: { uid: "u2", role: "free" }, post }), false);
  
  // Notice post: only admin can edit
  assert.equal(service.canEditPost({ user: { uid: "u1", role: "free" }, post: noticePost }), false);
  assert.equal(service.canEditPost({ user: { uid: "admin1", role: "admin" }, post: noticePost }), true);
});
