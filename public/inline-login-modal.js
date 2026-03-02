(function () {
  function t(key, fallback) {
    return typeof window !== "undefined" && window.getTranslation
      ? window.getTranslation(key, fallback)
      : fallback;
  }

  function createInlineLoginModalController({ getAuthService }) {
    let modal = null;
    const actionHandlers = window.createAuthActionHandlers
      ? window.createAuthActionHandlers({ getAuthService })
      : null;

    function ensureModal() {
      if (modal) return modal;

      modal = document.createElement("div");
      modal.id = "global-inline-login-modal";
      modal.className = "inline-login-modal";
      modal.innerHTML = `
        <div class="inline-login-dialog">
          <h2 class="inline-login-title">${t("login", "로그인")}</h2>
          <button type="button" class="auth-button inline-login-close" id="inline-login-close">${t("close", "닫기")}</button>
          <div class="inline-login-row">
            <input id="inline-login-email" class="inline-login-input" type="email" placeholder="${t("email", "이메일")}" autocomplete="email">
            <input id="inline-login-password" class="inline-login-input" type="password" placeholder="${t("password", "비밀번호")}" autocomplete="current-password">
          </div>
          <div class="inline-login-actions">
            <button type="button" class="auth-button primary" id="inline-login-email-submit">${t("auth_email_login", "이메일 로그인")}</button>
            <button type="button" class="auth-button" id="inline-login-signup">${t("signup", "회원가입")}</button>
          </div>
          <p id="inline-login-error" class="inline-login-error"></p>
        </div>
      `;
      document.body.appendChild(modal);

      const close = () => {
        modal.classList.remove("open");
        document.body.style.overflow = "";
      };

      modal.addEventListener("click", (event) => {
        if (event.target === modal) close();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("open")) close();
      });

      const closeBtn = modal.querySelector("#inline-login-close");
      if (closeBtn) closeBtn.addEventListener("click", close);

      return modal;
    }

    function setError(message) {
      const errorEl = modal.querySelector("#inline-login-error");
      if (errorEl) errorEl.textContent = message || "";
    }

    function openUI() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      const emailEl = modal.querySelector("#inline-login-email");
      if (emailEl) setTimeout(() => emailEl.focus(), 80);
    }

    async function open({ redirectTo = "/" } = {}) {
      ensureModal();
      openUI();
      setError("");

      const emailBtn = modal.querySelector("#inline-login-email-submit");
      const signupBtn = modal.querySelector("#inline-login-signup");

      if (emailBtn) {
        emailBtn.onclick = async () => {
          if (!actionHandlers) return;
          await actionHandlers.signInWithEmail(
            {
              email: (modal.querySelector("#inline-login-email")?.value || "").trim(),
              password: modal.querySelector("#inline-login-password")?.value || "",
            },
            {
              onSuccess() {
                modal.classList.remove("open");
                document.body.style.overflow = "";
              },
              onValidationError(message) {
                setError(message);
              },
              onError(message) {
                setError(message);
              },
            }
          );
        };
      }

      if (signupBtn) {
        signupBtn.onclick = () => {
          if (!actionHandlers) return;
          actionHandlers.goToSignup({ redirectTo });
        };
      }
    }

    return { open };
  }

  window.createInlineLoginModalController = createInlineLoginModalController;
})();
