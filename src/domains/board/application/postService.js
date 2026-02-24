import { makeError } from "./errors.js";
import { generateRandomNickname } from "../domain/nickname.js";
import { assertPasswordMatch, assertPostExists, assertRequiredFields } from "../domain/validators.js";

const DEFAULT_ADMIN_PASSWORD = "admin";

export function buildPostService({ postRepository, crypto, adminPassword = DEFAULT_ADMIN_PASSWORD }) {
  if (!postRepository) {
    throw new Error("postRepository is required");
  }
  if (!crypto) {
    throw new Error("crypto adapter is required");
  }

  async function createPost({ title, content, password, passwordConfirm }) {
    assertRequiredFields({ title, content, password });
    assertPasswordMatch(password, passwordConfirm);

    const nickname = generateRandomNickname();
    const passwordHash = crypto.hash(password);

    await postRepository.add({
      title,
      content,
      nickname,
      passwordHash,
    });
  }

  async function getPost(id) {
    if (!id) {
      throw makeError("INVALID_POST_ID");
    }
    return postRepository.getById(id);
  }

  async function listPosts({ limit = 30 } = {}) {
    return postRepository.list({ limit });
  }

  async function updatePost({ id, title, content, password, post }) {
    assertRequiredFields({ title, content, password });
    assertPostExists(post);

    const passwordHash = crypto.hash(password);
    if (passwordHash !== post.passwordHash) {
      throw makeError("PASSWORD_INVALID");
    }

    await postRepository.update(id, { title, content });
  }

  async function deletePost({ id, password, post }) {
    assertRequiredFields({ password });
    assertPostExists(post);

    if (!isAdminPassword(password)) {
      const passwordHash = crypto.hash(password);
      if (passwordHash !== post.passwordHash) {
        throw makeError("PASSWORD_INVALID");
      }
    }

    await postRepository.remove(id);
  }

  function canEditPost({ password, post }) {
    assertRequiredFields({ password });
    assertPostExists(post);

    const passwordHash = crypto.hash(password);
    return passwordHash === post.passwordHash;
  }

  function isAdminPassword(password) {
    return password === adminPassword;
  }

  return {
    createPost,
    getPost,
    listPosts,
    updatePost,
    deletePost,
    canEditPost,
    isAdminPassword,
  };
}
