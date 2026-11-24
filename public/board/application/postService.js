import { assertBoardAttachmentOwnership } from '../domain/attachment-ownership.js?v=f5ecd5ffbd05';
import { makeError } from "./errors.js?v=99f519e0be3c";
import { assertBoardNickname } from "../domain/author-identity.js?v=c565b2e79da0";
import { assertAuthor, assertPostExists, assertPostFieldLengths, assertRequiredFields } from "../domain/validators.js?v=d7462c8400ef";
import { isActivePinnedNotice } from "../domain/noticePinning.js?v=002ad1b5c716";
import { NOTICE_DISPLAY_LIMIT } from '../domain/notice-policy.js?v=a8d6742dbc8b';

export function buildPostService({ postRepository }) {
  if (!postRepository) {
    throw new Error("postRepository is required");
  }

  async function createPost({ title, content, author, category = "free", attachments = [] }) {
    assertRequiredFields({ title, content });
    assertPostFieldLengths({ title, content });
    assertAuthor(author);

    if (category === "notice" && author.role !== "admin") {
      throw makeError("NOT_AUTHORIZED");
    }

    const nickname = assertBoardNickname(author);

    assertBoardAttachmentOwnership(attachments, author.uid);
    await postRepository.add({
      title,
      content,
      category,
      authorUid: author.uid,
      authorName: nickname,
      authorPhoto: author.photoURL || "",
      attachments,
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
        postRepository.list({ limit: NOTICE_DISPLAY_LIMIT, category: "notice" }),
        postRepository.list({ limit, category: "free" })
      ]);
      
      const seenIds = new Set();
      const merged = [];
      
      const activeNotices = (notices || []).filter((post) => isActivePinnedNotice(post));
      const allPosts = [...activeNotices, ...(freePosts || [])];
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

  async function updatePost({ id, title, content, attachments = [], user, post }) {
    assertRequiredFields({ title, content });
    assertPostFieldLengths({ title, content });
    assertPostExists(post);
    assertAuthor(user);

    const isAuthorized = user.role === "admin" || (post.authorUid && post.authorUid === user.uid && post.category !== "notice");
    if (!isAuthorized) {
      throw makeError("NOT_AUTHORIZED");
    }

    assertBoardAttachmentOwnership(attachments, post.authorUid);
    await postRepository.update(id, { title, content, attachments });
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
