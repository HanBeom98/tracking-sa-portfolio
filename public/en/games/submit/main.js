import { gameService } from "../service/game-service.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

const URL_PATTERN = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;

async function checkAuth() {
  if (typeof window === "undefined" || !window.AuthGateway) return;

  await window.AuthGateway.waitForReady();
  const user = window.AuthGateway.getCurrentUser();

  if (!user) {
    const container = document.querySelector(".form-card");
    if (container && window.createLoginRequiredPrompt) {
      container.innerHTML = "";
      container.appendChild(window.createLoginRequiredPrompt(window.location.pathname));
    }
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById("submit-btn");
  const statusMsg = document.getElementById("status-msg");

  if (!submitBtn || !statusMsg) return;

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title").trim(),
    url: formData.get("url").trim(),
    thumbnail: formData.get("thumbnail").trim(),
    category: formData.get("category"),
    description: formData.get("description").trim()
  };

  // Validation
  if (payload.title.length < 2) {
    statusMsg.textContent = t("error_title_too_short", "제목은 2자 이상이어야 합니다.");
    statusMsg.className = "msg-error";
    return;
  }

  if (!URL_PATTERN.test(payload.url)) {
    statusMsg.textContent = t("error_invalid_url", "올바른 게임 실행 URL을 입력해주세요.");
    statusMsg.className = "msg-error";
    return;
  }

  if (payload.thumbnail && !URL_PATTERN.test(payload.thumbnail)) {
    statusMsg.textContent = t("error_invalid_thumb", "올바른 이미지 URL을 입력해주세요.");
    statusMsg.className = "msg-error";
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = t("submitting", "제출 중...");
    statusMsg.textContent = "";
    
    await gameService.submitNewGame(payload);

    statusMsg.textContent = t("game_submit_success", "등록 신청이 완료되었습니다! 관리자 승인 후 목록에 표시됩니다.");
    statusMsg.className = "msg-success";
    form.reset();
  } catch (error) {
    console.error("[GameSubmit] Failed:", error);
    statusMsg.textContent = t("game_submit_error", "제출에 실패했습니다. 다시 시도해 주세요.");
    statusMsg.className = "msg-error";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("submit_for_review", "등록 신청하기");
  }
}

// Initialization
async function initSubmitPage() {
  await checkAuth();
  
  const form = document.getElementById("game-submit-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSubmitPage);
} else {
  initSubmitPage();
}
