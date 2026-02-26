(function () {
  function t(key, fallback) {
    return typeof window !== "undefined" && window.getTranslation
      ? window.getTranslation(key, fallback)
      : fallback;
  }

  function createAuthControlsController({
    container,
    getAuthService,
    getCurrentUser,
    onLogoutSuccess,
  }) {
    const actionHandlers = window.createAuthActionHandlers
      ? window.createAuthActionHandlers({ getAuthService })
      : null;
    container.innerHTML = `
      <button id="auth-login" class="auth-button primary">${t("login", "로그인")}</button>
      <button id="auth-logout" class="auth-button" style="display:none;">${t("logout", "로그아웃")}</button>
      <span id="auth-user" class="auth-user" style="display:none;"></span>
      <div id="auth-menu" class="auth-menu">
        <button type="button" data-provider="google">${t("auth_google_login", "Google로 로그인")}</button>
        <div class="auth-form">
          <input id="auth-email" type="email" placeholder="${t("email", "이메일")}" autocomplete="email">
          <input id="auth-password" type="password" placeholder="${t("password", "비밀번호")}" autocomplete="current-password">
          <div class="auth-actions">
            <button type="button" id="auth-email-login" class="auth-button primary">${t("auth_email_login", "이메일 로그인")}</button>
            <button type="button" id="auth-email-signup" class="auth-button">${t("signup", "회원가입")}</button>
          </div>
          <div class="auth-helper">${t("auth_email_password_provider_hint", "이메일/비밀번호 로그인은 기본 제공업체 설정이 필요합니다.")}</div>
        </div>
      </div>
    `;

    const loginButton = container.querySelector("#auth-login");
    const logoutButton = container.querySelector("#auth-logout");
    const userLabel = container.querySelector("#auth-user");
    const menu = container.querySelector("#auth-menu");
    const emailInput = container.querySelector("#auth-email");
    const passwordInput = container.querySelector("#auth-password");
    const emailLoginBtn = container.querySelector("#auth-email-login");
    const emailSignupBtn = container.querySelector("#auth-email-signup");

    userLabel.addEventListener("click", () => {
      const user = getCurrentUser ? getCurrentUser() : null;
      if (!user) return;
      window.location.href = "/account/";
    });

    const showAuthMenu = () => {
      container.classList.add("open");
    };

    const openAuthPrompt = () => {
      container.classList.add("open");
      const top = container.getBoundingClientRect().top + window.scrollY - 110;
      if (top >= 0) window.scrollTo({ top, behavior: "smooth" });
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 120);
      }
    };

    loginButton.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthPrompt();
    });

    menu.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const provider = button.dataset.provider;
      if (!provider) return;
      container.classList.remove("open");
      if (actionHandlers) {
        actionHandlers.signInWithProvider(provider, {
          onError(message) {
            alert(message);
          },
        });
      }
    });

    emailLoginBtn.addEventListener("click", async () => {
      if (!emailInput || !passwordInput || !actionHandlers) return;
      await actionHandlers.signInWithEmail(
        {
          email: emailInput.value.trim(),
          password: passwordInput.value,
        },
        {
          onSuccess() {
            container.classList.remove("open");
          },
          onValidationError(message) {
            alert(message);
          },
          onError(message) {
            alert(message);
          },
        }
      );
    });

    emailSignupBtn.addEventListener("click", () => {
      if (!actionHandlers) return;
      actionHandlers.goToSignup({
        redirectTo: window.location.pathname + window.location.search,
      });
    });

    logoutButton.addEventListener("click", async () => {
      if (!actionHandlers) return;
      await actionHandlers.signOut({
        onSuccess() {
          if (typeof onLogoutSuccess === "function") onLogoutSuccess();
        },
      });
    });

    document.addEventListener("click", (event) => {
      if (!container.contains(event.target)) {
        container.classList.remove("open");
      }
    });

    function setUser(user, profile) {
      if (user) {
        loginButton.style.display = "none";
        logoutButton.style.display = "inline-flex";
        userLabel.style.display = "inline-flex";
        const nickname = (profile && profile.nickname) || user.displayName || user.email || t("logged_in", "로그인됨");
        const photoURL = (profile && profile.photoURL) || user.photoURL || "";
        if (photoURL) {
          userLabel.innerHTML = `<img class="auth-avatar" src="${photoURL}" alt="profile"><span class="auth-user-label">${nickname}</span>`;
        } else {
          userLabel.textContent = nickname;
        }
      } else {
        loginButton.style.display = "inline-flex";
        logoutButton.style.display = "none";
        userLabel.style.display = "none";
      }
    }

    return {
      setUser,
      showAuthMenu,
      openAuthPrompt,
    };
  }

  window.createAuthControlsController = createAuthControlsController;
})();
