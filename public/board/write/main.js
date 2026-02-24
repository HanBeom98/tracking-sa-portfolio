import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { createCryptoAdapter } from "../infra/cryptoAdapter.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
  crypto: createCryptoAdapter(),
});

function showError(error) {
  switch (error.code) {
    case "PASSWORD_MISMATCH":
      alert("비밀번호가 일치하지 않습니다.");
      return;
    case "REQUIRED_FIELDS":
      alert("모든 필드를 입력해주세요.");
      return;
    default:
      alert("게시물 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

const writeForm = document.querySelector("board-write-form");
if (!writeForm) {
  throw new Error("board-write-form not found");
}

writeForm.onSubmit(async (values) => {
  writeForm.setSubmitting(true);
  try {
    await postService.createPost(values);
    alert("게시물이 성공적으로 등록되었습니다.");
    window.location.href = "/board";
  } catch (error) {
    console.error("게시물 등록 실패:", error);
    showError(error);
    writeForm.setSubmitting(false);
  }
});
