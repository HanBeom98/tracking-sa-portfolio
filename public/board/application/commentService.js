import { assertBoardNickname } from '../domain/author-identity.js?v=c565b2e79da0';

const COMMENT_MAX_LENGTH = 1000;

export function buildCommentService({ commentRepository }) {
  if (!commentRepository) throw new Error("commentRepository is required");

  function assertFreePost(post) {
    if (!post || post.category !== "free") {
      const error = new Error("COMMENTS_NOT_ALLOWED");
      error.code = "COMMENTS_NOT_ALLOWED";
      throw error;
    }
  }

  async function listComments({ post }) {
    assertFreePost(post);
    return commentRepository.list(post.id);
  }

  async function createComment({ post, content, user, parentComment = null }) {
    assertFreePost(post);
    const normalized = String(content || "").trim();
    if (!user?.uid) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    const nickname = assertBoardNickname(user);
    if (!normalized || normalized.length > COMMENT_MAX_LENGTH) {
      const error = new Error("INVALID_COMMENT");
      error.code = "INVALID_COMMENT";
      throw error;
    }
    if (parentComment && (!parentComment.id || parentComment.parentId)) {
      const error = new Error("INVALID_PARENT_COMMENT");
      error.code = "INVALID_PARENT_COMMENT";
      throw error;
    }

    await commentRepository.add(post.id, {
      content: normalized,
      authorUid: user.uid,
      authorName: nickname,
      parentId: parentComment?.id || null,
      deleted: false,
    });
  }

  async function deleteComment({ post, comment, user }) {
    assertFreePost(post);
    if (!user?.uid || (user.role !== "admin" && comment.authorUid !== user.uid)) {
      const error = new Error("NOT_AUTHORIZED");
      error.code = "NOT_AUTHORIZED";
      throw error;
    }
    if (!comment.parentId) {
      await commentRepository.softDelete(post.id, comment.id);
      return;
    }
    await commentRepository.remove(post.id, comment.id);
  }

  return { listComments, createComment, deleteComment };
}

export { COMMENT_MAX_LENGTH };
