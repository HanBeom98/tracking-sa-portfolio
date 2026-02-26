import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});

const postId = new URLSearchParams(window.location.search).get("id");
const editForm = document.querySelector("board-edit-form");
if (!editForm) {
  throw new Error("board-edit-form not found");
}
if (editForm && postId) {
  editForm.setAttribute("cancel-href", `/board/post?id=${postId}`);
}

function showError(error) {
  switch (error.code) {
    case "REQUIRED_FIELDS":
      alert("모든 필드를 입력해주세요.");
      return;
    case "AUTH_REQUIRED":
      alert("로그인이 필요합니다.");
      return;
    case "NOT_AUTHORIZED":
      alert("수정 권한이 없습니다.");
      return;
    default:
      alert("게시물 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

function attachSubmit(post, user) {
  editForm.onSubmit(async (values) => {
    editForm.setSubmitting(true);
    try {
      await postService.updatePost({
        id: postId,
        title: values.title,
        content: values.content,
        post,
        user,
      });
      alert("게시물이 성공적으로 수정되었습니다.");
      window.location.href = `/post?id=${postId}`;
    } catch (error) {
      console.error("게시물 수정 실패:", error);
      showError(error);
      editForm.setSubmitting(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!postId) {
    editForm.renderNotFound();
    return;
  }

  try {
    const user = window.requireAuth ? await window.requireAuth({ redirectTo: `/board/edit?id=${postId}` }) : null;
    if (!user) {
      editForm.renderNotFound();
      return;
    }
    const post = await postService.getPost(postId);
    if (!post) {
      editForm.renderNotFound();
      return;
    }
    if (!postService.canEditPost({ user, post })) {
      editForm.renderNotFound();
      return;
    }
    editForm.renderForm({ title: post.title, content: post.content });
    attachSubmit(post, user);
  } catch (error) {
    console.error("게시물 정보 로딩 실패:", error);
    editForm.renderNotFound();
  }
});
