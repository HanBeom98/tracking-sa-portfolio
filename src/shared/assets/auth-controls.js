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
      <span id="auth-loading" class="auth-status" aria-live="polite">${t("auth_checking", "계정 확인 중…")}</span>
      <button id="auth-login" class="auth-button primary" style="display:none;">${t("login", "로그인")}</button>
      <button id="auth-logout" class="auth-button" style="display:none;">${t("logout", "로그아웃")}</button>
      <a id="auth-admin" class="auth-button" href="/admin/" style="display:none;">관리자</a>
      <span id="auth-user" class="auth-user" style="display:none;"></span>
      <div id="auth-menu" class="auth-menu">
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

    const loadingStatus = container.querySelector("#auth-loading");
    const loginButton = container.querySelector("#auth-login");
    const logoutButton = container.querySelector("#auth-logout");
    const userLabel = container.querySelector("#auth-user");
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
        emailInput.focus({ preventScroll: true });
      }
    };

    loginButton.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthPrompt();
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

    document.addEventListener("pointerdown", (event) => {
      if (!container.contains(event.target)) {
        container.classList.remove("open");
      }
    }, true);

    let adminLinkRevision = 0;
    function setUser(user, profile) {
      const adminRevision = ++adminLinkRevision;
      const adminLink = container.querySelector('#auth-admin');
      adminLink.style.display = 'none';
      if (user) void import('/auth/domain/access-policy.js').then(({ isSiteAdministrator }) => {
        if (adminRevision === adminLinkRevision && isSiteAdministrator(user, profile)) adminLink.style.display = 'inline-flex';
      }).catch(() => {});
      if (loadingStatus) loadingStatus.style.display = "none";
      if (user) {
        loginButton.style.display = "none";
        logoutButton.style.display = "inline-flex";
        userLabel.style.display = "inline-flex";
        const nickname = (profile && profile.nickname) || user.displayName || user.email || t("logged_in", "로그인됨");
        const photoURL = (profile && profile.photoURL) || user.photoURL || "";
        userLabel.replaceChildren();
        if (photoURL) {
          let safePhotoURL = "";
          try {
            const parsedPhotoURL = new URL(photoURL, window.location.origin);
            if (parsedPhotoURL.protocol === "https:") safePhotoURL = parsedPhotoURL.href;
          } catch (_) {
            safePhotoURL = "";
          }
          if (safePhotoURL) {
            const avatar = document.createElement("img");
            avatar.className = "auth-avatar";
            avatar.src = safePhotoURL;
            avatar.alt = "profile";
            userLabel.appendChild(avatar);
          }
          const label = document.createElement("span");
          label.className = "auth-user-label";
          label.textContent = nickname;
          userLabel.appendChild(label);
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
