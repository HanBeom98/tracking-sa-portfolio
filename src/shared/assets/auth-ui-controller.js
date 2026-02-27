(function () {
  function t(key, fallback) {
    return typeof window !== "undefined" && window.getTranslation
      ? window.getTranslation(key, fallback)
      : fallback;
  }

  async function loadAuthControlsFactory() {
    if (typeof window.createAuthControlsController === "function") {
      return window.createAuthControlsController;
    }

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-auth-controls="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "/auth-controls.js";
      script.async = true;
      script.dataset.authControls = "true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return window.createAuthControlsController;
  }

  function createAuthUiController({
    getAuthService,
    getCurrentUser,
    onLogoutSuccess,
  }) {
    let authControlsController = null;

    async function init() {
      const container = document.getElementById("auth-controls");
      if (!container) return;

      const factory = await loadAuthControlsFactory();
      if (typeof factory !== "function") {
        console.error("Auth controls factory is not available.");
        return;
      }

      authControlsController = factory({
        container,
        getAuthService,
        getCurrentUser,
        onLogoutSuccess,
      });
    }

    function showAuthMenu() {
      if (!authControlsController) {
        console.error(t("auth_controls_unavailable", "로그인 UI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
        return;
      }
      authControlsController.showAuthMenu();
    }

    function openAuthPrompt() {
      if (!authControlsController) {
        console.error(t("auth_controls_unavailable", "로그인 UI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
        return;
      }
      authControlsController.openAuthPrompt();
    }

    function updateUser(user, profile) {
      if (!authControlsController) return;
      authControlsController.setUser(user, profile);
    }

    return {
      init,
      showAuthMenu,
      openAuthPrompt,
      updateUser,
    };
  }

  window.createAuthUiController = createAuthUiController;
})();
