import test from "node:test";
import assert from "node:assert/strict";
import { createPostDetailUseCases } from "../../src/domains/board/post/application/post-detail-use-cases.js";

test("post detail use-cases loads post and edit permission", async () => {
  const post = { id: "p1", authorUid: "u1" };
  const postService = {
    getPost: async () => post,
    canEditPost: ({ user, post: target }) => user.uid === target.authorUid,
  };
  const useCases = createPostDetailUseCases({ postService });

  const resultMine = await useCases.loadPostDetail({ postId: "p1", user: { uid: "u1" } });
  const resultOther = await useCases.loadPostDetail({ postId: "p1", user: { uid: "u2" } });

  assert.equal(resultMine.canEdit, true);
  assert.equal(resultOther.canEdit, false);
});

test("post detail use-cases delete delegates to service", async () => {
  const calls = [];
  const postService = {
    getPost: async () => ({ id: "p1", authorUid: "u1" }),
    canEditPost: () => true,
    deletePost: async (payload) => calls.push(payload),
  };
  const useCases = createPostDetailUseCases({ postService });
  await useCases.deletePost({ postId: "p1", user: { uid: "u1" }, post: { id: "p1", authorUid: "u1" } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, "p1");
});
