import { WRITE_PATH } from "../application/write-auth.js";

function applyCurrentLangTranslations() {
  if (!window.applyTranslations) return;
  const lang = localStorage.getItem("lang") || "ko";
  window.applyTranslations(lang);
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

export { renderWriteAccess };
