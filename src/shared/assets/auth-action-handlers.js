(function (globalScope) {
  function t(key, fallback) {
    if (typeof globalScope !== "undefined" && globalScope.getTranslation) {
      return globalScope.getTranslation(key, fallback);
    }
    return fallback;
  }

  function createAuthActionHandlers({ getAuthService }) {
    async function signInWithProvider(providerId, { onSuccess, onError } = {}) {
      const authService = await getAuthService();
      if (!authService) {
        const message = t("auth_service_unavailable", "로그인 기능이 아직 준비되지 않았습니다.");
        if (typeof onError === "function") onError(message);
        return false;
      }

      try {
        await authService.signInWithProvider(providerId);
        if (typeof onSuccess === "function") onSuccess();
        return true;
      } catch (error) {
        console.error("Provider login failed:", error);
        const message = t("auth_login_retry", "로그인에 실패했습니다. 다시 시도해주세요.");
        if (typeof onError === "function") onError(message, error);
        return false;
      }
    }

    async function signInWithEmail(
      { email, password },
      { onSuccess, onValidationError, onError } = {}
    ) {
      const authService = await getAuthService();
      if (!authService) {
        const message = t("auth_service_unavailable", "로그인 기능이 아직 준비되지 않았습니다.");
        if (typeof onError === "function") onError(message);
        return false;
      }

      if (!email || !password) {
        const message = t("auth_email_password_required", "이메일과 비밀번호를 입력해주세요.");
        if (typeof onValidationError === "function") onValidationError(message);
        return false;
      }

      try {
        await authService.signInWithEmail(email, password);
        if (typeof onSuccess === "function") onSuccess();
        return true;
      } catch (error) {
        console.error("Email login failed:", error);
        const message = t("auth_login_failed", "로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.");
        if (typeof onError === "function") onError(message, error);
        return false;
      }
    }

    async function signOut({ onSuccess, onError } = {}) {
      const authService = await getAuthService();
      if (!authService) return false;
      try {
        await authService.signOut();
        if (typeof onSuccess === "function") onSuccess();
        return true;
      } catch (error) {
        console.error("Logout failed:", error);
        if (typeof onError === "function") onError(error);
        return false;
      }
    }

    function goToSignup({ redirectTo = "/" } = {}) {
      globalScope.location.href = `/auth/signup?redirect=${encodeURIComponent(redirectTo)}`;
    }

    return {
      signInWithProvider,
      signInWithEmail,
      signOut,
      goToSignup,
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createAuthActionHandlers };
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.createAuthActionHandlers = createAuthActionHandlers;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
