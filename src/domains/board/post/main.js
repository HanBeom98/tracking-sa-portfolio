import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { createCryptoAdapter } from "../infra/cryptoAdapter.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
  crypto: createCryptoAdapter(),
});

const postId = new URLSearchParams(window.location.search).get("id");
const postView = document.querySelector("board-post-view");
if (!postView) {
  throw new Error("board-post-view not found");
}

function attachPostActions(post) {
  postView.onDelete(async () => {
    const password = prompt("삭제하려면 비밀번호를 입력하세요. (관리자는 관리자 비밀번호 입력)");
    if (password === null) return;

    const isAdmin = postService.isAdminPassword(password);
    const confirmMessage = isAdmin
      ? "관리자 권한으로 게시물을 정말 삭제하시겠습니까?"
      : "게시물을 정말 삭제하시겠습니까?";

    if (!confirm(confirmMessage)) return;

    try {
      await postService.deletePost({ id: postId, password, post });
      alert("게시물이 삭제되었습니다.");
      window.location.href = "/board";
    } catch (error) {
      console.error("게시물 삭제 실패:", error);
      if (error.code === "PASSWORD_INVALID") {
        alert("비밀번호가 일치하지 않습니다.");
        return;
      }
      alert("게시물 삭제에 실패했습니다.");
    }
  });

  postView.onEdit(() => {
    const password = prompt("수정하려면 비밀번호를 입력하세요.");
    if (password === null) return;

    try {
      const canEdit = postService.canEditPost({ password, post });
      if (canEdit) {
        window.location.href = `/edit?id=${postId}`;
      } else {
        alert("비밀번호가 일치하지 않습니다.");
      }
    } catch (error) {
      console.error("게시물 수정 권한 확인 실패:", error);
      alert("비밀번호가 일치하지 않습니다.");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!postId) {
    postView.renderError();
    return;
  }

  try {
    const post = await postService.getPost(postId);
    if (!post) {
      postView.renderNotFound();
      return;
    }
    postView.renderPost(post);
    attachPostActions(post);
  } catch (error) {
    console.error("게시물 로딩 실패:", error);
    postView.renderError();
  }
});
