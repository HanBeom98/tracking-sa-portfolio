import { submitGame } from "../application/game-hub-service.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

async function checkAuth() {
  if (typeof window === "undefined" || !window.AuthGateway) return;

  await window.AuthGateway.waitForReady();
  const user = window.AuthGateway.getCurrentUser();

  if (!user) {
    // Show login required prompt
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
    title: formData.get("title"),
    url: formData.get("url"),
    thumbnail: formData.get("thumbnail"),
    description: formData.get("description")
  };

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = t("submitting", "제출 중...");
    
    await submitGame(payload);

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
