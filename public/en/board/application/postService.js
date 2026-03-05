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
    // 자유게시판(free) 조회 시 공지사항(notice)도 함께 가져와서 합침
    if (category === "free") {
      const [notices, freePosts] = await Promise.all([
        postRepository.list({ limit: 5, category: "notice" }),
        postRepository.list({ limit, category: "free" })
      ]);
      
      const seenIds = new Set();
      const merged = [];
      
      const allPosts = [...(notices || []), ...(freePosts || [])];
      allPosts.forEach(post => {
        if (post && post.id && !seenIds.has(post.id)) {
          seenIds.add(post.id);
          merged.push(post);
        }
      });
      return merged;
    }
    
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
