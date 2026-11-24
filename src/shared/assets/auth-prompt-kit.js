(function () {
  function createAuthPromptKit({
    ensureInlineLoginModalController,
    openAuthPrompt,
    getAuthStateReady,
    getCurrentUser,
    showAuthMenu,
    getTranslation,
  }) {
    const t = getTranslation || ((_, fallback) => fallback);

    async function openInlineLoginModal({ redirectTo = "/" } = {}) {
      try {
        const controller = await ensureInlineLoginModalController();
        await controller.open({ redirectTo });
      } catch (error) {
        console.error("Inline login modal open failed:", error);
        alert(t("auth_ui_load_failed", "로그인 기능을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
      }
    }

    function promptLogin({ redirectTo = "/" } = {}) {
      if (openInlineLoginModal) {
        openInlineLoginModal({ redirectTo });
        return;
      }
      if (typeof openAuthPrompt === "function") {
        openAuthPrompt();
      }
    }

    function createLoginRequiredPrompt({
      promptId = "",
      wrapperClass = "",
      messageKey = "auth_required",
      messageText = "로그인이 필요합니다.",
      buttonId = "",
      redirectTo = "/",
    } = {}) {
      const wrapper = document.createElement("div");
      if (promptId) wrapper.id = promptId;
      if (wrapperClass) wrapper.className = wrapperClass;

      const messageEl = document.createElement("p");
      if (messageKey) messageEl.setAttribute("data-i18n", messageKey);
      messageEl.textContent = messageKey ? t(messageKey, messageText) : messageText;

      const loginBtn = document.createElement("button");
      loginBtn.type = "button";
      loginBtn.className = "auth-button primary";
      if (buttonId) loginBtn.id = buttonId;
      loginBtn.setAttribute("data-i18n", "login");
      loginBtn.textContent = t("login", "로그인");
      loginBtn.addEventListener("click", () => {
        promptLogin({ redirectTo });
      });

      wrapper.appendChild(messageEl);
      wrapper.appendChild(loginBtn);
      return wrapper;
    }

    function initAuthGateLinks() {
      const links = document.querySelectorAll('a[data-require-auth="true"]');
      if (!links.length) return;

      links.forEach((link) => {
        link.addEventListener("click", async (event) => {
          if (getCurrentUser && getCurrentUser()) return;
          const authReady = getAuthStateReady ? getAuthStateReady() : null;
          if (!authReady) return;
          // Cancel before awaiting: the browser does not wait for async listeners.
          event.preventDefault();
          const initialUser = await authReady;
          const user = getCurrentUser ? getCurrentUser() : initialUser;
          if (user) {
            window.location.href = link.getAttribute("href") || "/";
            return;
          }
          const redirectTo = link.getAttribute("href") || "/";
          try {
            sessionStorage.setItem("postLoginRedirect", redirectTo);
          } catch {
            if (typeof window.requireAuth === "function") {
              await window.requireAuth({ redirectTo });
              return;
            }
          }
          if (typeof showAuthMenu === "function") {
            showAuthMenu();
          }
        });
      });
    }

    return {
      openInlineLoginModal,
      promptLogin,
      createLoginRequiredPrompt,
      initAuthGateLinks,
    };
  }

  window.createAuthPromptKit = createAuthPromptKit;
})();
