(function () {
  let authRuntimePromise = null;

  function loadScript(src, { type = "" } = {}) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-auth-runtime-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      if (type) script.type = type;
      script.dataset.authRuntimeSrc = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.ensureAuthRuntime = function ensureAuthRuntime() {
    if (window.AuthService) return Promise.resolve(window.AuthService);
    if (authRuntimePromise) return authRuntimePromise;

    authRuntimePromise = (async () => {
      try {
        await loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js");
        await Promise.all([
          loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-app-check.js"),
          loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"),
          loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"),
          loadScript("https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js"),
        ]);
        await loadScript("/firebase-config.js");
        await loadScript("/auth/ui/auth-client.js", { type: "module" });
        window.dispatchEvent(new CustomEvent("auth-runtime-ready"));
        return window.authDomainReady ? window.authDomainReady : window.AuthService || null;
      } catch (error) {
        if (typeof window.__resolveAuthDomain === "function") {
          window.__resolveAuthDomain(null);
          window.__resolveAuthDomain = null;
        }
        throw error;
      }
    })();

    return authRuntimePromise;
  };
})();
