(function () {
  function t(key, fallback) {
    return typeof window !== "undefined" && window.getTranslation
      ? window.getTranslation(key, fallback)
      : fallback;
  }

  function createInlineLoginModalController({ getAuthService }) {
    let modal = null;

    function ensureModal() {
      if (modal) return modal;

      modal = document.createElement("div");
      modal.id = "global-inline-login-modal";
      modal.className = "inline-login-modal";
      modal.innerHTML = `
        <div class="inline-login-dialog">
          <h2 class="inline-login-title">${t("login", "로그인")}</h2>
          <button type="button" class="auth-button inline-login-close" id="inline-login-close">${t("close", "닫기")}</button>
          <button type="button" class="auth-button" id="inline-login-google">${t("auth_google_login", "Google로 로그인")}</button>
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

      const googleBtn = modal.querySelector("#inline-login-google");
      const emailBtn = modal.querySelector("#inline-login-email-submit");
      const signupBtn = modal.querySelector("#inline-login-signup");

      if (googleBtn) {
        googleBtn.onclick = async () => {
          const authService = await getAuthService();
          if (!authService) return;
          try {
            await authService.signInWithProvider("google");
            modal.classList.remove("open");
            document.body.style.overflow = "";
          } catch (error) {
            console.error("Google 로그인 실패:", error);
            setError(t("auth_login_retry", "로그인에 실패했습니다. 다시 시도해주세요."));
          }
        };
      }

      if (emailBtn) {
        emailBtn.onclick = async () => {
          const authService = await getAuthService();
          if (!authService) return;
          const email = (modal.querySelector("#inline-login-email")?.value || "").trim();
          const password = modal.querySelector("#inline-login-password")?.value || "";
          if (!email || !password) {
            setError(t("auth_email_password_required", "이메일과 비밀번호를 입력해주세요."));
            return;
          }
          try {
            await authService.signInWithEmail(email, password);
            modal.classList.remove("open");
            document.body.style.overflow = "";
          } catch (error) {
            console.error("이메일 로그인 실패:", error);
            setError(t("auth_login_failed", "로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요."));
          }
        };
      }

      if (signupBtn) {
        signupBtn.onclick = () => {
          window.location.href = `/auth/signup?redirect=${encodeURIComponent(redirectTo)}`;
        };
      }
    }

    return { open };
  }

  window.createInlineLoginModalController = createInlineLoginModalController;
})();
