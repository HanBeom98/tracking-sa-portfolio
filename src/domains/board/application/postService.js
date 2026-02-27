import { makeError } from "./errors.js";
import { generateRandomNickname } from "../domain/nickname.js";
import { assertAuthor, assertPostExists, assertRequiredFields } from "../domain/validators.js";

export function buildPostService({ postRepository }) {
  if (!postRepository) {
    throw new Error("postRepository is required");
  }

  async function createPost({ title, content, author, category = "free" }) {
    assertRequiredFields({ title, content });
    assertAuthor(author);

    if (category === "notice" && author.role !== "admin") {
      throw makeError("NOT_AUTHORIZED");
    }

    const nickname = author.displayName || author.email || generateRandomNickname();

    await postRepository.add({
      title,
      content,
      category,
      authorUid: author.uid,
      authorName: nickname,
      authorEmail: author.email || "",
      authorPhoto: author.photoURL || "",
    });
  }

  async function getPost(id) {
    if (!id) {
      throw makeError("INVALID_POST_ID");
    }
    return postRepository.getById(id);
  }

  async function listPosts({ limit = 30, category = null } = {}) {
    return postRepository.list({ limit, category });
  }

  async function updatePost({ id, title, content, user, post }) {
    assertRequiredFields({ title, content });
    assertPostExists(post);
    assertAuthor(user);

    const isAuthorized = user.role === "admin" || (post.authorUid && post.authorUid === user.uid && post.category !== "notice");
    if (!isAuthorized) {
      throw makeError("NOT_AUTHORIZED");
    }

    await postRepository.update(id, { title, content });
  }

  async function deletePost({ id, user, post }) {
    assertPostExists(post);
    assertAuthor(user);

    const isAuthorized = user.role === "admin" || (post.authorUid && post.authorUid === user.uid);
    if (!isAuthorized) {
      throw makeError("NOT_AUTHORIZED");
    }

    await postRepository.remove(id);
  }

  function canEditPost({ user, post }) {
    assertPostExists(post);
    if (!user) return false;

    if (user.role === "admin") return true;
    if (post.category === "notice") return false;

    return post.authorUid === user.uid;
  }

  return {
    createPost,
    getPost,
    listPosts,
    updatePost,
    deletePost,
    canEditPost,
  };
}
