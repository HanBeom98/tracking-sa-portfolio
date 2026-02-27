(function (globalScope) {
  function createAuthSessionRuntime({
    getAuthService,
    onStateChanged,
    onAuthRequired,
    redirectStorageKey = "postLoginRedirect",
    getCurrentPath = () => (globalScope.location.pathname + globalScope.location.search),
  } = {}) {
    let currentUser = null;
    let currentProfile = null;
    let readyResolved = false;
    let readyResolve = null;
    const readyPromise = new Promise((resolve) => {
      readyResolve = resolve;
    });

    function resolveReady(user) {
      if (!readyResolved && readyResolve) {
        readyResolved = true;
        readyResolve(user);
      }
    }

    function applyState(user, profile) {
      currentUser = user || null;
      currentProfile = profile || null;
      resolveReady(currentUser);
      if (typeof onStateChanged === "function") {
        onStateChanged({ user: currentUser, profile: currentProfile });
      }
      if (currentUser) {
        const redirectTo = globalScope.sessionStorage.getItem(redirectStorageKey);
        if (redirectTo) {
          globalScope.sessionStorage.removeItem(redirectStorageKey);
          
          try {
            const targetUrl = new URL(redirectTo, globalScope.location.href);
            const currentUrl = new URL(globalScope.location.href);
            
            // Only redirect if target is different from current
            if (targetUrl.pathname !== currentUrl.pathname || targetUrl.search !== currentUrl.search) {
              globalScope.location.href = redirectTo;
            }
          } catch (e) {
            console.error("Invalid redirect URL:", redirectTo);
          }
        }
      }
    }

    async function init() {
      const authService = await getAuthService();
      if (!authService) {
        applyState(null, null);
        return;
      }
      authService.onAuthStateChanged(({ user, profile }) => {
        applyState(user || null, profile || null);
      });
    }

    function waitForReady() {
      return readyPromise;
    }

    function getCurrentUser() {
      return currentUser;
    }

    function getCurrentUserProfile() {
      return currentProfile;
    }

    async function requireAuth({ redirectTo } = {}) {
      const user = await waitForReady();
      if (user) return user;
      globalScope.sessionStorage.setItem(redirectStorageKey, redirectTo || getCurrentPath());
      if (typeof onAuthRequired === "function") {
        onAuthRequired();
      }
      return null;
    }

    return {
      init,
      waitForReady,
      getCurrentUser,
      getCurrentUserProfile,
      requireAuth,
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createAuthSessionRuntime };
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.createAuthSessionRuntime = createAuthSessionRuntime;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
