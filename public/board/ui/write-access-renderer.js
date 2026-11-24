import { WRITE_PATH } from "../application/write-auth.js?v=182646496680";
import { getBoardNickname } from "../domain/author-identity.js?v=c565b2e79da0";

function applyCurrentLangTranslations() {
  if (!window.applyTranslations) return;
  window.applyTranslations("ko");
}

function createGuestMessageElement() {
  const currentPath = typeof WRITE_PATH === "function" ? WRITE_PATH() : WRITE_PATH;
  
  const message = window.createLoginRequiredPrompt
    ? window.createLoginRequiredPrompt({
        promptId: "board-write-login-required",
        messageKey: "board_write_login_required",
        messageText: "게시글 작성은 로그인 후 이용할 수 있습니다.",
        buttonId: "board-write-login-btn",
        redirectTo: currentPath,
      })
    : document.createElement("div");

  if (!window.createLoginRequiredPrompt) {
    message.id = "board-write-login-required";
    message.innerHTML = `
      <p data-i18n="board_write_login_required">게시글 작성은 로그인 후 이용할 수 있습니다.</p>
      <button type="button" class="auth-button primary" id="board-write-login-btn" data-i18n="login">로그인</button>
    `;
    const loginBtn = message.querySelector("#board-write-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        if (window.promptLogin) window.promptLogin({ redirectTo: currentPath });
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

function renderWriteAccess({ section, writeForm, user, profile }) {
  const nicknameMessage = section.querySelector("#board-write-nickname-required");
  if (nicknameMessage) nicknameMessage.remove();
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
  if (!getBoardNickname(profile)) {
    const prompt = document.createElement('div');
    prompt.id = 'board-write-nickname-required';
    prompt.style.textAlign = 'center';
    prompt.style.padding = '28px 0';
    prompt.innerHTML = '<p>게시글을 작성하려면 사이트 회원 닉네임을 설정해 주세요.</p><a class="auth-button primary" href="/account/">닉네임 설정하기</a>';
    section.appendChild(prompt);
    writeForm.style.display = 'none';
    return;
  }
  writeForm.style.display = "";
}

export { renderWriteAccess };
