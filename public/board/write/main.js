import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});

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

const writeForm = document.querySelector("board-write-form");
if (!writeForm) {
  throw new Error("board-write-form not found");
}

async function ensureAuthenticated() {
  if (window.requireAuth) {
    return window.requireAuth({ redirectTo: "/board/write" });
  }
  return null;
}

function getCurrentUser() {
  return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
}

function renderWriteAccess(user) {
  const section = document.querySelector(".write-form-section");
  if (!section) return;
  let message = section.querySelector("#board-write-login-required");
  if (!user) {
    if (!message) {
      message = document.createElement("div");
      message.id = "board-write-login-required";
      message.style.display = "grid";
      message.style.gap = "10px";
      message.style.justifyItems = "center";
      message.style.padding = "28px 0 10px";
      message.innerHTML = `
        <p style="text-align:center;color:var(--text-sub);margin:0;">게시글 작성은 로그인 후 이용할 수 있습니다.</p>
        <button type="button" class="auth-button primary" id="board-write-login-btn" data-i18n="login">로그인</button>
      `;
      section.appendChild(message);
      if (window.applyTranslations) {
        const lang = localStorage.getItem("lang") || "ko";
        window.applyTranslations(lang);
      }
      const loginBtn = message.querySelector("#board-write-login-btn");
      if (loginBtn) {
        loginBtn.addEventListener("click", () => {
          if (window.promptLogin) window.promptLogin({ redirectTo: "/board/write" });
        });
      }
    }
    writeForm.style.display = "none";
    return;
  }
  if (message) message.remove();
  writeForm.style.display = "";
}

async function initWriteForm() {
  const user = await ensureAuthenticated();
  renderWriteAccess(user);
  if (!user) return;

  writeForm.onSubmit(async (values) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      renderWriteAccess(null);
      showError({ code: "AUTH_REQUIRED" });
      return;
    }
    writeForm.setSubmitting(true);
    try {
      await postService.createPost({ ...values, author: currentUser });
      alert("게시물이 성공적으로 등록되었습니다.");
      window.location.href = "/board";
    } catch (error) {
      console.error("게시물 등록 실패:", error);
      showError(error);
      writeForm.setSubmitting(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initWriteForm();
  window.addEventListener("auth-state-changed", (event) => {
    const user = event && event.detail ? event.detail.user : getCurrentUser();
    renderWriteAccess(user);
  });
});
