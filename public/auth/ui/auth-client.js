import { buildAuthService } from "../application/authService.js?v=8673a2a5ca02";
import { createFirebaseAuthRepository } from "../infra/firebaseAuthRepository.js?v=c0a3d9c8b8ca";

function bootAuthDomain() {
  try {
    const authRepository = createFirebaseAuthRepository();
    const authService = buildAuthService({ authRepository });
    window.AuthService = authService;
    if (typeof window.__resolveAuthDomain === "function") {
      window.__resolveAuthDomain(authService);
      window.__resolveAuthDomain = null;
    }
    if (!window.authDomainReady) {
      window.authDomainReady = Promise.resolve(authService);
    }
  } catch (error) {
    console.error("Auth domain bootstrap failed:", error);
    if (typeof window.__resolveAuthDomain === "function") {
      window.__resolveAuthDomain(null);
      window.__resolveAuthDomain = null;
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthDomain, { once: true });
} else {
  bootAuthDomain();
}
