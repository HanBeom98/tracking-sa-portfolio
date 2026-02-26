import { buildPostService } from "../application/postService.js";
import { waitAuthReady } from "../application/authGateway.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { createPostDetailUseCases } from "../application/post-detail-use-cases.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});
const postDetailUseCases = createPostDetailUseCases({ postService });

const postId = new URLSearchParams(window.location.search).get("id");
const postView = document.querySelector("board-post-view");
if (!postView) {
  throw new Error("board-post-view not found");
}

function attachPostActions(post, user) {
  postView.onDelete(async () => {
    if (!confirm("게시물을 정말 삭제하시겠습니까?")) return;
    try {
      await postDetailUseCases.deletePost({ postId, user, post });
      alert("게시물이 삭제되었습니다.");
      window.location.href = "/board";
    } catch (error) {
      console.error("게시물 삭제 실패:", error);
      if (error.code === "NOT_AUTHORIZED") {
        alert("삭제 권한이 없습니다.");
        return;
      }
      alert("게시물 삭제에 실패했습니다.");
    }
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

document.addEventListener("DOMContentLoaded", async () => {
  if (!postId) {
    postView.renderError();
    return;
  }

  try {
    const user = await waitAuthReady();
    const { post, canEdit } = await postDetailUseCases.loadPostDetail({ postId, user });
    if (!post) {
      postView.renderNotFound();
      return;
    }
    postView.renderPost(post, { canEdit });
    if (canEdit) {
      attachPostActions(post, user);
    }
  } catch (error) {
    console.error("게시물 로딩 실패:", error);
    postView.renderError();
  }
});
