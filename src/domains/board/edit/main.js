import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { createCryptoAdapter } from "../infra/cryptoAdapter.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
  crypto: createCryptoAdapter(),
});

const postId = new URLSearchParams(window.location.search).get("id");
const editForm = document.querySelector("board-edit-form");
if (!editForm) {
  throw new Error("board-edit-form not found");
}
if (editForm && postId) {
  editForm.setAttribute("cancel-href", `/post?id=${postId}`);
}

function showError(error) {
  switch (error.code) {
    case "REQUIRED_FIELDS":
      alert("모든 필드를 입력해주세요.");
      return;
    case "PASSWORD_INVALID":
      alert("비밀번호가 일치하지 않습니다.");
      return;
    default:
      alert("게시물 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

function attachSubmit(post) {
  editForm.onSubmit(async (values) => {
    editForm.setSubmitting(true);
    try {
      await postService.updatePost({
        id: postId,
        title: values.title,
        content: values.content,
        password: values.password,
        post,
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
    const post = await postService.getPost(postId);
    if (!post) {
      editForm.renderNotFound();
      return;
    }
    editForm.renderForm({ title: post.title, content: post.content });
    attachSubmit(post);
  } catch (error) {
    console.error("게시물 정보 로딩 실패:", error);
    editForm.renderNotFound();
  }
});
