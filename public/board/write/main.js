import { buildPostService } from "../application/postService.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});

const WRITE_PATH = "/board/write";
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

function applyCurrentLangTranslations() {
  if (!window.applyTranslations) return;
  const lang = localStorage.getItem("lang") || "ko";
  window.applyTranslations(lang);
}

async function ensureAuthenticated() {
  if (window.requireAuth) {
    return window.requireAuth({ redirectTo: WRITE_PATH });
  }
  return null;
}

function getCurrentUser() {
  return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
}

function createGuestMessageElement() {
  const message = window.createLoginRequiredPrompt
    ? window.createLoginRequiredPrompt({
        promptId: "board-write-login-required",
        messageText: "게시글 작성은 로그인 후 이용할 수 있습니다.",
        buttonId: "board-write-login-btn",
        redirectTo: WRITE_PATH,
      })
    : document.createElement("div");

  if (!window.createLoginRequiredPrompt) {
    message.id = "board-write-login-required";
    message.innerHTML = `
      <p>게시글 작성은 로그인 후 이용할 수 있습니다.</p>
      <button type="button" class="auth-button primary" id="board-write-login-btn" data-i18n="login">로그인</button>
    `;
    const loginBtn = message.querySelector("#board-write-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        if (window.promptLogin) window.promptLogin({ redirectTo: WRITE_PATH });
      });
    }
  }

  message.style.display = "grid";
  message.style.gap = "10px";
  message.style.justifyItems = "center";
  message.style.padding = "28px 0 10px";
  const messageText = message.querySelector("p");
  if (messageText) {
    messageText.style.textAlign = "center";
    messageText.style.color = "var(--text-sub)";
    messageText.style.margin = "0";
  }
  return message;
}

function renderWriteAccess({ section, writeForm, user }) {
  let message = section.querySelector("#board-write-login-required");
  if (!user) {
    if (!message) {
      message = createGuestMessageElement();
      section.appendChild(message);
      applyCurrentLangTranslations();
    }
    writeForm.style.display = "none";
    return;
  }

  if (message) message.remove();
  writeForm.style.display = "";
}

function bindWriteSubmit(writeForm, section) {
  writeForm.onSubmit(async (values) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      renderWriteAccess({ section, writeForm, user: null });
      showError({ code: "AUTH_REQUIRED" });
      return;
    }

    writeForm.setSubmitting(true);
    try {
      await postService.createPost({ ...values, author: currentUser });
      alert("게시물이 성공적으로 등록되었습니다.");
      window.location.href = BOARD_PATH;
    } catch (error) {
      console.error("게시물 등록 실패:", error);
      showError(error);
      writeForm.setSubmitting(false);
    }
  });
}

async function initWriteForm() {
  const section = document.querySelector(".write-form-section");
  const writeForm = document.querySelector("board-write-form");
  if (!section) return;
  if (!writeForm) throw new Error("board-write-form not found");

  const user = await ensureAuthenticated();
  renderWriteAccess({ section, writeForm, user });
  if (!user) return;

  bindWriteSubmit(writeForm, section);
}

document.addEventListener("DOMContentLoaded", () => {
  initWriteForm();
  window.addEventListener("auth-state-changed", (event) => {
    const section = document.querySelector(".write-form-section");
    const writeForm = document.querySelector("board-write-form");
    if (!section || !writeForm) return;
    const user = event && event.detail ? event.detail.user : getCurrentUser();
    renderWriteAccess({ section, writeForm, user });
  });
});
