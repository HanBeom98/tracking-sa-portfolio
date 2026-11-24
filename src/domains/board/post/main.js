import { buildPostService } from "../application/postService.js";
import { waitAuthReady, getCurrentUser, getCurrentUserProfile, subscribeAuthState } from "../application/authGateway.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { waitForFirestoreReady } from "../infra/firestore-ready.js";
import { createPostDetailUseCases } from "../application/post-detail-use-cases.js";
import { deleteBoardImages } from "../infra/board-image-service.js";
import { buildCommentService } from "../application/commentService.js";
import { createFirestoreCommentRepository } from "../infra/firestoreCommentRepository.js";
import {
  clearCommentListCache,
  readCommentListCache,
  writeCommentListCache
} from "../application/comment-list-cache.js";
import { clearBoardListCache } from "../application/board-list-cache.js";
import { reportImageCleanup } from "../ui/image-cleanup-feedback.js";

const postId = new URLSearchParams(window.location.search).get("id");
const postView = document.querySelector("board-post-view");
const commentsView = document.querySelector("board-comments");
if (!postView) {
  throw new Error("board-post-view not found");
}

async function mountComments(post, user) {
  if (!commentsView || post.category !== "free") return;
  commentsView.hidden = false;
  const service = buildCommentService({ commentRepository: createFirestoreCommentRepository() });
  const refresh = async ({ force = false } = {}) => {
    const cached = force ? null : readCommentListCache({ postId: post.id });
    if (cached) {
      commentsView.setComments(cached);
      return;
    }
    const comments = await service.listComments({ post });
    writeCommentListCache(comments, { postId: post.id });
    commentsView.setComments(comments);
  };
  commentsView.configure({
    user,
    onLogin: () => window.promptLogin?.({ redirectTo: window.location.pathname + window.location.search }),
    onSubmit: async (content, parentComment) => {
      try {
        await service.createComment({ post, content, user: buildViewerUser(getCurrentUser()), parentComment });
        clearCommentListCache(post.id);
        await refresh({ force: true });
      } catch (error) {
        if (error.code === 'NICKNAME_REQUIRED') {
          commentsView.updateUser(buildViewerUser(getCurrentUser()));
          alert('댓글을 작성하려면 내 계정에서 사이트 회원 닉네임을 설정해 주세요.');
          return;
        }
        const message = error.code === "INVALID_COMMENT"
          ? "댓글은 1자 이상 1,000자 이하로 입력해주세요."
          : error.code === "permission-denied"
            ? "닉네임 설정과 작성 권한을 확인해 주세요. 댓글은 10초에 한 번 작성할 수 있습니다."
            : "댓글 등록에 실패했습니다.";
        alert(message);
      }
    },
    onDelete: async (comment) => {
      if (!confirm("댓글을 삭제하시겠습니까?")) return;
      try {
        await service.deleteComment({ post, comment, user: buildViewerUser(getCurrentUser()) });
        clearCommentListCache(post.id);
        await refresh({ force: true });
      } catch (error) {
        alert("댓글 삭제에 실패했습니다.");
      }
    },
  });
  const updateCommentUser = () => commentsView.updateUser(buildViewerUser(getCurrentUser()));
  const unsubscribe = subscribeAuthState(updateCommentUser);
  window.addEventListener('pagehide', unsubscribe, { once: true });
  try {
    await refresh();
  } catch (error) {
    console.error("댓글 로딩 실패:", error);
    commentsView.setError();
  }
}

function attachPostActions(post, user, postDetailUseCases) {
  postView.onDelete(async () => {
    if (!confirm("게시물을 정말 삭제하시겠습니까?")) return;
    try {
      await postDetailUseCases.deletePost({ postId, user, post });
    } catch (error) {
      console.error("게시물 삭제 실패:", error);
      if (error.code === "NOT_AUTHORIZED") {
        alert("삭제 권한이 없습니다.");
        return;
      }
      alert("게시물 삭제에 실패했습니다.");
      return;
    }
    clearBoardListCache();
    clearCommentListCache(post.id);
    const cleanup = await deleteBoardImages((post.attachments || []).map((attachment) => attachment.path), { ownerUid: post.authorUid });
    alert("게시물이 삭제되었습니다.");
    reportImageCleanup(cleanup);
    window.location.href = "/board";
  });

  postView.onEdit(() => {
    try {
      const canEdit = postDetailUseCases.canEditPost({ user, post });
      if (canEdit) {
        window.location.href = `/board/edit?id=${postId}`;
      } else {
        alert("수정 권한이 없습니다.");
      }
    } catch (error) {
      console.error("게시물 수정 권한 확인 실패:", error);
      alert("수정 권한이 없습니다.");
    }
  });
}

function buildViewerUser(authUser) {
  if (!authUser) return null;
  const profile = getCurrentUserProfile();
  return {
    ...authUser,
    displayName: profile?.nickname || authUser.displayName,
    nickname: profile?.nickname || '',
    role: (profile && profile.role) || "free",
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!postId) {
    postView.renderError();
    return;
  }

  try {
    await waitForFirestoreReady();
    const postService = buildPostService({
      postRepository: createFirestorePostRepository(),
    });
    const postDetailUseCases = createPostDetailUseCases({ postService });
    const authUserPromise = waitAuthReady().catch((error) => {
      console.error("게시물 사용자 정보 로딩 실패:", error);
      return null;
    });

    const { post } = await postDetailUseCases.loadPostDetail({ postId, user: null });
    if (!post) {
      postView.renderNotFound();
      return;
    }

    postView.renderPost(post, { canEdit: false });

    const user = buildViewerUser(await authUserPromise);
    await mountComments(post, user);
    const canEdit = user ? postDetailUseCases.canEditPost({ user, post }) : false;
    if (!canEdit) {
      return;
    }

    postView.renderPost(post, { canEdit: true });
    if (canEdit) {
      attachPostActions(post, user, postDetailUseCases);
    }
  } catch (error) {
    console.error("게시물 로딩 실패:", error);
    postView.renderError();
  }
});
