import test from "node:test";
import assert from "node:assert/strict";
import { createEditPostUseCases } from "../../src/domains/board/application/edit-post-use-cases.js";

test("edit post use-cases rejects unauthorized user", async () => {
  const postService = {
    getPost: async () => ({ id: "p1", authorUid: "u1", title: "t", content: "c" }),
    canEditPost: ({ user, post }) => user.uid === post.authorUid,
    updatePost: async () => {},
  };
  const useCases = createEditPostUseCases({ postService });

  await assert.rejects(
    useCases.loadEditablePost({ postId: "p1", user: { uid: "u2" } }),
    (error) => error && error.code === "NOT_AUTHORIZED"
  );
});

test("edit post use-cases submit delegates to service", async () => {
  const calls = [];
  const post = { id: "p1", authorUid: "u1", title: "t", content: "c" };
  const postService = {
    getPost: async () => post,
    canEditPost: () => true,
    updatePost: async (payload) => calls.push(payload),
  };
  const useCases = createEditPostUseCases({ postService });
  const editable = await useCases.loadEditablePost({ postId: "p1", user: { uid: "u1" } });
  await useCases.submitEdit({
    postId: "p1",
    user: { uid: "u1" },
    post: editable,
    values: { title: "new", content: "updated" },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, "p1");
  assert.equal(calls[0].title, "new");
  assert.equal(calls[0].content, "updated");
});
