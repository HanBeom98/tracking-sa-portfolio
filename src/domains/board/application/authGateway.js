function getGateway() {
  return window.AuthGateway || null;
}

async function waitAuthReady() {
  const gateway = getGateway();
  if (gateway && gateway.waitForReady) {
    return gateway.waitForReady();
  }
  if (window.authStateReady) {
    return window.authStateReady;
  }
  return null;
}

function getCurrentUser() {
  const gateway = getGateway();
  if (gateway && gateway.getCurrentUser) {
    return gateway.getCurrentUser();
  }
  return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
}

async function requireAuth({ redirectTo } = {}) {
  const gateway = getGateway();
  if (gateway && gateway.requireAuth) {
    return gateway.requireAuth({ redirectTo });
  }
  if (window.requireAuth) {
    return window.requireAuth({ redirectTo });
  }
  return null;
}

async function getAuthService() {
  const gateway = getGateway();
  if (gateway && gateway.getAuthService) {
    return gateway.getAuthService();
  }
  return window.authDomainReady || null;
}

export { waitAuthReady, getCurrentUser, requireAuth, getAuthService };
