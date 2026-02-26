import test from "node:test";
import assert from "node:assert/strict";
import { createSubmitPostUseCase } from "../../src/domains/board/application/submit-post-use-case.js";

test("submit post use-case throws AUTH_REQUIRED when no user", async () => {
  const postService = {
    createPost: async () => {},
  };
  const submitPost = createSubmitPostUseCase({
    postService,
    getCurrentUser: () => null,
  });

  await assert.rejects(
    submitPost({ values: { title: "t", content: "c" } }),
    (error) => error && error.code === "AUTH_REQUIRED"
  );
});

test("submit post use-case delegates to postService with author", async () => {
  const calls = [];
  const user = { uid: "u1", email: "a@b.com", displayName: "tracking" };
  const postService = {
    createPost: async (payload) => {
      calls.push(payload);
    },
  };
  const submitPost = createSubmitPostUseCase({
    postService,
    getCurrentUser: () => user,
  });

  await submitPost({ values: { title: "제목", content: "내용" } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].author.uid, "u1");
  assert.equal(calls[0].title, "제목");
  assert.equal(calls[0].content, "내용");
});
