function getGlobal(key) {
  if (typeof globalThis !== "object" || !globalThis) return undefined;
  return globalThis[key];
}

function getWindowObject() {
  const candidate = getGlobal("window");
  return candidate && typeof candidate === "object" ? candidate : null;
}

function getGateway() {
  const direct = getGlobal("AuthGateway");
  if (direct) return direct;
  const win = getWindowObject();
  return win?.AuthGateway || null;
}

async function waitAuthReady() {
  const gateway = getGateway();
  if (gateway && gateway.waitForReady) {
    return gateway.waitForReady();
  }
  const direct = getGlobal("authStateReady");
  if (direct) {
    return direct;
  }
  const win = getWindowObject();
  if (win?.authStateReady) {
    return win.authStateReady;
  }
  return null;
}

function getCurrentUser() {
  const gateway = getGateway();
  if (gateway && gateway.getCurrentUser) {
    return gateway.getCurrentUser();
  }
  const direct = getGlobal("getCurrentUser");
  if (typeof direct === "function") return direct();
  const win = getWindowObject();
  return typeof win?.getCurrentUser === "function" ? win.getCurrentUser() : null;
}

function getCurrentUserProfile() {
  const gateway = getGateway();
  if (gateway && gateway.getCurrentUserProfile) {
    return gateway.getCurrentUserProfile();
  }
  const direct = getGlobal("getCurrentUserProfile");
  if (typeof direct === "function") return direct();
  const win = getWindowObject();
  return typeof win?.getCurrentUserProfile === "function" ? win.getCurrentUserProfile() : null;
}

async function requireAuth({ redirectTo } = {}) {
  const gateway = getGateway();
  if (gateway && gateway.requireAuth) {
    return gateway.requireAuth({ redirectTo });
  }
  const direct = getGlobal("requireAuth");
  if (typeof direct === "function") {
    return direct({ redirectTo });
  }
  const win = getWindowObject();
  if (typeof win?.requireAuth === "function") {
    return win.requireAuth({ redirectTo });
  }
  return null;
}

async function getAuthService() {
  const gateway = getGateway();
  if (gateway && gateway.getAuthService) {
    return gateway.getAuthService();
  }
  const direct = getGlobal("authDomainReady");
  if (direct) return direct;
  const win = getWindowObject();
  return win?.authDomainReady || null;
}

export { waitAuthReady, getCurrentUser, getCurrentUserProfile, requireAuth, getAuthService };
