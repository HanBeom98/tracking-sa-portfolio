import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { ensureAuthenticated, getCurrentUser } from "./application/write-auth.js";
import { createSubmitPostUseCase } from "./application/submit-post-use-case.js";
import { renderWriteAccess } from "./ui/write-access-renderer.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});
const submitPost = createSubmitPostUseCase({ postService, getCurrentUser });

const BOARD_PATH = "/board";

function showError(error) {
  switch (error.code) {
    case "REQUIRED_FIELDS":
      alert("모든 필드를 입력해주세요.");
      return;
    case "AUTH_REQUIRED":
      alert("로그인이 필요합니다.");
      return;
    default:
      alert("게시물 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
}

function bindWriteSubmit(writeForm, section) {
  writeForm.onSubmit(async (values) => {
    writeForm.setSubmitting(true);
    try {
      await submitPost({ values });
      alert("게시물이 성공적으로 등록되었습니다.");
      window.location.href = BOARD_PATH;
    } catch (error) {
      if (error && error.code === "AUTH_REQUIRED") {
        renderWriteAccess({ section, writeForm, user: null });
      }
      console.error("게시물 등록 실패:", error);
      showError(error);
      writeForm.setSubmitting(false);
    }
  });
}

function getWritePageElements() {
  const section = document.querySelector(".write-form-section");
  const writeForm = document.querySelector("board-write-form");
  return { section, writeForm };
}

async function initWriteForm() {
  const { section, writeForm } = getWritePageElements();
  if (!section) return;
  if (!writeForm) throw new Error("board-write-form not found");

  const user = await ensureAuthenticated();
  renderWriteAccess({ section, writeForm, user });
  if (!user) return;

  bindWriteSubmit(writeForm, section);
}

function bindAuthStateUpdates() {
  if (window.AuthStateBus && typeof window.AuthStateBus.subscribe === "function") {
    return window.AuthStateBus.subscribe(({ user }) => {
      const { section, writeForm } = getWritePageElements();
      if (!section || !writeForm) return;
      renderWriteAccess({ section, writeForm, user: user || null });
    });
  }

  const handler = (event) => {
    const { section, writeForm } = getWritePageElements();
    if (!section || !writeForm) return;
    const user = event && event.detail ? event.detail.user : getCurrentUser();
    renderWriteAccess({ section, writeForm, user });
  };
  window.addEventListener("auth-state-changed", handler);
  return () => window.removeEventListener("auth-state-changed", handler);
}

document.addEventListener("DOMContentLoaded", () => {
  initWriteForm();
  const unsubscribe = bindAuthStateUpdates();
  window.addEventListener("pagehide", () => unsubscribe(), { once: true });
});
