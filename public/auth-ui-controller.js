(function () {
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

    async function signInWithProvider(providerId) {
      const authService = await getAuthService();
      if (!authService) {
        alert("로그인 기능이 아직 준비되지 않았습니다.");
        return;
      }
      try {
        await authService.signInWithProvider(providerId);
      } catch (error) {
        console.error("로그인 실패:", error);
        alert("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    }

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
        signInWithProvider,
        getCurrentUser,
        onLogoutSuccess,
      });
    }

    function showAuthMenu() {
      if (!authControlsController) {
        alert("로그인이 필요합니다.");
        return;
      }
      authControlsController.showAuthMenu();
    }

    function openAuthPrompt() {
      if (!authControlsController) {
        alert("로그인이 필요합니다.");
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
